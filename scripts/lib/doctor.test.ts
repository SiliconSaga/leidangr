import { checkNode, runDoctor, DoctorDeps } from './doctor';

describe('checkNode', () => {
  it('passes when the major version meets the floor', () => {
    expect(checkNode('v22.3.0', 22)).toMatchObject({ name: 'node', ok: true });
  });

  it('fails when below the floor', () => {
    expect(checkNode('v18.19.0', 22)).toMatchObject({ name: 'node', ok: false });
  });
});

describe('runDoctor', () => {
  const deps: DoctorDeps = {
    which: (bin) => (bin === 'corepack' ? '/usr/bin/corepack' : null),
    nodeVersion: () => 'v22.3.0',
    portFree: (p) => p === 3000 || p === 7007,
  };

  it('reports a check per tool and never returns secret values', () => {
    const checks = runDoctor(deps);
    expect(checks.map(c => c.name)).toEqual(
      expect.arrayContaining(['node', 'corepack', 'bao', 'port:3000', 'port:7007']),
    );
    expect(checks.find(c => c.name === 'bao')).toMatchObject({ ok: false });
  });
});
