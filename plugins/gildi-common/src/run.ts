// The shape of one recorded run: what the backend writes, what its endpoints
// serialise, and what the frontend reads. It lives here rather than in
// gildi-backend so the card and the store share ONE declaration. A hand-copied
// mirror of a response shape drifts silently on the first rename — the card
// keeps compiling while reading a field that no longer exists, and nothing
// fails until a user looks at it.

import type { Medal } from './medals';

export interface TrialOutcomeRow {
  trialId: string;
  state: string;
  reason?: string;
  detail?: string;
}

export interface TrialRun {
  entityRef: string;
  aspectId: string;
  runAt: string;
  /**
   * `unevaluated` is a statement about US — we never learned what the trials
   * are — and is kept distinct from an evaluated run so a consumer cannot read
   * our own failure as a verdict about the component. It always carries a null
   * medal: a run that measured nothing cannot have awarded anything.
   */
  kind: 'evaluated' | 'unevaluated';
  moduleRelease?: string;
  /**
   * Null for a suppressed or unevaluated run. `none` is a real verdict.
   *
   * Typed as the union rather than `string`, which is the whole point of
   * sharing this declaration: a loose type here would let an invalid medal
   * compile on both sides and force the frontend into a cast that hides
   * exactly the bug the shared type exists to prevent.
   */
  medal: Medal | null;
  suppressedReasons: string[] | null;
  applicable: number | null;
  passing: number | null;
  outcomes: TrialOutcomeRow[] | null;
  unevaluatedReason?: string;
  unevaluatedDetail?: string;
}
