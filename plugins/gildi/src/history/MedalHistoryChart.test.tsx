import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import type { HistoryEvent, TrialRun } from '@siliconsaga/plugin-gildi-common';
import { MedalHistoryChart, describePoint } from './MedalHistoryChart';

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

// ⚠ `asOf` DEFAULTS TO THE NEWEST RUN, so these fixtures are never stale and
// the tail is a thing each test opts into. Left to the wall clock, every
// fixture here would be weeks overdue and every expectation below would be
// about a chart in a state the test never asked for.
const chart = (runs: TrialRun[], events: HistoryEvent[] = [], asOf?: number) =>
  renderInTestApp(
    <MedalHistoryChart
      runs={runs}
      events={events}
      asOf={asOf ?? Math.max(...runs.map(r => Date.parse(r.runAt)))}
    />,
  );

const states = () =>
  screen.getAllByTestId('history-point').map(p => p.getAttribute('data-state'));

const dashes = () =>
  screen
    .getAllByTestId('history-segment')
    .map(s => s.getAttribute('data-dashed'));

describe('MedalHistoryChart', () => {
  it('draws a point per run and a span between them', async () => {
    await chart([at(2, { medal: 'gold' }), at(1, { medal: 'silver' })]);
    expect(await screen.findByTestId('medal-history')).toBeInTheDocument();
    expect(states()).toEqual(['silver', 'gold']);
    expect(dashes()).toEqual(['false']);
  });

  // ⚠ The claim the chart exists to make. The gap keeps the line at gold and
  // dashes the span, rather than dropping to the bottom rung — a cliff would
  // read as a measured regression when nothing was measured at all.
  it('dashes across a gap instead of dropping the line', async () => {
    await chart([
      at(3, { medal: 'gold' }),
      withheld(2),
      at(1, { medal: 'gold' }),
    ]);
    expect(states()).toEqual(['gold', 'withheld', 'gold']);
    // Into the gap and out of it, both unconfirmed.
    expect(dashes()).toEqual(['true', 'true']);
  });

  // A measured downgrade is real news and must look different from an outage.
  it('keeps a measured downgrade solid', async () => {
    await chart([at(2, { medal: 'bronze' }), at(1, { medal: 'gold' })]);
    expect(dashes()).toEqual(['false']);
  });

  // Steps, not slopes: a diagonal would place the component at a rung it never
  // held. Every span is a horizontal run followed by a vertical move.
  it('draws each span as a step rather than a slope', async () => {
    await chart([at(2, { medal: 'gold' }), at(1, { medal: 'bronze' })]);
    const d = screen.getByTestId('history-segment').getAttribute('d') ?? '';
    expect(d).toMatch(/^M [\d.]+ [\d.]+ H [\d.]+ V [\d.]+$/);
  });

  // `getAllByText` for gold, not `getByText`: the endpoint label repeats the
  // rung's own name, which is deliberate — the axis says where the rungs are
  // and the end label says where the component finished.
  it('names every rung on the axis, none included', async () => {
    await chart([at(2), at(1)]);
    for (const rung of ['none', 'bronze', 'silver']) {
      expect(screen.getByText(rung)).toBeInTheDocument();
    }
    expect(screen.getAllByText('gold').length).toBeGreaterThanOrEqual(1);
  });

  // A tooltip must never be the only way to reach a value, so every run is
  // also in a table. Hover is an enhancement on top of it.
  it('puts every run in a table as well as on the plot', async () => {
    await chart([at(3, { medal: 'gold' }), withheld(2), at(1, { medal: 'silver' })]);
    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(screen.getByRole('table')).toHaveAccessibleName(/oldest first/i);
  });

  it('says what the dashed line means rather than leaving it to be guessed', async () => {
    await chart([at(3), withheld(2), at(1)]);
    expect(
      await screen.findByText(/dashed line means we could not confirm/i),
    ).toBeInTheDocument();
  });

  // A label clipped by its own viewBox is worse than no label. Placing the end
  // label above the point unconditionally put a gold endpoint at y=4 in a box
  // whose plot starts at 14, so it flips below when there is no room above.
  it.each([
    ['gold', 'gold'],
    ['none', 'none'],
  ])('keeps the end label inside the plot at the %s rung', async (_label, medal) => {
    await chart([at(2, { medal: medal as 'gold' }), at(1, { medal: medal as 'gold' })]);
    const end = screen
      .getAllByText(medal)
      .find(el => el.getAttribute('class')?.includes('endLabel'));
    const y = Number(end?.getAttribute('y'));
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(180);
  });

  it('marks a release change so a medal that moved has an explanation', async () => {
    await chart([at(2, { medal: 'bronze' }), at(1, { medal: 'gold' })], [
      { type: 'release-changed', at: '2026-09-02T00:00:00.000Z', from: '1.0', to: '1.1' },
    ]);
    expect(await screen.findByText('1.1')).toBeInTheDocument();
  });

  // One run is not a trend, and an axis drawn under a single point is a
  // confident picture of nothing.
  it('draws nothing for a single run', async () => {
    await chart([at(1)]);
    expect(screen.queryByTestId('medal-history')).not.toBeInTheDocument();
  });

  // Counted on what can be drawn, not on how many runs arrived: a history that
  // is nothing but gaps has no line to hold.
  it('draws nothing when no run was ever measured', async () => {
    await chart([withheld(2), withheld(1)]);
    expect(screen.queryByTestId('medal-history')).not.toBeInTheDocument();
  });
});

