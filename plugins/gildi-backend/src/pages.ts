import type { ResolverContext } from './resolvers/types';

export interface RepoSlug {
  owner: string;
  repo: string;
}

/**
 * The narrow slice of GitHub this lookup needs, as a port rather than an
 * Octokit instance. The POLICY below is the part worth testing — which 404
 * means what — and a port keeps that testable without an HTTP layer or a
 * mocked SDK. The real adapter is thin enough to read in one glance.
 */
export interface GithubPagesApi {
  /**
   * The Pages source branch, or undefined if the API said 404.
   *
   * 404 is deliberately NOT interpreted here: it reaches the policy ambiguous,
   * because only the policy knows what else to ask.
   */
  pagesSourceBranch(slug: RepoSlug): Promise<{ branch?: string; notFound?: true }>;
  /** Whether these credentials can see the repository at all. */
  canSeeRepo(slug: RepoSlug): Promise<boolean>;
}

/**
 * `https://github.com/owner/repo/tree/main/` -> { owner, repo }. The Pages API
 * needs the slug, and the source location is a tree URL rather than a repo URL.
 */
export function parseGithubSlug(sourceUrl: string): RepoSlug {
  const [, owner, repo] = new URL(sourceUrl).pathname.split('/');
  if (!owner || !repo) {
    throw new Error(`cannot parse an owner and repo from ${sourceUrl}`);
  }
  return { owner, repo };
}

/**
 * Builds the `pagesSourceBranch` lookup the github-pages resolver takes on its
 * context.
 *
 * ⚠ THE WHOLE JOB HERE IS TELLING TWO 404s APART. GitHub answers 404 on the
 * Pages API for "this repository has no Pages" AND for "you may not see whether
 * it does" — deliberately, because a 403 would confirm that a private resource
 * exists. Every other decision in this file follows from that one fact.
 *
 * The two answers must not be conflated, because they are opposites in the only
 * way that matters: `undefined` means Pages is switched off, which is a real
 * verdict the trial fails a component on, while throwing reaches the resolver as
 * unmeasured and withholds the medal instead. Reporting a permissions gap as
 * "not configured" blames a compliant repository for our own missing access —
 * the inversion the resolver's contract forbids in as many words.
 */
export function createPagesSourceBranch(deps: {
  /** Hosts with a configured GitHub integration, so Enterprise counts too. */
  githubHosts: Set<string>;
  tokenFor(sourceUrl: string): Promise<string | undefined>;
  apiFor(sourceUrl: string, token: string): GithubPagesApi;
}): NonNullable<ResolverContext['pagesSourceBranch']> {
  return async (sourceUrl: string): Promise<string | undefined> => {
    // A Gitea or GitLab component cannot be asked about GitHub Pages, and must
    // not be told it FAILED the trial. Throwing reaches the resolver as
    // unmeasured{error}, which withholds the medal and says why.
    const host = new URL(sourceUrl).hostname;
    if (!deps.githubHosts.has(host)) {
      throw new Error(
        `${host} is not a configured GitHub host, so its Pages settings cannot be read`,
      );
    }

    const slug = parseGithubSlug(sourceUrl);
    const token = await deps.tokenFor(sourceUrl);
    // Unauthenticated, EVERY repository 404s — including one whose Pages is
    // live and correct. Measured, not assumed: an anonymous read of a site
    // serving Pages from `main` returns 404, and the first end-to-end run
    // failed a compliant site on the strength of it.
    if (!token) {
      throw new Error(
        'no GitHub credentials are configured, and the Pages API answers 404 both for "not configured" and "not permitted" — so this cannot be measured rather than failed',
      );
    }

    const api = deps.apiFor(sourceUrl, token);
    const result = await api.pagesSourceBranch(slug);
    if (!result.notFound) {
      return result.branch;
    }

    // A CREDENTIAL-BEARING 404 IS STILL AMBIGUOUS. A token that cannot see the
    // repository — private, not granted, wrong org — gets the same 404 as a
    // repository with no Pages. So ask a question whose 404 is unambiguous:
    // can these credentials see the repository at all?
    //
    // Visible repo + Pages 404 is the one reading we can defend as "no Pages".
    // Invisible repo tells us only that our access is short, which is our gap
    // and not the component's.
    if (!(await api.canSeeRepo(slug))) {
      throw new Error(
        `the configured GitHub credentials cannot see ${slug.owner}/${slug.repo}, so a 404 from the Pages API cannot be read as "Pages is not configured"`,
      );
    }
    return undefined;
  };
}
