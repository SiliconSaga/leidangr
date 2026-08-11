import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { validateStandard } from './standard-shape';

const SECURITY = join(
  __dirname, '..', '..', 'examples', 'mock-org', 'repos', 'security-aspect', 'standard.yaml',
);

// Writes a standard.yaml plus any remediation files it references, so the
// path-resolution check has something real to resolve against.
function fixture(body: string, remediationFiles: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'standard-'));
  writeFileSync(join(dir, 'standard.yaml'), body, 'utf8');
  for (const rel of remediationFiles) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, '# fix it\n', 'utf8');
  }
  return join(dir, 'standard.yaml');
}

const WELL_FORMED = `
standard:
  id: demo
  aspect: demo
  blocks:
    - id: only
      appliesTo: ['*']
      trials:
        - id: a-trial
          rule: the thing is present
          artifact: thing.txt
          factSource: repo-files
          remediation: ./docs/fix.md
`;

describe('validateStandard', () => {
  it('passes the standard that actually ships', () => {
    // Guards the real file, not a fixture — a validator only tested against
    // fixtures drifts away from the thing it is supposed to protect.
    expect(validateStandard(SECURITY)).toEqual([]);
  });

  it('accepts a well-formed standard', () => {
    expect(validateStandard(fixture(WELL_FORMED, ['docs/fix.md']))).toEqual([]);
  });

  it('accepts a RELATIVE path to the standard, not only an absolute one', () => {
    // The cross-repo call is relative — `../volundr/aspect/standard.yaml` — and
    // every other case here is absolute because mkdtempSync says so. Without
    // this, dirname() leaves the base relative while resolve() returns
    // absolute, and the containment check rejects every remediation in the
    // file. Found by running the validator for real, not by these tests.
    const abs = fixture(WELL_FORMED, ['docs/fix.md']);
    expect(validateStandard(relative(process.cwd(), abs))).toEqual([]);
  });

  it('rejects a trial with no artifact, which is what makes it computable', () => {
    const body = WELL_FORMED.replace('          artifact: thing.txt\n', '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'missing artifact' },
    ]);
  });

  it('rejects a remediation path that does not resolve to a file', () => {
    // A vísir nobody can open is worse than none: the promise is that a failing
    // check is one click from the fix.
    expect(validateStandard(fixture(WELL_FORMED))).toEqual([
      { trial: 'a-trial', problem: 'remediation ./docs/fix.md does not resolve' },
    ]);
  });

  it('rejects a trial with no rule', () => {
    const body = WELL_FORMED.replace('          rule: the thing is present\n', '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'missing rule' },
    ]);
  });

  it('rejects a trial with no factSource', () => {
    const body = WELL_FORMED.replace('          factSource: repo-files\n', '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'missing factSource' },
    ]);
  });

  it('names an unidentified trial by position rather than throwing', () => {
    // A trial with no id still has to be reportable, or the run that was meant
    // to diagnose the standard dies on it instead.
    const body = WELL_FORMED.replace('        - id: a-trial\n', "        - id: ''\n");
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'only[0]', problem: 'missing id' },
    ]);
  });

  it('reports a standard with no blocks rather than passing it silently', () => {
    expect(validateStandard(fixture('standard:\n  id: empty\n'))).toEqual([
      { trial: '(standard)', problem: 'no blocks' },
    ]);
  });

  it('treats a non-string id as missing instead of throwing on it', () => {
    // YAML gives a number for `id: 1.4`, and .trim() on that throws — killing
    // the run that was supposed to explain the file.
    const body = WELL_FORMED.replace('        - id: a-trial\n', '        - id: 1.4\n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'only[0]', problem: 'missing id' },
    ]);
  });

  it('treats a non-string remediation as missing', () => {
    const body = WELL_FORMED.replace('          remediation: ./docs/fix.md\n', '          remediation: 7\n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'missing remediation' },
    ]);
  });

  it('rejects a remediation that points at a directory', () => {
    // A directory satisfies "exists" and renders as a broken link.
    const body = WELL_FORMED.replace('          remediation: ./docs/fix.md\n', '          remediation: ./docs\n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'remediation ./docs does not resolve' },
    ]);
  });

  it('reports a block that declares no trials', () => {
    const body = `
standard:
  id: demo
  blocks:
    - id: hollow
      appliesTo: ['*']
`;
    expect(validateStandard(fixture(body))).toEqual([
      { trial: 'hollow', problem: 'no trials' },
    ]);
  });

  it('rejects a remediation that escapes the module directory', () => {
    // A vísir is part of the aspect. One outside it will not travel when the
    // module is extracted or read over a URL.
    const body = WELL_FORMED.replace('          remediation: ./docs/fix.md\n', '          remediation: ../elsewhere.md\n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'remediation ../elsewhere.md escapes the module' },
    ]);
  });
});
