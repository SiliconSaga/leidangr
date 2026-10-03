import type { TrialRun } from '@siliconsaga/plugin-gildi-common';

/**
 * What the badge draws — SIX states, not three.
 *
 * The whole outcome model exists to keep three different kinds of "no medal"
 * apart, and this is the last mile where that distinction either survives or
 * gets flattened into an empty cell:
 *
 * - `none` is a VERDICT ABOUT THE COMPONENT — we measured, and nothing passed.
 * - `withheld` is a statement about US — a trial could not be measured, so the
 *   medal is suppressed rather than denied.
 * - `unevaluated` is also about us, one step earlier — we never learned what
 *   the trials were.
 *
 * Rendering the last two as `none` would tell a component it earned nothing on
 * a run that measured nothing, which is the exact inversion the backend spent
 * two designs avoiding.
 */
export type BadgeState =
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'none'
  | 'withheld'
  | 'unevaluated'
  | 'unavailable';

/** The three states that are an achievement rather than a report about a gap. */
const EARNED = new Set<BadgeState>(['gold', 'silver', 'bronze']);
export const isEarned = (s: BadgeState): boolean => EARNED.has(s);

/**
 * The states that are a statement about US rather than a verdict about the
 * component, and therefore take the lozenge rather than the medallion.
 *
 * A set rather than a condition spelled out at the point of render: the
 * silhouette rule is the design's load-bearing claim, and it should be decided
 * once here rather than re-derived everywhere a mark is drawn.
 */
const GAP = new Set<BadgeState>(['withheld', 'unevaluated', 'unavailable']);
export const isGap = (s: BadgeState): boolean => GAP.has(s);

/**
 * `undefined` means DRAW NOTHING, and is deliberately distinct from every state
 * above: a component the sweep has not reached yet has no run at all, which is
 * not a finding about it. The card's existing empty rendering is already
 * correct for that, and a placeholder on every unswept row would read as a
 * broken card rather than as information.
 */
export function badgeStateFor(run: TrialRun | undefined): BadgeState | undefined {
  if (!run) return undefined;
  if (run.kind === 'unevaluated') return 'unevaluated';
  // An evaluated run with no medal is suppression — verdictFor yields exactly
  // three shapes, and `medal | null` plus `kind` distinguishes all of them.
  if (run.medal === null) return 'withheld';
  return run.medal === 'gold' || run.medal === 'silver' || run.medal === 'bronze'
    ? run.medal
    : 'none';
}

/**
 * The word beside the mark. Colour is never the only channel — the label names
 * the state outright, so the badge reads correctly in greyscale and to a screen
 * reader, matching how the version pills on the same card already work.
 */
export function badgeLabelFor(state: BadgeState): string {
  switch (state) {
    case 'withheld':
      return 'withheld';
    case 'unevaluated':
      return 'not evaluated';
    case 'unavailable':
      return 'unavailable';
    default:
      return state;
  }
}

/**
 * The title for a component whose trials could not be FETCHED at all.
 *
 * Distinct from drawing nothing, which means "no run yet". A failed request is
 * our gap, and rendering it as an absent badge would make our own outage look
 * like a component the sweep has not reached — the same inversion the outcome
 * model refuses everywhere else, arriving by a different route.
 */
export function badgeTitleForError(error: Error | undefined): string {
  const why = error?.message?.trim();
  return `Could not read this component's trials${why ? `: ${why}` : ''}. This is a gap in what we could fetch, not a verdict about the component.`;
}

/**
 * The hover text, which is where the REASON lives. A badge that says "withheld"
 * and cannot say why is an invitation to assume the worst, and the run already
 * carries everything needed to answer.
 */
export function badgeTitleFor(run: TrialRun, state: BadgeState): string {
  if (state === 'unevaluated') {
    const why = run.unevaluatedDetail ?? run.unevaluatedReason;
    return why
      ? `Not evaluated: ${why}`
      : 'Not evaluated — the standard for this aspect could not be read';
  }
  if (state === 'withheld') {
    // Plural on purpose: several trials can be unmeasured for different
    // reasons in one run, and collapsing them loses the one thing the field
    // exists to say.
    const reasons = run.suppressedReasons ?? [];
    const tail = reasons.length ? ` (${reasons.join(', ')})` : '';
    return `Medal withheld — a trial could not be measured${tail}. This is a gap in what we could read, not a failing grade.`;
  }
  const { passing, applicable } = run;
  const counted =
    typeof passing === 'number' && typeof applicable === 'number'
      ? `${passing} of ${applicable} applicable trials passed`
      : 'measured';
  return state === 'none'
    ? `No medal — ${counted}`
    : `${state.charAt(0).toUpperCase()}${state.slice(1)} — ${counted}`;
}
