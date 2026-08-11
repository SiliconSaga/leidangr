import { checkNode, checkMkdocs, runDoctor, DoctorDeps } from './doctor';

describe('checkNode', () => {
  it('passes when the major version meets the floor', () => {
    expect(checkNode('v22.3.0', 22)).toMatchObject({ name: 'node', ok: true });
  });

  it('fails when below the floor', () => {
    expect(checkNode('v18.19.0', 22)).toMatchObject({ name: 'node', ok: false });
  });
});

describe('checkMkdocs', () => {
  it('passes for a real executable', () => {
    expect(checkMkdocs('C:\\py\\3.11.9\\Scripts\\mkdocs.exe')).toMatchObject({ ok: true });
    expect(checkMkdocs('/usr/local/bin/mkdocs')).toMatchObject({ ok: true });
  });

  it('fails a .bat or .cmd — Node execs without a shell and cannot run one', () => {
    expect(checkMkdocs('C:\\Users\\x\\.pyenv\\pyenv-win\\shims\\mkdocs.bat')).toMatchObject({
      ok: false,
    });
    expect(checkMkdocs('C:\\tools\\mkdocs.cmd')).toMatchObject({ ok: false });
  });

  it('fails pyenv-win\'s extensionless launcher', () => {
    // The case that actually bit: `where.exe mkdocs` lists this first, it looks
    // like a real hit, and it fails only later at render time.
    expect(checkMkdocs('C:\\Users\\x\\.pyenv\\pyenv-win\\shims\\mkdocs')).toMatchObject({
      ok: false,
    });
  });

  it('passes a POSIX pyenv shim, which execvp can run', () => {
    // Not every shims/ path is broken. A unix pyenv shim is a shebang script
    // that a shell-less spawn executes fine — failing it would report a problem
    // on macOS and Linux where TechDocs actually works.
    expect(checkMkdocs('/home/x/.pyenv/shims/mkdocs')).toMatchObject({ ok: true });
    expect(checkMkdocs('/Users/x/.pyenv/shims/mkdocs')).toMatchObject({ ok: true });
  });

  it('explains the failure in terms of the error it produces', () => {
    const check = checkMkdocs('C:\\Users\\x\\.pyenv\\pyenv-win\\shims\\mkdocs.bat');
    expect(check.detail).toContain('spawn mkdocs ENOENT');
  });

  it('reports absence separately from a shim', () => {
    expect(checkMkdocs(null)).toMatchObject({ ok: false });
    expect(checkMkdocs(null).detail).toContain('not found on PATH');
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
      expect.arrayContaining(['node', 'corepack', 'bao', 'mkdocs', 'port:3000', 'port:7007']),
    );
    expect(checks.find(c => c.name === 'bao')).toMatchObject({ ok: false });
  });

  it('routes mkdocs through the shim check rather than a plain presence probe', () => {
    const withShim = runDoctor({
      ...deps,
      which: bin => (bin === 'mkdocs' ? 'C:\\x\\.pyenv\\pyenv-win\\shims\\mkdocs.bat' : null),
    });
    expect(withShim.find(c => c.name === 'mkdocs')).toMatchObject({ ok: false });
  });
});
