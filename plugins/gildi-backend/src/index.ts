// The package's public surface: the plugin the backend adds, and the run shape
// its endpoints serialise. Everything else — resolvers, the evaluator, the
// store implementation — is internal, reachable only through the plugin, and
// stays free to change without a consumer noticing.
export { gildiPlugin as default } from './plugin';
export type { TrialOutcomeRow, TrialResultStore, TrialRun } from './store';
export type { HistoryEvent } from './router';
