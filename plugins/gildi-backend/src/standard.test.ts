import type { Entity } from '@backstage/catalog-model';
import { loadStandard, standardUrlFor } from './standard';

const practice = (annotations: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'website-hygiene-practice', annotations },
  spec: { type: 'practice' },
});

describe('standardUrlFor', () => {
  it('resolves the annotation against the entity source location', () => {
    expect(
      standardUrlFor(
        practice({
          'siliconsaga.org/standard': './standard.yaml',
          'backstage.io/source-location':
            'url:https://github.com/SiliconSaga/volundr/tree/main/aspect/',
        }),
      ),
    ).toBe('https://github.com/SiliconSaga/volundr/tree/main/aspect/standard.yaml');
  });

  it('appends the missing separator when the source location has none', () => {
    // A location ref without a trailing slash would otherwise resolve the
    // relative path against the PARENT directory, silently reading the wrong
    // module's standard when two sit side by side.
    expect(
      standardUrlFor(
        practice({
          'siliconsaga.org/standard': './standard.yaml',
          'backstage.io/source-location':
            'url:https://github.com/SiliconSaga/volundr/tree/main/aspect',
        }),
      ),
    ).toBe('https://github.com/SiliconSaga/volundr/tree/main/aspect/standard.yaml');
  });

  it('is undefined when the practice declares no standard', () => {
    // Not an error: the seeded security practice has no standard annotation.
    expect(
      standardUrlFor(
        practice({
          'backstage.io/source-location': 'url:https://example.com/aspect/',
        }),
      ),
    ).toBeUndefined();
  });

  it('is undefined when the entity has no source location', () => {
    expect(
      standardUrlFor(practice({ 'siliconsaga.org/standard': './standard.yaml' })),
    ).toBeUndefined();
  });

  it('is undefined for a source location that is not a parseable ref', () => {
    expect(
      standardUrlFor(
        practice({
          'siliconsaga.org/standard': './standard.yaml',
          'backstage.io/source-location': 'not-a-location-ref',
        }),
      ),
    ).toBeUndefined();
  });
});

describe('loadStandard', () => {
  const readerReturning = (body: string) =>
    ({
      readUrl: async () => ({ buffer: async () => Buffer.from(body, 'utf8') }),
    }) as any;

  const WELL_FORMED = `
standard:
  id: website-hygiene
  aspect: website-hygiene
  blocks:
    - id: build
      appliesTo: [web-ui]
      trials:
        - id: gemfile-present
          rule: r
          artifact: Gemfile
          factSource: repo-files
          check: { type: file-contains, value: github-pages }
          remediation: ./docs/adopting.md
`;

  it('parses the standard body', async () => {
    const std = await loadStandard(
      readerReturning(WELL_FORMED),
      'https://example.com/standard.yaml',
    );
    expect(std.id).toBe('website-hygiene');
    expect(std.blocks[0].trials[0].check).toEqual({
      type: 'file-contains',
      value: 'github-pages',
    });
  });

  it('rejects a body with no standard key rather than returning a hollow object', async () => {
    // Returning `{}` here would produce an empty applicable set, which derives
    // medal `none` — a confident verdict about a component built on our own
    // failure to read the file. See design §7.
    await expect(
      loadStandard(readerReturning('something: else'), 'https://example.com/standard.yaml'),
    ).rejects.toThrow(/invalid standard/i);
  });

  // Shape faults reach us the same way a missing file does, and through the
  // SAME validator that keeps volundr's file honest. A second structural check
  // written here would be free to drift from that one.
  it('rejects a standard whose shape is wrong, naming the fault', async () => {
    await expect(
      loadStandard(
        readerReturning(WELL_FORMED.replace('file-contains', 'file-contins')),
        'https://example.com/standard.yaml',
      ),
    ).rejects.toThrow(/unknown check type file-contins/);
  });

  it('rejects malformed YAML', async () => {
    await expect(
      loadStandard(readerReturning('standard: [oops'), 'https://example.com/standard.yaml'),
    ).rejects.toThrow();
  });

  it('does not require a remediation to resolve, because it cannot check', async () => {
    // The file is fetched over the network, so there is no directory to
    // resolve `./docs/adopting.md` against. Presence is checked, existence is
    // not — that finding belongs to the caller holding a path.
    const std = await loadStandard(
      readerReturning(WELL_FORMED),
      'https://example.com/standard.yaml',
    );
    expect(std.blocks[0].trials[0].remediation).toBe('./docs/adopting.md');
  });
});
