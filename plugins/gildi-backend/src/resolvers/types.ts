import type { Entity } from '@backstage/catalog-model';
import type { UrlReaderService } from '@backstage/backend-plugin-api';
import type { Outcome, Trial } from '@siliconsaga/plugin-gildi-common';

export interface ResolverContext {
  entity: Entity;
  /** The adopting repository's directory URL, absent when undeterminable. */
  sourceUrl?: string;
  reader: UrlReaderService;
  /**
   * The branch GitHub Pages is configured to serve, or undefined if Pages is
   * not configured. The FUNCTION being absent is a different thing again — it
   * means the plugin has no credentials to ask with, which resolves to
   * unmeasured rather than to a failing trial.
   *
   * On the context rather than an API call inside the resolver, so the resolver
   * stays a decision over a fetched fact and credentials stay in the plugin
   * shell with the other integrations.
   */
  pagesSourceBranch?: (sourceUrl: string) => Promise<string | undefined>;
  /**
   * Aborted when the trial's budget expires. Resolvers MUST pass it to every
   * request they make: without it a timed-out trial is only abandoned, not
   * stopped, and its request keeps running against a rate limit nobody is
   * waiting on. Racing a promise ends the wait, not the work.
   */
  signal?: AbortSignal;
}

/**
 * Answers one trial.
 *
 * Returns an Outcome and does not throw for an expected condition. The caller
 * isolates failures per trial anyway, but a resolver that knows why it could
 * not answer should say so with a reason rather than leave the caller guessing.
 */
export interface Resolver {
  answer(trial: Trial, ctx: ResolverContext): Promise<Outcome>;
}
