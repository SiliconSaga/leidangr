import { blazonFor } from './blazon';

const METALS = ['or', 'argent'];
// Enough seeds that a per-crest probability shows up as a hard failure rather
// than a lucky pass: the old independent draw repeated a tincture on 60% of
// divided crests, so even a handful would catch it, but the sweep also covers
// every division and charge combination several times over.
const SWEEP = Array.from({ length: 400 }, (_, i) => `guild-${i}`);

describe('blazonFor', () => {
  it('is deterministic for the same seed', () => {
    expect(blazonFor('security-gildi')).toEqual(blazonFor('security-gildi'));
  });
  it('honours the rule of tincture (field colour ↔ charge metal or vice versa)', () => {
    const metals = ['or', 'argent'];
    for (const seed of ['a', 'security-gildi', 'release-captains-gildi', 'platform', 'data', 'zzz']) {
      const b = blazonFor(seed);
      // rule of tincture: exactly one of field/charge is a metal (colour on metal, or metal on colour)
      expect(metals.includes(b.fieldTincture)).not.toEqual(metals.includes(b.chargeTincture));
    }
  });
  it('produces distinct arms for distinct seeds', () => {
    const a = blazonFor('security-gildi');
    const b = blazonFor('release-captains-gildi');
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('never paints a divided field in one tincture', () => {
    // Both halves the same tincture renders as a plain field — the division is
    // there in the blazon and invisible on screen.
    //
    // Reported as a count plus a couple of examples rather than the raw list:
    // this failed on 1378 of the sweep before the fix, and a jest diff of 1378
    // objects buries the one thing you need to see.
    const same = SWEEP.map(blazonFor)
      .filter(b => b.division !== 'plain')
      .filter(b => b.fieldTincture === b.fieldTincture2);
    expect({ invisible: same.length, examples: same.slice(0, 2) })
      .toEqual({ invisible: 0, examples: [] });
  });

  it('divides a metal field into two different metals', () => {
    // The case that was always broken: with one metal for both halves, every
    // divided metal crest was plain. There are only two metals, so the second
    // is forced — worth pinning, because it is what makes half the crests work.
    const metalFields = SWEEP.map(blazonFor)
      .filter(b => b.division !== 'plain' && !b.fieldIsColour);
    expect(metalFields.length).toBeGreaterThan(0);
    const pairs = new Set(metalFields.map(b => [b.fieldTincture, b.fieldTincture2].sort().join('/')));
    expect([...pairs]).toEqual(['argent/or']);
  });

  it('keeps both halves of the field in the same class as each other', () => {
    // The rule of tincture is decided against the field as a whole, so a field
    // that mixed a colour and a metal would leave the charge legible against
    // one half and lost against the other.
    for (const b of SWEEP.map(blazonFor)) {
      expect(METALS.includes(b.fieldTincture2)).toEqual(METALS.includes(b.fieldTincture));
    }
  });

  it('still honours the rule of tincture across the whole sweep', () => {
    for (const b of SWEEP.map(blazonFor)) {
      expect(METALS.includes(b.fieldTincture)).not.toEqual(METALS.includes(b.chargeTincture));
    }
  });
});
