import type { TrialRun } from '@siliconsaga/plugin-gildi-common';
import { RUNGS, canChart, rungOf, seriesFor } from './series';

const run = (over: Partial<TrialRun> = {}): TrialRun => ({
  entityRef: 'component:default/site',
  aspectId: 'website-hygiene',
  runAt: '2026-09-01T00:00:00.000Z',
  kind: 'evaluated',
  medal: 'gold',
  suppressedReasons: null,
  applicable: 4,
  passing: 4,
  outcomes: [],
  ...over,
});

const at = (day: number, over: Partial<TrialRun> = {}) =>
  run({ runAt: `2026-09-0${day}T00:00:00.000Z`, ...over });

const withheld = (day: number) =>
  at(day, { medal: null, suppressedReasons: ['no-resolver'] });

const unevaluated = (day: number) =>
  at(day, { kind: 'unevaluated', medal: null, applicable: null, passing: null });

describe('the ladder', () => {
  // `none` is ON the ladder, at the bottom. It is a measured verdict, and the
  // badge makes the same claim by giving it the medallion rather than the
  // lozenge — the two surfaces have to agree or they teach different models.
  it('puts none at the bottom rather than off the scale', () => {
    expect(RUNGS[0]).toBe('none');
    expect(rungOf('none')).toBe(0);
    expect(rungOf('gold')).toBe(RUNGS.length - 1);
  });

  it('orders the tiers as a climb', () => {
    expect(rungOf('bronze')).toBeLessThan(rungOf('silver'));
    expect(rungOf('silver')).toBeLessThan(rungOf('gold'));
  });
});

describe('seriesFor', () => {
  // The endpoint returns newest first and a time axis needs oldest first.
  // Reversing here rather than in the component means the chart cannot draw a
  // history backwards while looking entirely plausible.
  it('emits points oldest first whatever order it was handed', () => {
    const { points } = seriesFor([at(3), at(1), at(2)]);
    expect(points.map(p => p.at)).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-09-02T00:00:00.000Z',
      '2026-09-03T00:00:00.000Z',
    ]);
  });

  // ⚠ THE LOAD-BEARING ASSERTION. A gap must not become the bottom rung. If it
  // did, a withheld run after a gold would draw a cliff to the floor and read
  // as a catastrophic regression — a measured finding about the component,
  // which is exactly backwards: it is a gap in what WE could see.
  it.each([
    ['withheld', withheld(2)],
    ['unevaluated', unevaluated(2)],
  ])('gives a %s run no rung at all, never rung zero', (_label, gapRun) => {
    const { points } = seriesFor([gapRun, at(1, { medal: 'gold' })]);
    const gapPoint = points[1];
    expect(gapPoint.rung).toBeNull();
    expect(gapPoint.rung).not.toBe(0);
    expect(gapPoint.medal).toBeNull();
  });

  it('separates a withheld run from an unevaluated one', () => {
    const { points } = seriesFor([unevaluated(2), withheld(1)]);
    expect(points.map(p => p.gap)).toEqual(['withheld', 'unevaluated']);
  });

  // A medal holds until a run changes it, so the line stays where it was
  // rather than dropping. The dash is what says we did not confirm it.
  it('holds the last known rung across a gap', () => {
    const { points } = seriesFor([
      withheld(3),
      at(2, { medal: 'silver' }),
      at(1, { medal: 'bronze' }),
    ]);
    expect(points.map(p => p.carried)).toEqual([
      rungOf('bronze'),
      rungOf('silver'),
      rungOf('silver'),
    ]);
  });

  it('dashes a span with a gap at either end, and only those', () => {
    const { segments } = seriesFor([
      at(4, { medal: 'gold' }),
      withheld(3),
      at(2, { medal: 'gold' }),
      at(1, { medal: 'gold' }),
    ]);
    // 1→2 measured both ends, 2→3 into the gap, 3→4 out of it.
    expect(segments.map(s => s.dashed)).toEqual([false, true, true]);
  });

  // A real drop is a real drop. Gold to silver was measured, so it stays
  // solid — the dash means "unconfirmed", not "bad news", and conflating the
  // two would make a genuine regression look like an outage.
  it('keeps a measured downgrade solid', () => {
    const { segments } = seriesFor([at(2, { medal: 'silver' }), at(1, { medal: 'gold' })]);
    expect(segments).toHaveLength(1);
    expect(segments[0].dashed).toBe(false);
    expect(segments[0].toRung).toBeLessThan(segments[0].fromRung);
  });

  // A measured `none` is a verdict and belongs on the line, solid. Only the
  // two gap kinds dash — otherwise the chart would hide the difference between
  // "we measured, nothing passed" and "we could not look".
  it('draws a measured none as a real point on the line', () => {
    const { points, segments } = seriesFor([at(2, { medal: 'none' }), at(1, { medal: 'gold' })]);
    expect(points[1].rung).toBe(0);
    expect(points[1].gap).toBeNull();
    expect(segments[0].dashed).toBe(false);
  });

  // Nothing has been seen yet, so there is nothing to hold. Starting the line
  // at the floor would invent a verdict for a component we never measured.
  it('draws no line before the first measured run', () => {
    const { points, segments } = seriesFor([at(3, { medal: 'bronze' }), unevaluated(2), unevaluated(1)]);
    expect(points.slice(0, 2).map(p => p.carried)).toEqual([null, null]);
    expect(segments).toHaveLength(0);
  });

  // Whatever the row says, a run that measured nothing cannot have awarded
  // anything. The invariant is the writer's, but this is a consumer that would
  // draw a false achievement if a row ever escaped it.
  it('never reads a medal off an unevaluated run', () => {
    const { points } = seriesFor([at(1, { kind: 'unevaluated', medal: 'gold' })]);
    expect(points[0].rung).toBeNull();
    expect(points[0].gap).toBe('unevaluated');
  });

  // The response is a claim about the data, not a fact about it. A medal
  // outside the union must not become rung -1 and draw below the axis.
  it('treats a medal outside the union as unmeasured, not as a negative rung', () => {
    const { points } = seriesFor([at(1, { medal: 'platinum' as never })]);
    expect(points[0].rung).toBeNull();
    expect(points[0].carried).toBeNull();
  });

  it('drops a run with no usable timestamp rather than guessing its place', () => {
    const { points } = seriesFor([at(2), run({ runAt: 'not-a-date' })]);
    expect(points).toHaveLength(1);
    expect(points[0].at).toBe('2026-09-02T00:00:00.000Z');
  });

  it('is empty for no runs at all', () => {
    expect(seriesFor([])).toEqual({ points: [], segments: [], tail: null });
  });
});

