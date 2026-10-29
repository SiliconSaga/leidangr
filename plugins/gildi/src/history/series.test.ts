import type { TrialRun } from '@siliconsaga/plugin-gildi-common';
import { RUNGS, rungOf, seriesFor } from './series';

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
    expect(seriesFor([])).toEqual({ points: [], segments: [] });
  });
});
