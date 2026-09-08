import knexFactory from 'knex';
import { join } from 'node:path';
import { DatabaseTrialResultStore, type TrialRun } from './store';

// A real SQLite database rather than a mock, because the things worth asserting
// here are storage behaviours: that an append does not overwrite, that a null
// count survives as null rather than coming back zero, and that pruning removes
// what it should and nothing else. A fake store would assert only that this
// file calls itself correctly.
// Destroyed after each test. Without it jest reports a worker that failed to
// exit gracefully — a leaked pool per test case, which is noise now and a hang
// later on a machine that runs the suite in-band.
const opened: Array<{ destroy(): Promise<void> }> = [];

async function store() {
  const knex = knexFactory({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    migrations: { directory: join(__dirname, '..', 'migrations') },
  });
  opened.push(knex);
  return DatabaseTrialResultStore.create({ getClient: async () => knex } as any);
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map(k => k.destroy()));
});

const run = (over: Partial<TrialRun> = {}): TrialRun => ({
  entityRef: 'component:default/site',
  aspectId: 'website-hygiene',
  runAt: '2026-09-05T10:00:00.000Z',
  kind: 'evaluated',
  moduleRelease: '1.1',
  medal: 'gold',
  suppressedReasons: null,
  applicable: 2,
  passing: 2,
  outcomes: [{ trialId: 'a', state: 'pass' }],
  ...over,
});

