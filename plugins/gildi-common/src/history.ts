// The history endpoint's response shape. It lives here for the same reason
// `TrialRun` does — the backend derives it and the chart reads it, and a
// hand-copied mirror drifts silently on the first rename. It moved out of
// gildi-backend when the chart became its first frontend caller: a frontend
// plugin cannot import a backend package, so leaving it there would have
// forced exactly the restated shape this module exists to prevent.

import type { Medal } from './medals';
import type { TrialRun } from './run';

/**
 * A DISCRIMINATED union, not one struct with every field optional.
 *
 * The earlier shape had `from`, `to`, `medal` and `first` all optional on one
 * interface, which let a `release-changed` carry a medal and a `medal-earned`
 * carry a version — nonsense the compiler had no way to reject, and which a
 * consumer could only guard against by hand. Discriminating on `type` means
 * narrowing gives the renderer exactly the fields that event really has.
 *
 * Both kinds are TRANSITIONS rather than occurrences: `release-changed` fires
 * when the module moved under the component, `medal-earned` when the held
 * medal actually changed. `first` separates reaching a tier for the first time
 * from regaining it, because those read differently on a timeline.
 */
export type HistoryEvent =
  | { type: 'release-changed'; at: string; from: string; to: string }
  | { type: 'medal-earned'; at: string; medal: Medal; first: boolean };

/**
 * Runs come back NEWEST FIRST, the order the store reads them in, and the
 * chart reverses them for the time axis. Stated here because the order is not
 * recoverable from the type and a chart that assumes the wrong one draws the
 * component's history backwards while looking entirely plausible.
 */
export interface TrialHistory {
  runs: TrialRun[];
  events: HistoryEvent[];
}
