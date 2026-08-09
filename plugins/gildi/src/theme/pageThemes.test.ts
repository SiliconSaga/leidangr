import { guildhallPageThemes } from './pageThemes';

const PRACTICE_LAYER = ['guild', 'practice', 'aspect'] as const;
const INSTANCE_STRUCTURE = ['community', 'instance', 'plugin'] as const;

describe('guildhallPageThemes', () => {
  it('defines the practice-layer and instance-structure page themes', () => {
    expect(Object.keys(guildhallPageThemes).sort()).toEqual([
      'aspect', 'community', 'guild', 'instance', 'plugin', 'practice',
    ]);
  });

  it.each([...PRACTICE_LAYER, ...INSTANCE_STRUCTURE])(
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

  it('keeps instance-structure colours out of the saturated practice band', () => {
    // The substrate reads as kin by hue but quieter by saturation. If someone
    // later brightens these, this fails rather than letting the two tiers blur.
    for (const key of INSTANCE_STRUCTURE) {
      for (const hex of guildhallPageThemes[key].colors) {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        expect(saturation).toBeLessThan(0.45);
      }
    }
  });
});
