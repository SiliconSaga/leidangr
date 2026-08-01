import { stewardAspectsOf, indexPracticesByOwner, practiceView } from './roster';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: { name: 'security-gildi', annotations: { 'siliconsaga.org/stewards': 'aspect:security, aspect:appsec' } },
  spec: { type: 'guild' },
} as any;

const practice = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
  metadata: { name: 'security-practice', title: 'Security practice', annotations: { 'siliconsaga.org/aspect': 'security' } },
  spec: { type: 'practice', owner: 'group:default/security-gildi' },
} as any;

describe('roster helpers', () => {
  it('parses steward aspect ids', () => {
    expect(stewardAspectsOf(guild)).toEqual(['security', 'appsec']);
  });
  it('indexes practices by normalized owner ref', () => {
    const idx = indexPracticesByOwner([practice]);
    expect(idx.get('group:default/security-gildi')).toHaveLength(1);
  });
  it('skips a practice with a malformed owner', () => {
    const bad = { ...practice, spec: { ...practice.spec, owner: '::://' } } as any;
    expect(indexPracticesByOwner([bad]).size).toBe(0);
  });
  it('maps a practice to a compact view', () => {
    expect(practiceView(practice)).toEqual({ name: 'security-practice', title: 'Security practice', aspect: 'security' });
  });
});
