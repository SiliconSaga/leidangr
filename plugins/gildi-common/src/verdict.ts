import { medalFor, type Medal } from './medals';
import type { Outcome, UnmeasuredReason } from './outcome';

export type UnevaluatedReason = 'no-standard';

// Suppression is NOT a medal value. `none` means "measured, and nothing
// passed" — a real verdict about a component. Suppression means "we cannot
// say", which is a statement about us. Rendering them identically would be the
// same failure ADR 0013 set out to end: a medal that does not mean what it
// says. See design §3 and proposed ADR 0014.
//
// `unevaluated` is a THIRD thing again, and the one most easily got wrong: we
// never learned what the trials are. `applicable` is unknown rather than zero,
// which is why it is absent here instead of being reported as 0.
export type Verdict =
  | { kind: 'medal'; medal: Medal; applicable: number; passing: number }
  | {
      kind: 'suppressed';
      reasons: UnmeasuredReason[];
      unmeasured: number;
      applicable: number;
      // Carried even when suppressed, because the stored run denormalises both
      // applicable and passing for charting (design §8). Omitting it would
      // leave the persistence path inventing a number.
      passing: number;
    }
  | { kind: 'unevaluated'; reason: UnevaluatedReason; detail?: string };

/**
 * Derive a verdict from the outcomes of the APPLICABLE trials.
 *
 * Callers pass an already facet-filtered set: `not applicable` is not an
 * outcome, so a skipped trial is simply absent here rather than present with a
 * third state. That is what lets `medalFor` keep its existing shape.
 *
 * An EMPTY array means the standard resolved and nothing applied to this
 * component — a real verdict of `none` per ADR 0013. It does NOT mean the
 * standard could not be read. For that, use `unevaluatedVerdict`.
 *
 * Consumes outcomes, never resolvers — which is what allows attestation to
 * arrive later as a new outcome producer rather than a change to this rule.
 */
export function verdictFor(outcomes: Outcome[]): Verdict {
  const applicable = outcomes.length;
  const passing = outcomes.filter(o => o.state === 'pass').length;
  const unmeasuredOutcomes = outcomes.filter(o => o.state === 'unmeasured');

  if (unmeasuredOutcomes.length > 0) {
    const reasons = [
      ...new Set(
        unmeasuredOutcomes.map(o => (o as { reason: UnmeasuredReason }).reason),
      ),
    ].sort();
    return {
      kind: 'suppressed',
      reasons,
      unmeasured: unmeasuredOutcomes.length,
      applicable,
      passing,
    };
  }

  return { kind: 'medal', medal: medalFor(applicable, passing), applicable, passing };
}

/**
 * The verdict for a run that never got as far as evaluating anything — the
 * standard could not be read, so the trial set is unknown.
 *
 * Deliberately NOT expressible through verdictFor: passing it `[]` would derive
 * medal `none`, publishing "measured, and nothing passed" about a component on
 * the strength of our own failure.
 */
export const unevaluatedVerdict = (
  reason: UnevaluatedReason,
  detail?: string,
): Verdict =>
  detail ? { kind: 'unevaluated', reason, detail } : { kind: 'unevaluated', reason };
