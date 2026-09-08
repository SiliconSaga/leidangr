// The package's public surface. The plugin itself arrives with the shell in
// the next change; until then this exports the pieces that exist so the
// entrypoint package.json already declares is real rather than a promise.
export { applicableTrials, facetsOf } from './facets';
export { loadStandard, standardUrlFor } from './standard';
export { evaluate, TRIAL_TIMEOUT_MS } from './evaluate';
export { resolverFor } from './resolvers/registry';
export { DatabaseTrialResultStore } from './store';

export type { EvaluateInput, RunResult } from './evaluate';
export type { Resolver, ResolverContext } from './resolvers/types';
export type { TrialOutcomeRow, TrialResultStore, TrialRun } from './store';