const DAY = 86_400_000;
const asOf = (day: number) => Date.parse(`2026-09-0${day}T00:00:00.000Z`);

// ⚠ THE OTHER HALF OF THE SAME ARGUMENT. A gap between runs is dashed because
// we did not confirm the medal. The stretch AFTER the last run is no different —
// except that a chart which simply ends there hides it, so a sweep that died
// months ago draws the same picture as one that ran this morning. Omitting the
// unmeasured stretch turns our silence into an implied "still fine".
describe('the stale tail', () => {
  it('holds the last rung and runs to now, dashed by construction', () => {
    const { tail } = seriesFor([at(3), at(2), at(1)], asOf(9));
    expect(tail).toEqual({
      fromAt: '2026-09-03T00:00:00.000Z',
      toAt: '2026-09-09T00:00:00.000Z',
      rung: rungOf('gold'),
    });
  });

  // Daily runs and it is still the same day: nothing is late, so nothing is
  // drawn. A tail on a healthy history would cry wolf on every chart.
  it('is absent while the next run is not yet overdue', () => {
    const { tail } = seriesFor(
      [at(3), at(2), at(1)],
      asOf(3) + DAY / 2,
    );
    expect(tail).toBeNull();
  });

  it('appears once one expected run has failed to arrive', () => {
    expect(seriesFor([at(3), at(2), at(1)], asOf(3) + DAY + 1).tail).not.toBeNull();
  });

  // MEDIAN, not mean. One long outage in the middle of the history would drag an
  // average out far enough to excuse any amount of later silence — which is
  // precisely the silence the tail exists to show.
  it('is not excused by one long outage earlier in the history', () => {
    const { tail } = seriesFor(
      [at(9), at(3), at(2), at(1)],
      asOf(9) + 2 * DAY,
    );
    expect(tail).not.toBeNull();
  });

  // A single run says nothing about how often runs are expected, so nothing
  // about it can be called late.
  it('cannot call one run stale, however old it is', () => {
    expect(seriesFor([at(1)], asOf(9)).tail).toBeNull();
  });

  // Otherwise every elapsed millisecond counts as overdue.
  it('draws nothing when every run carries the same timestamp', () => {
    expect(seriesFor([at(1), at(1), at(1)], asOf(9)).tail).toBeNull();
  });

  // The tail holds a rung. With nothing ever measured there is no rung to hold,
  // exactly as there is no line to draw.
  it('holds nothing when nothing was ever measured', () => {
    expect(seriesFor([unevaluated(3), unevaluated(2), unevaluated(1)], asOf(9)).tail)
      .toBeNull();
  });

  // The held rung, not the last MEASURED one — a gap already carries it
  // forward, and the tail continues the same held value rather than reaching
  // back past the gap for a different one.
  it('continues the rung the line was holding, gap or not', () => {
    const { tail } = seriesFor([withheld(3), at(2, { medal: 'silver' }), at(1)], asOf(9));
    expect(tail?.rung).toBe(rungOf('silver'));
    expect(tail?.fromAt).toBe('2026-09-03T00:00:00.000Z');
  });
});

// A HOST needs to know before rendering, because the element exists either way
// — `<MedalHistoryChart/> ?? fallback` always takes the chart, so a card that
// checked afterwards would show a silent blank instead of saying why.
describe('canChart', () => {
  it('needs two MEASURED runs, not merely two runs', () => {
    expect(canChart([withheld(2), withheld(1)])).toBe(false);
    expect(canChart([at(2, { medal: 'gold' }), withheld(1)])).toBe(false);
    expect(canChart([at(2, { medal: 'gold' }), at(1, { medal: 'gold' })])).toBe(true);
  });

  // A gap AFTER a measurement carries the held rung, so there are two things to
  // draw even though only one run was measured.
  it('counts a gap that has something to hold', () => {
    expect(canChart([withheld(2), at(1, { medal: 'gold' })])).toBe(true);
  });

  it.each([[[]], [[at(1)]]])('is false for %j', runs => {
    expect(canChart(runs)).toBe(false);
  });
});
