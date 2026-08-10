import {
  parseGuildhallThemes,
  collectSpecTypes,
  resolveUsage,
  parseCandidates,
  saturationOf,
  specTypeOf,
  entityNameOf,
  renderSwatchPage,
  simulateVision,
  contrastRatio,
  contrastWarnings,
  findConfusions,
  deltaE,
  VISIONS,
  FALLBACK_THEME_ID,
  type PageThemeEntry,
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

describe('simulateVision', () => {
  it('leaves colour untouched for normal vision', () => {
    expect(simulateVision('#4E4361', 'normal')).toBe('#4e4361');
  });

  it('returns a valid hex for every deficiency', () => {
    for (const v of VISIONS) {
      expect(simulateVision('#B85E1E', v)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('pulls red and green toward each other under deuteranopia', () => {
    // The defining confusion. Pure red and pure green are maximally far apart
    // normally and must measurably converge — if this ever fails the matrices
    // are wrong and every finding built on them is worthless.
    const normalGap = deltaE('#FF0000', '#00FF00');
    const simGap = deltaE(
      simulateVision('#FF0000', 'deuteranopia'),
      simulateVision('#00FF00', 'deuteranopia'),
    );
    expect(simGap).toBeLessThan(normalGap / 2);
  });

  it('leaves a blue/yellow pair largely alone under deuteranopia', () => {
    // The axis red-green deficiency does not touch — a sanity check that the
    // transform is selective rather than just washing everything out.
    const normalGap = deltaE('#0000FF', '#FFFF00');
    const simGap = deltaE(
      simulateVision('#0000FF', 'deuteranopia'),
      simulateVision('#FFFF00', 'deuteranopia'),
    );
    expect(simGap).toBeGreaterThan(normalGap * 0.6);
  });

  it('preserves greys, which have no chroma to confuse', () => {
    expect(simulateVision('#808080', 'protanopia')).toBe('#808080');
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is order independent', () => {
    expect(contrastRatio('#4E4361', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#4E4361'), 10);
  });
});

describe('findConfusions', () => {
  const entry = (id: string, hex: string): PageThemeEntry => ({ id, colors: [hex], source: 'backstage' });

  it('reports a red/green pair matched in lightness', () => {
    // Lightness-matched on purpose. A saturated red and green are NOT reported,
    // because red simulates darker than green and the pair stays separable by
    // lightness — which is the whole reason lightness is the axis to design on.
    const found = findConfusions([entry('rust', '#96581E'), entry('olive', '#7A6A1E')]);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(c => c.vision === 'protanopia' || c.vision === 'deuteranopia')).toBe(true);
  });

  it('does not report a saturated red/green pair that lightness still separates', () => {
    expect(findConfusions([entry('stop', '#A02020'), entry('go', '#20A020')])).toEqual([]);
  });

  it('stays quiet for a pair that separates on lightness', () => {
    expect(findConfusions([entry('deep', '#1B1030'), entry('pale', '#D9D0EC')])).toEqual([]);
  });

  it('does not report pairs that already look alike to everyone', () => {
    // Not an accessibility regression — just two similar colours.
    expect(findConfusions([entry('a', '#4E4361'), entry('b', '#4F4462')])).toEqual([]);
  });

  // The real guard: if a future colour choice collides under simulation, this
  // fails in CI rather than waiting for someone to notice on a page.
  const shipped = (): PageThemeEntry[] => [
    entry('guild', '#6A1B9A'), entry('practice', '#4527A0'), entry('aspect', '#7E57C2'),
    entry('community', '#7A5450'), entry('instance', '#37304A'), entry('plugin', '#4E4361'),
    entry('release', '#5A2A0C'), entry('drive', '#8A520B'), entry('season', '#A5832A'),
  ];

  it('clears the shipped palette of every red-green collision', () => {
    // Protanopia and deuteranopia together affect roughly 8% of men, so these
    // are treated as defects rather than trade-offs.
    const redGreen = findConfusions(shipped()).filter(
      c => c.vision === 'protanopia' || c.vision === 'deuteranopia',
    );
    expect(redGreen).toEqual([]);
  });

  it('clears the shipped palette under tritanopia too, with no standing exceptions', () => {
    // There was one accepted exception (aspect against community) while
    // community was still a purple. Moving it to clay removed it, so the
    // palette now has none — asserted as empty rather than deleted, because an
    // exception creeping back in should have to be argued for again.
    const tritan = findConfusions(shipped()).filter(c => c.vision === 'tritanopia');
    expect(tritan).toEqual([]);
  });
});

describe('contrastWarnings', () => {
  it('flags a stop too light for white header text', () => {
    const warnings = contrastWarnings([{ id: 'pale', colors: ['#EEDD99'], source: 'candidate' }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].ratio).toBeLessThan(3);
  });

  it('passes the shipped Cycle colours, which were picked dark enough on purpose', () => {
    const cycles: PageThemeEntry[] = [
      { id: 'release', colors: ['#8F4212', '#B85E1E'], source: 'guildhall' },
      { id: 'drive', colors: ['#9A5C08', '#C57F16'], source: 'guildhall' },
      { id: 'season', colors: ['#7E6510', '#AA8A1E'], source: 'guildhall' },
    ];
    expect(contrastWarnings(cycles)).toEqual([]);
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

  it('renders the unsimulated gradient for every colour it was given', () => {
    // Lowercase: simulateVision normalises, and every bar is emitted through it
    // so the four vision variants stay directly comparable.
    expect(page).toContain('--normal: linear-gradient(90deg, #4e4361, #7c6e96)');
    expect(page).toContain('--normal: linear-gradient(90deg, #4a1942, #7a2e63)');
  });

  it('repeats a single stop so one-colour themes still render a gradient', () => {
    expect(page).toContain('--normal: linear-gradient(90deg, #005b4b, #005b4b)');
  });

  it('carries all four vision variants on every bar so the radios can repaint', () => {
    for (const v of VISIONS) expect(page).toContain(`--${v}: linear-gradient`);
  });

  it('offers a real radio per vision rather than a script-driven toggle', () => {
    for (const v of VISIONS) expect(page).toContain(`id="v-${v}"`);
    expect(page).not.toContain('<script');
  });

  it('calls out types that fall through to the fallback', () => {
    expect(page).toContain('cluster → home');
  });

  it('separates findings we own from stock collisions we cannot fix', () => {
    const grouped = renderSwatchPage({
      themes: [
        { id: 'home', colors: ['#005B4B'], source: 'backstage' },
        { id: 'apis', colors: ['#005B4B'], source: 'backstage' },
        { id: 'rust', colors: ['#96581E'], source: 'guildhall' },
        { id: 'olive', colors: ['#7A6A1E'], source: 'guildhall' },
      ],
      usage: [],
      candidates: [],
      generatedAt: 'now',
    });
    expect(grouped).toContain('Ours — fix these');
    expect(grouped).toContain('<strong>rust</strong> and <strong>olive</strong>');
  });

  it('reports a clean bill only about colours we define', () => {
    const clean = renderSwatchPage({
      themes: [{ id: 'plugin', colors: ['#4E4361'], source: 'guildhall' }],
      usage: [],
      candidates: [],
      generatedAt: 'now',
    });
    expect(clean).toContain('Nothing of ours collides');
  });

  it('is self-contained — no network requests can be blocked', () => {
    expect(page).not.toMatch(/https?:\/\//);
  });

  it('styles both colour schemes', () => {
    expect(page).toContain('prefers-color-scheme: dark');
    expect(page).toContain("[data-theme='light']");
  });
});
