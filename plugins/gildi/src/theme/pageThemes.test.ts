import { guildhallPageThemes } from './pageThemes';

const PRACTICE_LAYER = ['guild', 'practice', 'aspect'] as const;
const INSTANCE_STRUCTURE = ['community', 'instance', 'plugin'] as const;
const BOUNDED_EFFORTS = ['release', 'drive', 'season'] as const;

describe('guildhallPageThemes', () => {
  it('defines the practice-layer, instance-structure and Cycle page themes', () => {
    expect(Object.keys(guildhallPageThemes).sort()).toEqual([
      'aspect', 'community', 'drive', 'guild', 'instance', 'plugin', 'practice',
      'release', 'season',
    ]);
  });

  it.each([...PRACTICE_LAYER, ...INSTANCE_STRUCTURE, ...BOUNDED_EFFORTS])(
    '%s is a renderable PageTheme with a gradient and white text',
    key => {
      const pt = guildhallPageThemes[key];
      expect(pt.backgroundImage).toContain('linear-gradient');
      expect(pt.fontColor.toUpperCase()).toBe('#FFFFFF');
    },
  );

  // Every key must be a literal spec.type: EntityLayout resolves themes with
  // `entity?.spec?.type ?? 'home'` and never looks at the kind, so a key named
  // after a kind (system, domain) would silently never match.
  it('claims no key that collides with a Backstage default', () => {
    const defaults = ['home', 'documentation', 'tool', 'service', 'website',
      'library', 'other', 'app', 'apis', 'card'];
    for (const key of Object.keys(guildhallPageThemes)) {
      expect(defaults).not.toContain(key);
    }
  });

  const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

  const contrastWithWhite = (hex: string) => {
    const lin = channels(hex)
      .map(c => c / 255)
      .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const luminance = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return 1.05 / (luminance + 0.05);
  };

  // 3:1 is the WCAG AA bar for LARGE text, which is what a page theme backs —
  // Backstage renders the entity title over this gradient at heading scale.
  //
  // Not 4.5:1, and that is measured rather than assumed. Lifting `season` to
  // 4.5 means darkening it to roughly #8C6E23, which collapses its protanopia
  // separation from `drive` from ΔE 19 to 9 — trading a large-text contrast
  // gain for a red-green collision affecting ~8% of men. The lightness spread
  // across the Cycle set is load-bearing and wins.
  //
  // Caveat worth knowing: the same themes tint Ownership card tiles, whose text
  // is smaller. If a tile ever needs to clear 4.5, that is a reason to restyle
  // the tile rather than to flatten this palette.
  it('clears the large-text contrast bar for white header text on every stop', () => {
    for (const [id, theme] of Object.entries(guildhallPageThemes)) {
      for (const hex of theme.colors) {
        const ratio = contrastWithWhite(hex);
        expect({ id, hex, ratio: ratio >= 3 }).toEqual({ id, hex, ratio: true });
      }
    }
  });

  it('renders white text, which is what the contrast bar above is measured against', () => {
    for (const theme of Object.values(guildhallPageThemes)) {
      expect(theme.fontColor.toUpperCase()).toBe('#FFFFFF');
    }
  });

  it('keeps instance-structure colours out of the saturated practice band', () => {
    // The substrate reads as kin by hue but quieter by saturation. If someone
    // later brightens these, this fails rather than letting the two tiers blur.
    for (const key of INSTANCE_STRUCTURE) {
      for (const hex of guildhallPageThemes[key].colors) {
        const [r, g, b] = channels(hex);
        const max = Math.max(r, g, b);
        const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
        expect(saturation).toBeLessThan(0.45);
      }
    }
  });

  it('keeps the Cycle colours warm, so bounded efforts never read as structure', () => {
    // Red dominant and blue least: that is the whole warm claim. Stated as a
    // channel ordering rather than a hex list so a future reshade still has to
    // stay warm to pass.
    for (const key of BOUNDED_EFFORTS) {
      for (const hex of guildhallPageThemes[key].colors) {
        const [r, g, b] = channels(hex);
        expect(r).toBeGreaterThan(g);
        expect(g).toBeGreaterThan(b);
      }
    }
  });

  it('clears the hues Backstage already holds at the red end', () => {
    // `app` is vermilion #BE2200 and `library` ruby #98002B. Requiring a real
    // green channel keeps the Cycle set in amber/gold rather than drifting down
    // into either of those.
    for (const key of BOUNDED_EFFORTS) {
      for (const hex of guildhallPageThemes[key].colors) {
        const [r, g] = channels(hex);
        expect(g / r).toBeGreaterThan(0.35);
      }
    }
  });
});
