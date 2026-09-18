import { createPagesSourceBranch, parseGithubSlug, type GithubPagesApi } from './pages';

const SOURCE = 'https://github.com/SiliconSaga/hygiene-testsite/tree/main/';

// Every case here is about ONE question: which 404 is this? The lookup's whole
// reason to exist is that GitHub will not tell us, so these assert the
// substitute questions it asks instead.
const lookup = (over: {
  token?: string;
  api?: Partial<GithubPagesApi>;
  hosts?: string[];
}) =>
  createPagesSourceBranch({
    githubHosts: new Set(over.hosts ?? ['github.com']),
    tokenFor: async () => ('token' in over ? over.token : 'gh-token'),
    apiFor: () => ({
      pagesSourceBranch: async () => ({ branch: 'gh-pages' }),
      canSeeRepo: async () => true,
      ...over.api,
    }),
  });

describe('parseGithubSlug', () => {
  it('reads the owner and repo out of a tree URL', () => {
    expect(parseGithubSlug(SOURCE)).toEqual({
      owner: 'SiliconSaga',
      repo: 'hygiene-testsite',
    });
  });

  it('throws rather than guessing when there is no repo segment', () => {
    expect(() => parseGithubSlug('https://github.com/SiliconSaga')).toThrow();
  });
});

describe('createPagesSourceBranch', () => {
  it('returns the branch the API reports', async () => {
    await expect(lookup({})(SOURCE)).resolves.toBe('gh-pages');
  });

  // Not a failure of the component: we never asked. Throwing reaches the
  // resolver as unmeasured, which withholds the medal rather than denying it.
  it('refuses to answer for a host with no GitHub integration', async () => {
    await expect(
      lookup({ hosts: ['github.com'] })('https://gitea.example.com/o/r/tree/main/'),
    ).rejects.toThrow(/not a configured GitHub host/);
  });

  // Unauthenticated, every repository 404s — including a compliant one. This
  // is the bug the first live end-to-end run found.
  it('refuses to answer at all without a token', async () => {
    await expect(lookup({ token: undefined })(SOURCE)).rejects.toThrow(
      /no GitHub credentials are configured/,
    );
  });

  // ⚠ THE REGRESSION THIS FILE EXISTS FOR. A token that cannot see the
  // repository gets the SAME 404 as a repository with no Pages. Reading that as
  // "Pages is off" fails a compliant component for our missing access.
  it('treats a 404 as unmeasured when the repo is not visible to us', async () => {
    await expect(
      lookup({
        api: {
          pagesSourceBranch: async () => ({ notFound: true }),
          canSeeRepo: async () => false,
        },
      })(SOURCE),
    ).rejects.toThrow(/cannot see SiliconSaga\/hygiene-testsite/);
  });

  // The other side of the same 404: we can see the repository, so its Pages
  // really is switched off. That IS a verdict, and the trial should fail on it.
  it('reads a 404 as "no Pages" when the repo is visible', async () => {
    await expect(
      lookup({
        api: {
          pagesSourceBranch: async () => ({ notFound: true }),
          canSeeRepo: async () => true,
        },
      })(SOURCE),
    ).resolves.toBeUndefined();
  });

  it('propagates a non-404 API failure rather than calling it "no Pages"', async () => {
    await expect(
      lookup({
        api: {
          pagesSourceBranch: async () => {
            throw new Error('502 bad gateway');
          },
        },
      })(SOURCE),
    ).rejects.toThrow(/502/);
  });

  // Pages configured but serving from a path with no branch reported: absent is
  // absent, and must not be mistaken for the visibility case above.
  it('returns undefined when the API reports no branch', async () => {
    await expect(
      lookup({ api: { pagesSourceBranch: async () => ({}) } })(SOURCE),
    ).resolves.toBeUndefined();
  });
});
