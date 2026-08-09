import {
  parseGuildhallThemes,
  collectSpecTypes,
  resolveUsage,
  parseCandidates,
  saturationOf,
  specTypeOf,
  entityNameOf,
  renderSwatchPage,
  FALLBACK_THEME_ID,
} from './theme-swatches';

describe('parseGuildhallThemes', () => {
  it('reads ids, colour stops and shapes out of the real source shape', () => {
    const src = `
export const guildhallPageThemes: Record<string, PageTheme> = {
  guild: genPageTheme({ colors: ['#6A1B9A', '#8E24AA'], shape: shapes.wave }),
  practice: genPageTheme({ colors: ['#4527A0', '#5E35B1'], shape: shapes.round }),
};`;
    expect(parseGuildhallThemes(src)).toEqual([
      { id: 'guild', colors: ['#6A1B9A', '#8E24AA'], shape: 'wave', source: 'guildhall' },
      { id: 'practice', colors: ['#4527A0', '#5E35B1'], shape: 'round', source: 'guildhall' },
    ]);
  });

  it('survives comments between entries', () => {
    const src = `
  // --- Instance structure: the substrate.
  plugin: genPageTheme({ colors: ['#4E4361', '#7C6E96'], shape: shapes.round }),`;
    expect(parseGuildhallThemes(src).map(t => t.id)).toEqual(['plugin']);
  });

  it('returns nothing when the format changes, so the runner can fail loudly', () => {
    expect(parseGuildhallThemes('export const x = makeTheme("purple");')).toEqual([]);
  });
});

describe('specTypeOf', () => {
  it('reads the flow-mapping form', () => {
    expect(specTypeOf('spec: { type: service, lifecycle: production }')).toBe('service');
  });

  it('reads the block form', () => {
    expect(specTypeOf('spec:\n  type: practice\n  owner: group:default/x')).toBe('practice');
  });

  it('strips quotes', () => {
    expect(specTypeOf("spec:\n  type: 'instance'")).toBe('instance');
  });

  it('ignores a nested type far below spec — a Template parameter is not the entity type', () => {
    const doc = [
      'spec:',
      '  type: aspect',
      '  parameters:',
      '    properties:',
      '      name:',
      '        type: string',
    ].join('\n');
    expect(specTypeOf(doc)).toBe('aspect');
  });

  it('does not mistake a deep parameter type for a missing spec.type', () => {
    const doc = ['spec:', '  parameters:', '    properties:', '      x:', '        type: string'].join('\n');
    expect(specTypeOf(doc)).toBeUndefined();
  });

  it('stops at the next top-level key', () => {
    expect(specTypeOf('spec:\n  owner: x\nmetadata:\n  type: nope')).toBeUndefined();
  });
});

describe('entityNameOf', () => {
  it('reads both YAML shapes', () => {
    expect(entityNameOf('metadata: { name: tracking-web }')).toBe('tracking-web');
    expect(entityNameOf('metadata:\n  name: leidangr\n  title: Leiðangr')).toBe('leidangr');
  });
});

describe('collectSpecTypes', () => {
  const files = [
    {
      path: 'software.yaml',
      text: [
        'apiVersion: backstage.io/v1alpha1',
        'kind: Component',
        'metadata: { name: tracking-web }',
        'spec: { type: website, lifecycle: production }',
        '---',
        'apiVersion: backstage.io/v1alpha1',
        'kind: Component',
        'metadata: { name: label-service }',
        'spec: { type: service, lifecycle: production }',
      ].join('\n'),
    },
    {
      path: 'catalog-info.yaml',
      text: ['kind: System', 'metadata:', '  name: leidangr', 'spec:', '  owner: group:default/x'].join('\n'),
    },
  ];

  it('groups entity names by spec.type across files and documents', () => {
    const found = collectSpecTypes(files);
    expect(found.get('website')).toEqual(['tracking-web']);
    expect(found.get('service')).toEqual(['label-service']);
  });

  it('buckets entities with no spec.type as untyped — they are the fallback victims', () => {
    expect(collectSpecTypes(files).get('(untyped)')).toEqual(['leidangr']);
  });

  it('skips documents that are not entities', () => {
    const found = collectSpecTypes([{ path: 'app-config.yaml', text: 'app:\n  title: x' }]);
    expect(found.size).toBe(0);
  });
});

