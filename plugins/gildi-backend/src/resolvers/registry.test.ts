import { resolverFor } from './registry';

describe('resolverFor', () => {
  it.each(['repo-files', 'github-pages-api'])('resolves %s', kind => {
    expect(resolverFor(kind)).toBeDefined();
  });

  // The mock security standard declares these and nothing implements them.
  // Returning undefined is what makes the caller record unmeasured{no-resolver}
  // rather than a pass — the failure that would silently inflate every medal.
  it.each(['ci-pipeline-results', 'catalog-annotations', 'aspect-repo', 'nonsense'])(
    'returns undefined for %s',
    kind => {
      expect(resolverFor(kind)).toBeUndefined();
    },
  );

  it('does not resolve a padded name, which would match nothing downstream', () => {
    expect(resolverFor(' repo-files ')).toBeUndefined();
  });
});