describe('DatabaseTrialResultStore', () => {
  it('returns undefined before anything is stored', async () => {
    const s = await store();
    expect(await s.latest('component:default/nobody', 'website-hygiene')).toBeUndefined();
  });

  it('round-trips a run', async () => {
    const s = await store();
    await s.append(run());
    const got = await s.latest('component:default/site', 'website-hygiene');
    expect(got).toMatchObject({ medal: 'gold', applicable: 2, passing: 2, moduleRelease: '1.1' });
    expect(got?.outcomes).toEqual([{ trialId: 'a', state: 'pass' }]);
  });

  // APPEND-ONLY. A second run must not replace the first.
  it('keeps earlier runs rather than overwriting them', async () => {
    const s = await store();
    await s.append(run({ runAt: '2026-09-05T10:00:00.000Z', medal: 'gold' }));
    await s.append(run({ runAt: '2026-09-05T11:00:00.000Z', medal: 'silver' }));
    const history = await s.history('component:default/site', 'website-hygiene');
    expect(history).toHaveLength(2);
    expect(history[0].medal).toBe('silver'); // newest first
    expect(await s.latest('component:default/site', 'website-hygiene')).toMatchObject({
      medal: 'silver',
    });
  });

  // An errored run does not destroy the last good one — that is the whole
  // reason the store appends rather than upserts.
  it('preserves the previous good run alongside an unevaluated one', async () => {
    const s = await store();
    await s.append(run({ runAt: '2026-09-05T10:00:00.000Z', medal: 'gold' }));
    await s.append(
      run({
        runAt: '2026-09-05T11:00:00.000Z',
        kind: 'unevaluated',
        medal: null,
        applicable: null,
        passing: null,
        outcomes: null,
        unevaluatedReason: 'no-standard',
        unevaluatedDetail: 'HTTP 404',
      }),
    );
    const history = await s.history('component:default/site', 'website-hygiene');
    expect(history[0]).toMatchObject({
      kind: 'unevaluated',
      medal: null,
      applicable: null,
      unevaluatedReason: 'no-standard',
      unevaluatedDetail: 'HTTP 404',
    });
    expect(history[1]).toMatchObject({ medal: 'gold', applicable: 2 });
  });

  it('stores null counts as null rather than zero', async () => {
    // Zero is a real, different claim: the standard loaded and nothing applied.
    const s = await store();
    await s.append(
      run({ kind: 'unevaluated', medal: null, applicable: null, passing: null, outcomes: null }),
    );
    const got = await s.latest('component:default/site', 'website-hygiene');
    expect(got?.applicable).toBeNull();
    expect(got?.passing).toBeNull();
  });

  it('keeps a real zero as zero', async () => {
    // The other side of the same distinction: a standard that loaded and
    // applied nothing genuinely has zero applicable trials.
    const s = await store();
    await s.append(run({ applicable: 0, passing: 0, medal: 'none' }));
    const got = await s.latest('component:default/site', 'website-hygiene');
    expect(got?.applicable).toBe(0);
    expect(got?.passing).toBe(0);
  });

  it('keeps subjects apart', async () => {
    const s = await store();
    await s.append(run());
    await s.append(run({ entityRef: 'component:default/other', medal: 'bronze' }));
    expect(await s.latest('component:default/other', 'website-hygiene')).toMatchObject({
      medal: 'bronze',
    });
  });

  // RETENTION, two-tier (design §8). Recent runs stay at full resolution and
  // older days collapse to one, so a fixed row budget reaches most of a year
  // instead of three weeks.
  describe('prune', () => {
    // Pinned to midday UTC rather than derived from the wall clock. The
    // day-collapse tier buckets by UTC calendar day, so hour offsets taken from
    // `Date.now()` land either side of midnight depending on when the suite
    // runs — a test that passes all afternoon and fails at 23:30. Midday leaves
    // twelve hours of headroom in both directions.
    const NOW = Date.parse('2026-09-08T12:00:00.000Z');
    const ago = (days: number, hour: number) =>
      new Date(NOW - days * 86_400_000 + hour * 3_600_000).toISOString();
    const pruneOpts = (over: { keep: number; hourlyDays: number }) => ({ ...over, now: NOW });

    it('keeps every run inside the hourly window', async () => {
      const s = await store();
      for (const hour of [0, 1, 2, 3]) {
        await s.append(run({ runAt: ago(1, hour), medal: 'gold' }));
      }
      await s.prune(pruneOpts({ keep: 500, hourlyDays: 7 }));
      expect(await s.history('component:default/site', 'website-hygiene')).toHaveLength(4);
    });

    // THE ONE THAT MATTERS. Beyond the window a day collapses to its WORST run,
    // not its newest — otherwise an outage that recovered before midnight
    // disappears from the chart entirely, which is the day a reader is looking
    // for.
    it('collapses an older day to its worst run, not its latest', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(30, 1), medal: 'gold' }));
      await s.append(run({ runAt: ago(30, 2), medal: 'bronze' }));
      await s.append(run({ runAt: ago(30, 3), medal: 'gold' }));

      await s.prune(pruneOpts({ keep: 500, hourlyDays: 7 }));

      const kept = await s.history('component:default/site', 'website-hygiene');
      expect(kept).toHaveLength(1);
      expect(kept[0].medal).toBe('bronze');
    });

    it('ranks an unevaluated day as worse than any medal', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(30, 1), medal: 'gold' }));
      await s.append(
        run({
          runAt: ago(30, 2),
          kind: 'unevaluated',
          medal: null,
          applicable: null,
          passing: null,
          outcomes: null,
          unevaluatedReason: 'no-standard',
        }),
      );
      await s.prune(pruneOpts({ keep: 500, hourlyDays: 7 }));

      const kept = await s.history('component:default/site', 'website-hygiene');
      expect(kept).toHaveLength(1);
      expect(kept[0].kind).toBe('unevaluated');
    });

    // The cap must order by RUN TIME, not row id. Appending oldest-last makes
    // insertion order the reverse of chronological order, so a cap that sorts
    // by id keeps exactly the wrong two. Asserting the count alone would pass
    // either way.
    it('caps to the NEWEST runs even when they were inserted oldest-last', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(10, 1), medal: 'gold' }));
      await s.append(run({ runAt: ago(20, 1), medal: 'silver' }));
      await s.append(run({ runAt: ago(30, 1), medal: 'bronze' }));
      await s.append(run({ runAt: ago(40, 1), medal: 'none' }));

      await s.prune(pruneOpts({ keep: 2, hourlyDays: 7 }));

      const kept = await s.history('component:default/site', 'website-hygiene');
      expect(kept).toHaveLength(2);
      expect(kept.map(r => r.medal)).toEqual(['gold', 'silver']);
    });

    it('leaves other subjects untouched', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(30, 1) }));
      await s.append(run({ runAt: ago(30, 2), entityRef: 'component:default/other' }));
      await s.prune(pruneOpts({ keep: 500, hourlyDays: 7 }));
      expect(await s.history('component:default/other', 'website-hygiene')).toHaveLength(1);
    });

    it('reports how many rows it removed', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(30, 1), medal: 'gold' }));
      await s.append(run({ runAt: ago(30, 2), medal: 'gold' }));
      expect(await s.prune(pruneOpts({ keep: 500, hourlyDays: 7 }))).toBe(1);
    });
  });
});
