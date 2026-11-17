import type { Entity } from '@backstage/catalog-model';
import type { Standard } from '@siliconsaga/plugin-gildi-common';
import { applicableTrials, facetsOf, unmatchedFacets } from './facets';

const trial = (id: string) => ({
  id,
  rule: 'r',
  artifact: 'a',
  factSource: 'repo-files',
  remediation: './fix.md',
});

const STANDARD: Standard = {
  id: 'website-hygiene',
  aspect: 'website-hygiene',
  facetDefaults: { website: ['web-ui'] },
  blocks: [
    { id: 'build', appliesTo: ['web-ui'], trials: [trial('gemfile')] },
    { id: 'any', appliesTo: ['*'], trials: [trial('everywhere')] },
    { id: 'apis', appliesTo: ['api'], trials: [trial('api-only')] },
  ],
};

const component = (spec: object, annotations?: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'site', ...(annotations ? { annotations } : {}) },
  spec: spec as Entity['spec'],
});

describe('facetsOf', () => {
  it('maps spec.type through facetDefaults', () => {
    expect(facetsOf(component({ type: 'website' }), STANDARD)).toEqual(['web-ui']);
  });

  it('lets the annotation override the default entirely', () => {
    // Override, not merge: a component declaring its facets is stating what it
    // IS, and silently adding the type's defaults back would make the
    // annotation unable to remove one.
    const e = component({ type: 'website' }, { 'siliconsaga.org/facets': 'api, batch' });
    expect(facetsOf(e, STANDARD)).toEqual(['api', 'batch']);
  });

  it('is empty for a type with no default and no annotation', () => {
    expect(facetsOf(component({ type: 'library' }), STANDARD)).toEqual([]);
  });

  it('is empty for an entity with no spec.type at all', () => {
    expect(facetsOf(component({}), STANDARD)).toEqual([]);
  });

  it('falls back to the default for a blank annotation rather than exempting the component', () => {
    // `facets: ""` is a half-finished edit, not a declaration of none. Reading
    // it as an opt-out would leave a component enrolled and asked nothing,
    // which looks identical to compliance.
    const e = component({ type: 'website' }, { 'siliconsaga.org/facets': '  ,  ' });
    expect(facetsOf(e, STANDARD)).toEqual(['web-ui']);
  });
});

describe('applicableTrials', () => {
  it('includes matching blocks and the wildcard, excluding the rest', () => {
    const ids = applicableTrials(component({ type: 'website' }), STANDARD).map(t => t.id);
    expect(ids).toEqual(['gemfile', 'everywhere']);
  });

  it('still includes the wildcard when nothing else matches', () => {
    // `*` means every component, including one whose facets are unknown. A
    // standard with a wildcard block always asks something.
    const ids = applicableTrials(component({ type: 'library' }), STANDARD).map(t => t.id);
    expect(ids).toEqual(['everywhere']);
  });

  it('returns an empty set rather than throwing when a standard has no blocks', () => {
    const empty: Standard = { id: 'x', aspect: 'x', blocks: [] };
    expect(applicableTrials(component({ type: 'website' }), empty)).toEqual([]);
  });
});

describe('unmatchedFacets', () => {
  const declaring = (facets: string) =>
    component({ type: 'website' }, { 'siliconsaga.org/facets': facets });

  // THE TYPO. `webui` for `web-ui` drops the component out of the build block
  // without a word, and it still looks enrolled.
  it('names a declared facet that no block applies to', () => {
    expect(unmatchedFacets(declaring('webui'), STANDARD)).toEqual(['webui']);
  });

  it('reports only the unmatched ones, in the order declared', () => {
    expect(unmatchedFacets(declaring('api, batch, web-ui, grpc'), STANDARD)).toEqual([
      'batch',
      'grpc',
    ]);
  });

  it('is empty when every declared facet selects a block', () => {
    expect(unmatchedFacets(declaring('web-ui, api'), STANDARD)).toEqual([]);
  });

  // A wildcard block applies to the component, but it does not make `webui`
  // mean anything. The facet still selected nothing of its own.
  it('is not satisfied by a wildcard block', () => {
    const wildcardOnly: Standard = {
      id: 'x',
      aspect: 'x',
      blocks: [{ id: 'any', appliesTo: ['*'], trials: [trial('everywhere')] }],
    };
    expect(unmatchedFacets(declaring('webui'), wildcardOnly)).toEqual(['webui']);
  });

  // Only the ANNOTATION is the component's claim. A type default that names no
  // block is the standard disagreeing with itself, and reporting it here would
  // put the same warning on every component of that type.
  it('ignores facets that came from the type default', () => {
    const orphanDefault: Standard = { ...STANDARD, facetDefaults: { website: ['grpc'] } };
    expect(unmatchedFacets(component({ type: 'website' }), orphanDefault)).toEqual([]);
  });

  it('is empty for a blank annotation', () => {
    expect(unmatchedFacets(declaring('  ,  '), STANDARD)).toEqual([]);
  });
});