describe('resolveUsage', () => {
  const types = new Map([
    ['practice', ['security-practice']],
    ['plugin', ['gildi']],
    ['(untyped)', ['siliconsaga']],
  ]);

  it('marks registered types as resolving to themselves', () => {
    const [, plugin] = resolveUsage(types, new Set(['practice', 'plugin']));
    expect(plugin).toMatchObject({ specType: 'plugin', resolvesTo: 'plugin', registered: true });
  });

  it('sends unregistered and untyped entities to the fallback', () => {
    const resolved = resolveUsage(types, new Set(['practice']));
    const plugin = resolved.find(u => u.specType === 'plugin');
    const untyped = resolved.find(u => u.specType === '(untyped)');
    expect(plugin).toMatchObject({ resolvesTo: FALLBACK_THEME_ID, registered: false });
    expect(untyped).toMatchObject({ resolvesTo: FALLBACK_THEME_ID, registered: false });
  });

  it('never treats the untyped bucket as registered even if something claims that name', () => {
    const resolved = resolveUsage(types, new Set(['(untyped)']));
    expect(resolved.find(u => u.specType === '(untyped)')!.registered).toBe(false);
  });
});

describe('parseCandidates', () => {
  it('parses a name, its stops and an optional note', () => {
    expect(parseCandidates(['--candidate', 'plum:#4A1942,#7A2E63:past guild'])).toEqual([
      { id: 'plum', colors: ['#4A1942', '#7A2E63'], source: 'candidate', note: 'past guild' },
    ]);
  });

  it('accepts several and ignores unrelated args', () => {
    const got = parseCandidates(['--out', 'x.html', '--candidate', 'a:#111111', '--candidate', 'b:#222222']);
    expect(got.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('rejects a malformed value rather than silently proposing nothing', () => {
    expect(() => parseCandidates(['--candidate', 'nope'])).toThrow(/could not parse/);
    expect(() => parseCandidates(['--candidate'])).toThrow(/needs a value/);
  });
});

describe('saturationOf', () => {
  it('separates the saturated practice band from the quiet instance band', () => {
    expect(saturationOf('#6A1B9A')).toBeGreaterThan(0.7); // guild
    expect(saturationOf('#4E4361')).toBeLessThan(0.45); // plugin
  });

  it('is zero for greys', () => {
    expect(saturationOf('#383838')).toBe(0);
  });
});

describe('renderSwatchPage', () => {
  const page = renderSwatchPage({
    themes: [
      { id: 'home', colors: ['#005B4B'], source: 'backstage' },
      { id: 'plugin', colors: ['#4E4361', '#7C6E96'], shape: 'round', source: 'guildhall' },
    ],
    usage: [
      { specType: 'plugin', entities: ['gildi'], resolvesTo: 'plugin', registered: true },
      { specType: 'cluster', entities: ['prod-cluster'], resolvesTo: 'home', registered: false },
    ],
    candidates: [{ id: 'plum', colors: ['#4A1942', '#7A2E63'], source: 'candidate', note: 'bolder' }],
    generatedAt: '2026-08-09 10:00 UTC',
  });

  it('renders a gradient for every colour it was given', () => {
    expect(page).toContain('linear-gradient(90deg, #4E4361, #7C6E96)');
    expect(page).toContain('linear-gradient(90deg, #4A1942, #7A2E63)');
  });

  it('repeats a single stop so one-colour themes still render a gradient', () => {
    expect(page).toContain('linear-gradient(90deg, #005B4B, #005B4B)');
  });

  it('calls out types that fall through to the fallback', () => {
    expect(page).toContain('cluster → home');
  });

  it('is self-contained — no network requests can be blocked', () => {
    expect(page).not.toMatch(/https?:\/\//);
  });

  it('styles both colour schemes', () => {
    expect(page).toContain('prefers-color-scheme: dark');
    expect(page).toContain("[data-theme='light']");
  });
});
