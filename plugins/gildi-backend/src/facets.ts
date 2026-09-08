import type { Entity } from '@backstage/catalog-model';
import type { Standard, Trial } from '@siliconsaga/plugin-gildi-common';

const FACETS_ANNOTATION = 'siliconsaga.org/facets';

// Same parsing as gildi's aspects.ts: trimmed, deduped, blanks dropped. A stray
// space is not cosmetic here — facets are compared for equality, so ' web-ui '
// matches nothing.
function parseList(value?: string): string[] {
  return [...new Set((value ?? '').split(',').map(s => s.trim()).filter(Boolean))];
}

/**
 * The facets a component presents to a standard.
 *
 * The annotation OVERRIDES the type default rather than merging with it. A
 * component declaring its facets is stating what it is, and merging would make
 * the annotation unable to remove a facet its type implies.
 *
 * A present-but-BLANK annotation falls back to the default rather than meaning
 * "no facets". `facets: ""` is overwhelmingly a half-finished edit, and reading
 * it as a deliberate opt-out would silently exempt a component from every trial
 * — the failure mode is a component that looks enrolled and is asked nothing.
 * A component that genuinely applies to nothing simply has no matching block.
 */
export function facetsOf(entity: Entity, standard: Standard): string[] {
  const declared = parseList(entity.metadata.annotations?.[FACETS_ANNOTATION]);
  if (declared.length > 0) {
    return declared;
  }
  const type = entity.spec?.type;
  if (typeof type !== 'string') {
    return [];
  }
  return standard.facetDefaults?.[type] ?? [];
}

/**
 * The trials that apply to this component, already filtered.
 *
 * `not applicable` is NOT an outcome (design §3) — a skipped trial is simply
 * absent from this list, which is what lets verdictFor keep its shape.
 */
export function applicableTrials(entity: Entity, standard: Standard): Trial[] {
  const facets = facetsOf(entity, standard);
  return (standard.blocks ?? [])
    .filter(b => (b.appliesTo ?? []).some(f => f === '*' || facets.includes(f)))
    .flatMap(b => b.trials ?? []);
}