// A chart that ends at its last run shows no difference between a sweep that
// ran this morning and one that died in the spring. The tail is what makes the
// difference visible, and it is the same dash as a gap because it is the same
// claim: we have not confirmed this.
describe('the overdue stretch', () => {
  const STALE = Date.parse('2026-09-20T00:00:00.000Z');

  it('runs the line past the last point to today, dashed and flat', async () => {
    await chart([at(3), at(2), at(1)], [], STALE);
    const d = screen.getByTestId('history-tail').getAttribute('d') ?? '';
    // H and no V: the medal holds, so the tail cannot change rung.
    expect(d).toMatch(/^M [\d.]+ [\d.]+ H [\d.]+$/);
  });

  it('is absent while the next run is not yet due', async () => {
    await chart([at(3), at(2), at(1)]);
    expect(screen.queryByTestId('history-tail')).not.toBeInTheDocument();
  });

  // The axis has to move with the tail, or the tail is drawn off the right-hand
  // edge. Asserted on the geometry rather than the label, because the label
  // reading "today" would still be true of a chart scaled to the last run.
  it('ends the axis at today rather than at the last run', async () => {
    await chart([at(3), at(2), at(1)], [], STALE);
    expect(screen.getByText('today')).toBeInTheDocument();
    const d = screen.getByTestId('history-tail').getAttribute('d') ?? '';
    // 640 wide, 20 of right padding: the tail reaches the plot's right edge,
    // which only happens if `now` is the end of the scale.
    expect(Number(d.split('H')[1])).toBeCloseTo(620, 0);
  });

  // ⚠ The whole point. The medal was measured as gold and is still the last
  // thing we know — but the right edge is today, and no run speaks for today.
  it('labels the right edge unconfirmed even over a clean gold', async () => {
    await chart([at(3), at(2), at(1)], [], STALE);
    const end = screen
      .getAllByText(/unconfirmed/)
      .find(el => el.getAttribute('class')?.includes('endLabel'));
    expect(end).toBeDefined();
  });

  it('says in words how long it has been, not only in pixels', async () => {
    await chart([at(3), at(2), at(1)], [], STALE);
    expect(await screen.findByText(/No run since Sep 3/)).toBeInTheDocument();
  });

  // No run happened at today's edge, so marking one there would invent a
  // measurement out of our own silence.
  it('puts no marker at the far end of the tail', async () => {
    await chart([at(3), at(2), at(1)], [], STALE);
    expect(screen.getAllByTestId('history-point')).toHaveLength(3);
  });
});

// The dash is one channel, so it reads the same on a marker as on a line. A
// solid ring at a gap would say a medal was measured that day.
describe('the gap marker', () => {
  const ringOf = (state: string) =>
    screen
      .getAllByTestId('history-point')
      .find(g => g.getAttribute('data-state') === state)
      ?.querySelectorAll('circle')[1];

  it('perforates a gap and leaves a measured medal solid', async () => {
    await chart([at(3), withheld(2), at(1)]);
    expect(ringOf('withheld')).toHaveAttribute('stroke-dasharray');
    expect(ringOf('gold')).not.toHaveAttribute('stroke-dasharray');
  });
});

describe('describePoint', () => {
  // The wording keeps the model's distinction: `none` is about the component,
  // the other two are about us.
  it('calls none a measurement and the gaps our own', () => {
    expect(describePoint({ at: 'x', rung: 0, carried: 0, medal: 'none', gap: null })).toMatch(
      /measured, and nothing passed/,
    );
    expect(
      describePoint({ at: 'x', rung: null, carried: 3, medal: null, gap: 'withheld' }),
    ).toMatch(/could not be measured/);
    expect(
      describePoint({ at: 'x', rung: null, carried: 3, medal: null, gap: 'unevaluated' }),
    ).toMatch(/standard could not be read/);
  });
});
