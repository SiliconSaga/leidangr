import { blazonFor } from './blazon';

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
});
