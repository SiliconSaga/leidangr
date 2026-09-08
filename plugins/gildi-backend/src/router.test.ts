import { eventsFor } from './router';
import type { TrialRun } from './store';

const run = (over: Partial<TrialRun>): TrialRun => ({
  entityRef: 'component:default/site',
  aspectId: 'website-hygiene',
  runAt: '2026-09-01T00:00:00.000Z',
  kind: 'evaluated',
  medal: 'gold',
  suppressedReasons: null,
  applicable: 1,
  passing: 1,
  outcomes: [],
  ...over,
});

describe('eventsFor', () => {
  it('is empty for a single run, because nothing has changed yet', () => {
    expect(eventsFor([run({ moduleRelease: '1.1', medal: null })])).toEqual([]);
  });

  it('marks a release change but not the first release seen', () => {
    const events = eventsFor([
      run({ runAt: '2026-09-02T00:00:00.000Z', moduleRelease: '1.1', medal: null }),
      run({ runAt: '2026-09-01T00:00:00.000Z', moduleRelease: '1.0', medal: null }),
    ]);
    expect(events).toEqual([
      { type: 'release-changed', at: '2026-09-02T00:00:00.000Z', from: '1.0', to: '1.1' },
    ]);
  });

  it('marks a medal the first time and flags re-earning after losing it', () => {
    const events = eventsFor([
      run({ runAt: '2026-09-03T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-02T00:00:00.000Z', medal: null }),
      run({ runAt: '2026-09-01T00:00:00.000Z', medal: 'gold' }),
    ]);
    expect(events.filter(e => e.type === 'medal-earned')).toEqual([
      { type: 'medal-earned', at: '2026-09-01T00:00:00.000Z', medal: 'gold', first: true },
      { type: 'medal-earned', at: '2026-09-03T00:00:00.000Z', medal: 'gold', first: false },
    ]);
  });

  // TRANSITIONS, not occurrences. At hourly sweeps a steady component would
  // otherwise collect twenty-four identical marks a day, burying the one day
  // its medal actually changed.
  it('emits nothing further while a medal is simply held', () => {
    const events = eventsFor([
      run({ runAt: '2026-09-03T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-02T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-01T00:00:00.000Z', medal: 'gold' }),
    ]);
    expect(events.filter(e => e.type === 'medal-earned')).toEqual([
      { type: 'medal-earned', at: '2026-09-01T00:00:00.000Z', medal: 'gold', first: true },
    ]);
  });

  it('treats an upgrade as its own transition', () => {
    const events = eventsFor([
      run({ runAt: '2026-09-02T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-01T00:00:00.000Z', medal: 'silver' }),
    ]);
    expect(events.map(e => e.medal)).toEqual(['silver', 'gold']);
  });

  it('does not treat none or a suppressed run as an earned medal', () => {
    // `none` is a real verdict but not an achievement, and a suppressed run has
    // no medal at all. Neither belongs on the chart as a moment.
    expect(
      eventsFor([run({ medal: 'none' }), run({ medal: null })]).filter(
        e => e.type === 'medal-earned',
      ),
    ).toEqual([]);
  });

  it('treats a suppressed run between two golds as losing and regaining', () => {
    // The gap is the point: a medal that lapsed and came back is two moments,
    // and a chart that hid the lapse would be hiding the interesting one.
    const events = eventsFor([
      run({ runAt: '2026-09-03T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-02T00:00:00.000Z', medal: null }),
      run({ runAt: '2026-09-01T00:00:00.000Z', medal: 'gold' }),
    ]);
    expect(events.filter(e => e.type === 'medal-earned')).toHaveLength(2);
  });

  it('ignores an unevaluated run for release tracking', () => {
    // An unevaluated run has no moduleRelease, so it must not read as the
    // release changing to undefined and back.
    const events = eventsFor([
      run({ runAt: '2026-09-03T00:00:00.000Z', moduleRelease: '1.1', medal: null }),
      run({ runAt: '2026-09-02T00:00:00.000Z', kind: 'unevaluated', medal: null }),
      run({ runAt: '2026-09-01T00:00:00.000Z', moduleRelease: '1.1', medal: null }),
    ]);
    expect(events.filter(e => e.type === 'release-changed')).toEqual([]);
  });
});
