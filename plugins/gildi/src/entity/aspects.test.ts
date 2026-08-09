import {
  parseList, parseKeyed, adoptionStatus, aspectLabel, hasAdoptedAspects, guildNameOf,
  safeHttpUrl, scalar,
} from './aspects';

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

describe('scalar', () => {
  it('trims a padded value', () => {
    expect(scalar(' security ')).toBe('security');
    expect(scalar(' 1.4 ')).toBe('1.4');
  });
  it('is undefined for missing, empty, or whitespace-only input', () => {
    expect(scalar(undefined)).toBeUndefined();
    expect(scalar('')).toBeUndefined();
    expect(scalar('   ')).toBeUndefined();
  });
});

describe('safeHttpUrl', () => {
  it('passes http and https through, trimming padding', () => {
    expect(safeHttpUrl('https://git.example/x/pull/1')).toBe('https://git.example/x/pull/1');
    expect(safeHttpUrl('http://git.example/x')).toBe('http://git.example/x');
    expect(safeHttpUrl('  https://git.example/x  ')).toBe('https://git.example/x');
  });
  it('rejects javascript:, which core-components Link THROWS on rather than skips', () => {
    /* eslint-disable no-script-url -- the literal is precisely what is under test */
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('  JavaScript:alert(1)')).toBeUndefined();
    /* eslint-enable no-script-url */
  });
  it('rejects other schemes an anchor would otherwise happily render', () => {
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeHttpUrl('file:///etc/passwd')).toBeUndefined();
    expect(safeHttpUrl('vbscript:msgbox(1)')).toBeUndefined();
  });
  it('rejects anything that is not an absolute URL', () => {
    expect(safeHttpUrl('/relative/path')).toBeUndefined();
    expect(safeHttpUrl('not a url')).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});

describe('aspectLabel', () => {
  it('titles a slug into a human-readable name', () => {
    expect(aspectLabel('operational-readiness')).toBe('Operational readiness');
    expect(aspectLabel('security')).toBe('Security');
  });
  it('treats underscores as separators too', () => {
    expect(aspectLabel('supply_chain-integrity')).toBe('Supply chain integrity');
  });
  it('capitalises only the first word, leaving the rest as written', () => {
    expect(aspectLabel('api-SLO')).toBe('Api SLO');
  });
  it('is empty for an empty id', () => {
    expect(aspectLabel('')).toBe('');
    expect(aspectLabel('  ')).toBe('');
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
