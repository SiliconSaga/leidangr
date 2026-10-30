import { SCENARIOS, asOfFor } from './history-swatches';
import { pairsIn, plan, rebase } from './dev-history';

const NOW = Date.parse('2026-10-29T12:00:00.000Z');

const entity = (name: string, aspects?: string, namespace?: string) => ({
  metadata: {
    name,
    ...(namespace ? { namespace } : {}),
    annotations: aspects ? { 'siliconsaga.org/aspects': aspects } : {},
  },
});

describe('pairsIn', () => {
  it('finds one pair per aspect a component has adopted', () => {
    expect(pairsIn([entity('site', 'website-hygiene, security')])).toEqual([
      { entityRef: 'component:default/site', aspectId: 'website-hygiene' },
      { entityRef: 'component:default/site', aspectId: 'security' },
    ]);
  });

  it('ignores components that have adopted nothing', () => {
    expect(pairsIn([entity('plain'), entity('blank', '  ')])).toEqual([]);
  });

  // ⚠ THE SPELLING HAS TO MATCH THE STORE'S, AND THE TWO HALVES DIFFER.
  // Backstage canonicalises kind, namespace and name to lower case, so a row
  // seeded as `MySite` is requested as `mysite` and the two never meet. An
  // aspect id goes through nothing of the kind — the sweep trims the annotation
  // and stores it verbatim — so folding ITS case is the same permanent empty
  // chart in the other direction, and this test is the only place that says so.
  it('canonicalises the reference but leaves the aspect id spelt as adopted', () => {
    expect(pairsIn([entity('MySite', 'Website-Hygiene', 'Prod')])).toEqual([
      { entityRef: 'component:prod/mysite', aspectId: 'Website-Hygiene' },
    ]);
  });

  it('survives a response that is not a list of entities', () => {
    expect(pairsIn(undefined)).toEqual([]);
    expect(pairsIn({ items: [] })).toEqual([]);
    expect(pairsIn([null, 42, {}])).toEqual([]);
  });
});

describe('rebase', () => {
  const holding = SCENARIOS.find(s => s.title === 'Holding gold')!;
  const stale = SCENARIOS.find(s => s.title === 'Nobody has looked in weeks')!;

  it('keeps every interval between the runs', () => {
    const gaps = (runs: { runAt: string }[]) =>
      runs.slice(1).map((r, i) => Date.parse(r.runAt) - Date.parse(runs[i].runAt));
    expect(gaps(rebase(holding, NOW))).toEqual(gaps(holding.runs));
  });

  // ⚠ WHAT MAKES THE STALE CASE STALE. The scenario's distance from its own
  // `asOf` is the whole fixture; dropping it would land every scenario's newest
  // run on `now` and the stopped-sweep case would draw as a healthy one.
  it('preserves each scenario distance from now, so the stale case stays stale', () => {
    const newest = (runs: { runAt: string }[]) =>
      Math.max(...runs.map(r => Date.parse(r.runAt)));

    // "Holding gold" has no `asOf`, so its newest run IS now.
    expect(newest(rebase(holding, NOW))).toBe(NOW);

    const behind = asOfFor(stale) - newest(stale.runs);
    expect(behind).toBeGreaterThan(0);
    expect(newest(rebase(stale, NOW))).toBe(NOW - behind);
  });

  it('writes timestamps the store can parse back', () => {
    for (const run of rebase(holding, NOW)) {
      expect(run.runAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    }
  });
});

describe('plan', () => {
  const pairs = [
    { entityRef: 'component:default/b', aspectId: 'security' },
    { entityRef: 'component:default/a', aspectId: 'website-hygiene' },
  ];

  // ⚠ DETERMINISTIC, because a stack that seeds something different each time
  // cannot be used to check whether a change to the chart did what it claimed.
  // The catalog promises no order, so the pairs are sorted before assignment.
  it('assigns the same scenario to the same pair however the catalog ordered it', () => {
    const forward = plan(pairs, NOW);
    const reversed = plan([...pairs].reverse(), NOW);
    expect(forward.map(p => [p.entityRef, p.scenario])).toEqual(
      reversed.map(p => [p.entityRef, p.scenario]),
    );
  });

  it('gives each pair a different scenario while there are scenarios left', () => {
    const titles = plan(pairs, NOW).map(p => p.scenario);
    expect(new Set(titles).size).toBe(2);
  });

  it('cycles rather than running out when there are more pairs than scenarios', () => {
    const many = Array.from({ length: SCENARIOS.length + 2 }, (_, i) => ({
      entityRef: `component:default/c${i}`,
      aspectId: 'website-hygiene',
    }));
    const out = plan(many, NOW);
    expect(out).toHaveLength(many.length);
    expect(out.every(p => p.runs.length > 0)).toBe(true);
  });

  it('keeps the pair on every run it plans, so nothing is seeded to the wrong subject', () => {
    for (const p of plan(pairs, NOW)) {
      // The endpoint takes the subject from its URL and overrides the body, so
      // this is belt and braces — but a plan that named the wrong component
      // would be read by a human first, and should not lie to them.
      expect(p.runs.every(r => r.aspectId === p.aspectId)).toBe(true);
    }
  });

  it('plans nothing for no pairs', () => {
    expect(plan([], NOW)).toEqual([]);
  });
});
