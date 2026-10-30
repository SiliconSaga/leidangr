// Planning logic for `make dev-history`: which fabricated history goes on which
// component, and at what times. The HTTP is in run-dev-history.mjs.
//
// ⚠ WHY THE SCENARIOS ARE REUSED RATHER THAN WRITTEN AGAIN. The preview page
// already defines the histories the chart was designed against — the gap, the
// measured fall, the release bump, the stopped sweep. Seeding those SAME cases
// into a running stack means the chart in the app and the chart on the preview
// page are the same picture, so looking at the app checks the preview as well as
// the component. A second set of fixtures here would be a second thing to keep
// honest, and the first time they drifted the preview would stop being evidence.
//
// ⚠ AND WHY `asOf` IS THE ANCHOR. Each scenario states when "now" is relative to
// its runs — that offset is what makes the stale case stale. Shifting every run
// by `now - asOf` reproduces that relationship against the real clock, so the
// app renders what the page renders rather than something merely similar.

import type { TrialRun } from '@siliconsaga/plugin-gildi-common';
import { SCENARIOS, type Scenario, asOfFor } from './history-swatches.ts';

/** An entity-and-aspect pair to seed, as the catalog describes it. */
export interface Pair {
  entityRef: string;
  aspectId: string;
}

export interface SeedPlan {
  entityRef: string;
  aspectId: string;
  scenario: string;
  runs: TrialRun[];
}

/**
 * The scenario's runs moved onto the real clock, keeping every interval between
 * them and keeping the scenario's own distance from "now".
 *
 * Runs with an unparseable timestamp are dropped rather than shifted: the chart
 * drops them too, so seeding one would quietly test nothing.
 */
export function rebase(scenario: Scenario, now: number): TrialRun[] {
  const shift = now - asOfFor(scenario);
  return scenario.runs
    .filter(run => Number.isFinite(Date.parse(run.runAt)))
    .map(run => ({
      ...run,
      runAt: new Date(Date.parse(run.runAt) + shift).toISOString(),
    }));
}

/**
 * One scenario per pair, cycling through the list in order.
 *
 * Deterministic rather than random: a seeded stack that draws something
 * different on every run cannot be used to check whether a change to the chart
 * did what it claimed. The pairs arrive sorted for the same reason — the catalog
 * does not promise an order, and an unstable assignment would move the
 * scenarios between components on each seeding.
 *
 * Returns the plan without sending anything, so what is about to be written can
 * be printed and read first.
 */
export function plan(
  pairs: Pair[],
  now: number,
  scenarios: Scenario[] = SCENARIOS,
): SeedPlan[] {
  if (scenarios.length === 0) return [];
  const sorted = [...pairs].sort((a, b) =>
    `${a.entityRef} ${a.aspectId}`.localeCompare(`${b.entityRef} ${b.aspectId}`),
  );
  return sorted.map((pair, i) => {
    const scenario = scenarios[i % scenarios.length];
    return {
      entityRef: pair.entityRef,
      aspectId: pair.aspectId,
      scenario: scenario.title,
      // The subject is restated on every run. The endpoint takes it from the URL
      // and overrides the body anyway, so this changes nothing on the wire — but
      // the plan is printed for a human first, and it should not name a
      // component the run is not for.
      runs: rebase(scenario, now).map(run => ({
        ...run,
        entityRef: pair.entityRef,
        aspectId: pair.aspectId,
      })),
    };
  });
}

/**
 * The enrolled pairs in a catalog response, discovered rather than hardcoded —
 * the same annotation the sweep itself looks for.
 *
 * ⚠ THE ENTITY REF IS LOWERCASED AND THE ASPECT ID IS NOT, because that is what
 * the two sides actually do. `stringifyEntityRef` canonicalises kind, namespace
 * and name, so a ref has one spelling whatever the metadata says; an aspect id
 * has none — the sweep's `aspectsOf` trims the annotation and stores it
 * verbatim, and the card reads it back the same way. Folding its case here
 * would write `website-hygiene` under a component annotated `Website-Hygiene`,
 * and the chart would stay empty with nothing anywhere to say why.
 */
export function pairsIn(entities: unknown): Pair[] {
  const items = Array.isArray(entities) ? entities : [];
  const pairs: Pair[] = [];
  for (const raw of items) {
    // `raw?.metadata` and not `raw.metadata?`: the chain has to start at the
    // item. A response carrying a null in its list is a claim about the data,
    // not a fact about it, and this threw on exactly that.
    if (typeof raw !== 'object' || raw === null) continue;
    const entity = raw as {
      metadata?: { name?: string; namespace?: string; annotations?: Record<string, string> };
    };
    const name = entity.metadata?.name;
    if (!name) continue;
    const namespace = (entity.metadata?.namespace ?? 'default').toLowerCase();
    const aspects = (entity.metadata?.annotations?.['siliconsaga.org/aspects'] ?? '')
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);
    for (const aspectId of aspects) {
      pairs.push({
        entityRef: `component:${namespace}/${name.toLowerCase()}`,
        aspectId,
      });
    }
  }
  return pairs;
}
