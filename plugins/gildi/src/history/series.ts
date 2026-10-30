import type { Medal, TrialRun } from '@siliconsaga/plugin-gildi-common';

/**
 * The ladder, bottom to top. `none` is ON it — a measured verdict is the
 * bottom rung, not an absence — which is the same claim the badge makes by
 * giving `none` the medallion silhouette rather than the lozenge.
 *
 * Index IS the y position. Ordinal, not quantitative: the gap from bronze to
 * silver is not a measurable quantity, so the axis carries four named ticks
 * and no numbers.
 */
export const RUNGS = ['none', 'bronze', 'silver', 'gold'] as const;

export type Rung = (typeof RUNGS)[number];

export function rungOf(medal: Medal): number {
  return RUNGS.indexOf(medal as Rung);
}

/**
 * Why a run has no rung. Both are statements about US, which is why neither
 * gets a position on the ladder: placing them would assert a verdict we never
 * reached.
 *
 * `unavailable` is deliberately absent. It is derived from a failed request
 * and never stored, so it cannot appear in history — a gap in the chart is
 * always one of these two.
 */
export type GapKind = 'withheld' | 'unevaluated';

/**
 * One run on the time axis.
 *
 * `rung` is the measured position, null for a gap. `carried` is what the line
 * draws at: for a measured run that is its own rung, and for a gap it is the
 * last rung we actually saw, because a medal holds until a run changes it.
 * `carried` is null only when a gap occurs before anything was ever measured —
 * there is nothing to hold, and the chart must draw no mark rather than invent
 * a floor.
 */
export interface SeriesPoint {
  at: string;
  rung: number | null;
  carried: number | null;
  medal: Medal | null;
  gap: GapKind | null;
}

/**
 * A drawable span between two consecutive points.
 *
 * `dashed` spans are the ones crossing a run that told us nothing. They are
 * drawn, not omitted: a break in the line would read as "the component
 * stopped existing", and a solid line would claim we checked. The dash says
 * the only true thing — the medal probably held, and we did not confirm it.
 */
export interface SeriesSegment {
  fromAt: string;
  toAt: string;
  fromRung: number;
  toRung: number;
  dashed: boolean;
}

/**
 * The stretch between the last run and now, when that stretch has gone on long
 * enough that "current" is no longer something we can claim.
 *
 * ⚠ WITHOUT THIS THE CHART LIES BY OMISSION. A line that stops at its last run
 * and leaves the axis there draws a picture that ends in a measurement, however
 * old that measurement is — so a sweep that died three months ago looks exactly
 * like one that ran this morning. Cropping the unmeasured stretch out of frame
 * is the same inversion as plotting a gap at zero, in the other direction: it
 * turns our silence into an implied verdict of "still fine".
 *
 * So the axis runs to `toAt`, not to the last run, and the tail is dashed with
 * no marker at its end — there is no run there to mark.
 */
export interface SeriesTail {
  fromAt: string;
  toAt: string;
  rung: number;
}

export interface Series {
  points: SeriesPoint[];
  segments: SeriesSegment[];
  tail: SeriesTail | null;
}

function gapOf(run: TrialRun): GapKind | null {
  if (run.kind === 'unevaluated') return 'unevaluated';
  return run.medal === null ? 'withheld' : null;
}

/**
 * Turns stored runs into something drawable, and is the whole design argument
 * of the chart in one function.
 *
 * ⚠ A GAP IS NOT A ZERO. A withheld or unevaluated run has no medal, and the
 * tempting thing — plot it at the bottom of the ladder — would draw a cliff
 * from gold to nothing and read as a catastrophic regression. It is the same
 * inversion the badge fights, except a line makes it look *measured*: the eye
 * reads a downward slope as a finding about the component. So a gap gets no
 * rung at all, the line holds its last known value, and the span is dashed.
 *
 * Takes runs NEWEST FIRST, the order the endpoint returns, and emits points
 * oldest first, the order a time axis needs. Doing the reversal here rather
 * than in the component means the chart cannot draw a component's history
 * backwards while looking entirely plausible.
 *
 * Runs with an unparseable or missing `runAt` are dropped rather than plotted:
 * a point with no time has no x position, and guessing one would silently
 * reorder real history.
 *
 * `asOf` is when "now" is, and it decides whether the history has gone stale —
 * see `SeriesTail`. It is a parameter rather than a `Date.now()` read inside
 * the loop so that tests and the preview page are deterministic; callers in the
 * app leave it alone.
 */
