import { unmeasured, type Outcome, type Trial } from '@siliconsaga/plugin-gildi-common';
import type { Resolver, ResolverContext } from './types';

// PLACEHOLDER — replaced in the next commit, which brings the real Pages
// lookup and its tests. Registered now so the registry has both entries and
// its dispatch can be tested; it answers unmeasured rather than pass, so the
// worst it can do meanwhile is suppress a medal it should have decided.
export const githubPagesResolver: Resolver = {
  async answer(_trial: Trial, _ctx: ResolverContext): Promise<Outcome> {
    return unmeasured('no-resolver', 'github-pages-api not implemented yet');
  },
};
