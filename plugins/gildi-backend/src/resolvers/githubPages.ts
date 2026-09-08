import {
  fail,
  pass,
  unmeasured,
  type Outcome,
  type Trial,
} from '@siliconsaga/plugin-gildi-common';
import type { Resolver, ResolverContext } from './types';

export const githubPagesResolver: Resolver = {
  async answer(trial: Trial, ctx: ResolverContext): Promise<Outcome> {
    if (!ctx.sourceUrl) {
      return unmeasured('no-source', 'the component declares no source location');
    }
    const check = trial.check;
    if (!check || check.type !== 'pages-source-branch') {
      return unmeasured(
        'no-resolver',
        `github-pages-api cannot answer ${check?.type ?? 'a trial with no check'}`,
      );
    }
    if (!ctx.pagesSourceBranch) {
      // No credentials configured, so we cannot ask. Deliberately distinct from
      // asking and being told Pages is off, which is a real failing answer — a
      // missing credential must not look like a non-compliant repository.
      return unmeasured('no-resolver', 'no GitHub Pages lookup is configured');
    }

    let branch: string | undefined;
    try {
      branch = await ctx.pagesSourceBranch(ctx.sourceUrl);
    } catch (err) {
      return unmeasured('error', `could not read the Pages configuration: ${err}`);
    }

    // Pages being unconfigured is an ANSWER, not an obstacle: the setting is
    // not what the standard asks for. This is the state a correct adoption sits
    // in until a human flips the switch, which is the point of the trial — it
    // is the one thing no pull request can satisfy.
    if (!branch) {
      return fail('GitHub Pages is not configured for this repository');
    }
    return branch === check.value
      ? pass()
      : fail(`Pages serves ${branch}, not ${check.value}`);
  },
};