export function seriesFor(runsNewestFirst: TrialRun[], asOf?: number): Series {
  const chronological = [...runsNewestFirst]
    .filter(run => Number.isFinite(Date.parse(run.runAt)))
    .sort((a, b) => Date.parse(a.runAt) - Date.parse(b.runAt));

  const points: SeriesPoint[] = [];
  let held: number | null = null;

  for (const run of chronological) {
    const gap = gapOf(run);
    // Gated on `kind` as well as the medal, for the same reason every other
    // consumer is: an unevaluated run measured nothing, so whatever medal its
    // row carries it cannot have been awarded by that run.
    const medal = !gap && run.kind === 'evaluated' ? run.medal : null;
    const rung = medal !== null ? rungOf(medal) : null;

    // A medal outside the union means the row is not what it claims. Treated
    // as unmeasured rather than plotted at -1, which would draw below the
    // axis — the response is a claim about the data, not a fact about it.
    const valid = rung !== null && rung >= 0 ? rung : null;
    if (valid !== null) held = valid;

    points.push({
      at: run.runAt,
      rung: valid,
      carried: valid ?? held,
      medal: valid !== null ? medal : null,
      gap: valid !== null ? null : (gap ?? 'unevaluated'),
    });
  }

  return {
    points,
    segments: segmentsFor(points),
    tail: tailFor(points, asOf ?? Date.now()),
  };
}

/**
 * The cadence of the runs we were given, as the MEDIAN interval between them.
 *
 * Median rather than mean because one long outage would drag the average out
 * far enough to excuse any amount of subsequent silence — the very thing the
 * tail exists to show. Undefined for fewer than two runs: a single run says
 * nothing about how often runs are expected, so nothing can be called late.
 */
function cadenceOf(points: SeriesPoint[]): number | undefined {
  if (points.length < 2) return undefined;
  const gaps = points
    .slice(1)
    .map((p, i) => Date.parse(p.at) - Date.parse(points[i].at))
    .sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * A tail when the next run is overdue — more time has passed since the last run
 * than usually passes between runs.
 *
 * Self-calibrating on purpose: there is no staleness threshold to configure and
 * none to drift out of step with the sweep's schedule. One missed interval is
 * the trigger because that is the first moment we can say something factual —
 * a run we expected did not arrive.
 *
 * Nothing is drawn before the first measurement, for the same reason no line is:
 * with no rung to hold there is nothing for a tail to hold either.
 */
function tailFor(points: SeriesPoint[], asOf: number): SeriesTail | null {
  const lastPoint = points[points.length - 1];
  if (!lastPoint || lastPoint.carried === null) return null;

  // A cadence of zero means every run we hold carries the same timestamp, which
  // tells us nothing about when the next one is due — and would make any
  // elapsed time whatsoever count as overdue.
  const cadence = cadenceOf(points);
  if (cadence === undefined || cadence <= 0) return null;

  const lastAt = Date.parse(lastPoint.at);
  if (!(asOf - lastAt > cadence)) return null;

  return {
    fromAt: lastPoint.at,
    toAt: new Date(asOf).toISOString(),
    rung: lastPoint.carried,
  };
}

/**
 * Whether there is enough to draw a line at all — two points with something to
 * hold, which is not the same as two runs.
 *
 * Exists so a HOST can say why the chart is absent. Asking the component
 * instead does not work: `<MedalHistoryChart/>` is an element whether or not it
 * will render null, so `chart ?? fallback` always takes the chart and the
 * fallback is dead code. A caller that wants to explain the blank has to know
 * before rendering.
 */
export function canChart(runsNewestFirst: TrialRun[]): boolean {
  return seriesFor(runsNewestFirst).points.filter(p => p.carried !== null).length >= 2;
}

/**
 * Spans between consecutive points that both have something to draw at.
 *
 * A span is dashed when EITHER end is a gap, so the dash covers the whole
 * unconfirmed stretch rather than only half of it. Leading points with
 * nothing carried are skipped: until a medal has been seen once there is no
 * line to hold, and starting it at the floor would invent a verdict.
 */
function segmentsFor(points: SeriesPoint[]): SeriesSegment[] {
  const drawable = points.filter(p => p.carried !== null);
  const segments: SeriesSegment[] = [];

  for (let i = 1; i < drawable.length; i++) {
    const from = drawable[i - 1];
    const to = drawable[i];
    segments.push({
      fromAt: from.at,
      toAt: to.at,
      fromRung: from.carried as number,
      toRung: to.carried as number,
      dashed: from.rung === null || to.rung === null,
    });
  }

  return segments;
}
