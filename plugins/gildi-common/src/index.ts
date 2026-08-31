// The Guildhall's shared domain vocabulary: pure functions and types with no
// I/O, so the backend that produces outcomes and the frontend that renders
// them agree on what a trial result means without either importing the other.
export { medalFor } from './medals';
export type { Medal } from './medals';

export { fail, pass, unmeasured } from './outcome';
export type { Outcome, UnmeasuredReason } from './outcome';

export { unevaluatedVerdict, verdictFor } from './verdict';
export type { UnevaluatedReason, Verdict } from './verdict';
