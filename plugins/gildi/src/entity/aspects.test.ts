import { parseList, parseKeyed, adoptionStatus, hasAdoptedAspects, guildNameOf } from './aspects';

const enrolled = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
  metadata: { name: 'carrier-gateway', annotations: { 'siliconsaga.org/aspects': 'security' } },
  spec: { type: 'service' },
} as any;

describe('parseList', () => {
  it('splits, trims, drops blanks, and dedupes', () => {
    expect(parseList('security, operational-readiness ,, security')).toEqual([
      'security', 'operational-readiness',
    ]);
  });
  it('returns an empty list for undefined or blank input', () => {
    expect(parseList(undefined)).toEqual([]);
    expect(parseList('  ,  ')).toEqual([]);
  });
});

describe('parseKeyed', () => {
  it('parses id@version pairs', () => {
    const m = parseKeyed('security@1.4, operational-readiness@2.0', '@');
    expect(m.get('security')).toBe('1.4');
    expect(m.get('operational-readiness')).toBe('2.0');
  });
  it('keeps a URL value intact by splitting on the FIRST separator only', () => {
    const m = parseKeyed('security: https://git.example/x/pull/412', ':');
    expect(m.get('security')).toBe('https://git.example/x/pull/412');
  });
  it('drops entries with no separator, an empty id, or an empty value', () => {
    const m = parseKeyed('security, @1.4, ops@', '@');
    expect(m.size).toBe(0);
  });
  it('keeps the first entry when an id repeats', () => {
    expect(parseKeyed('security@1.4, security@9.9', '@').get('security')).toBe('1.4');
  });
});

describe('adoptionStatus', () => {
  it('is current when the versions match', () => {
    expect(adoptionStatus('1.4', '1.4')).toBe('current');
  });
  it('is behind when they differ, in either direction', () => {
    expect(adoptionStatus('1.2', '1.4')).toBe('behind');
    expect(adoptionStatus('9.9', '1.4')).toBe('behind');
  });
  it('is unknown when either side is missing', () => {
    expect(adoptionStatus(undefined, '1.4')).toBe('unknown');
    expect(adoptionStatus('1.2', undefined)).toBe('unknown');
  });
});

describe('hasAdoptedAspects', () => {
  it('is true for a component with a non-empty aspects annotation', () => {
    expect(hasAdoptedAspects(enrolled)).toBe(true);
  });
  it('is false for a missing, blank, or comma-only annotation', () => {
    expect(hasAdoptedAspects({ metadata: {} } as any)).toBe(false);
    expect(hasAdoptedAspects({ metadata: { annotations: { 'siliconsaga.org/aspects': ' ' } } } as any)).toBe(false);
    expect(hasAdoptedAspects({ metadata: { annotations: { 'siliconsaga.org/aspects': ' , ' } } } as any)).toBe(false);
  });
});

describe('guildNameOf', () => {
  it('reads the owning group name from spec.owner', () => {
    expect(guildNameOf({ metadata: {}, spec: { owner: 'group:default/security-gildi' } } as any))
      .toBe('security-gildi');
  });
  it('defaults a bare owner ref to a Group', () => {
    expect(guildNameOf({ metadata: {}, spec: { owner: 'security-gildi' } } as any)).toBe('security-gildi');
  });
  it('is undefined for a non-group owner, a malformed ref, or no owner', () => {
    expect(guildNameOf({ metadata: {}, spec: { owner: 'user:default/astrid' } } as any)).toBeUndefined();
    expect(guildNameOf({ metadata: {}, spec: { owner: '::://' } } as any)).toBeUndefined();
    expect(guildNameOf({ metadata: {}, spec: {} } as any)).toBeUndefined();
  });
});
