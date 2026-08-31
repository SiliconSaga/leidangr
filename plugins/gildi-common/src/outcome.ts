// A trial outcome is a union, never a boolean. The boolean is the trap the
// standard's `artifact:` field was added to avoid: it reads fine and cannot
// express what you later need.
//
// `unmeasured` means WE COULD NOT LOOK, and its reasons are sub-flavours of
// that rather than peers of `fail` — collapsing them into `fail` would blame a
// component for our missing resolver.
//
// A MISSING ARTIFACT IS `fail`, NOT `unmeasured`. No Gemfile means
// gemfile-present fails: absence is the answer, not an obstacle to finding one.
// This is the distinction most likely to be got wrong. See design §3.
export type UnmeasuredReason =
  // Nothing here knows how to answer this trial — an unregistered factSource
  // or an unknown check.type. Never a pass.
  | 'no-resolver'
  // The lookup itself broke: network, auth, malformed artifact.
  | 'error'
  // The component's repository could not be determined at all.
  | 'no-source';

export type Outcome =
  | { state: 'pass' }
  | { state: 'fail'; detail?: string }
  | { state: 'unmeasured'; reason: UnmeasuredReason; detail?: string };

// Constructors rather than object literals at every call site, so the optional
// `detail` key is ABSENT when unset instead of present-and-undefined. These
// outcomes are serialised into a stored run, where the difference is visible.
export const pass = (): Outcome => ({ state: 'pass' });

export const fail = (detail?: string): Outcome =>
  detail ? { state: 'fail', detail } : { state: 'fail' };

export const unmeasured = (reason: UnmeasuredReason, detail?: string): Outcome =>
  detail ? { state: 'unmeasured', reason, detail } : { state: 'unmeasured', reason };
