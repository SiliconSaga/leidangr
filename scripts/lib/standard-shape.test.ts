import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { validateStandard } from './standard-shape';

// Replaced in the module registry rather than spied on the fs object: swc
// binds a named import directly, so jest.spyOn(fs, 'realpathSync') never
// reaches the call inside standard-shape. Must be `mock`-prefixed for jest to
// allow the reference from inside a hoisted factory.
let mockRealpath: ((p: string) => string) | null = null;
jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    realpathSync: (p: unknown, ...rest: unknown[]) =>
      (mockRealpath ? mockRealpath(String(p)) : actual.realpathSync(p, ...rest)),
  };
});

// Windows refuses file symlinks without Developer Mode or elevation, so the
// symlink-escape case is gated rather than left to fail for an unrelated
// reason. Probed once at load so the skip is visible in the report.
const symlinksWork = (() => {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'symprobe-'));
    writeFileSync(join(dir, 'real.md'), 'x', 'utf8');
    symlinkSync(join(dir, 'real.md'), join(dir, 'link.md'));
    return true;
  } catch {
    return false;
  }
})();

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

  it('rejects a check type outside the closed vocabulary', () => {
    // The whole point of a closed enum is that a typo is caught here rather
    // than becoming unmeasured{no-resolver} silently at evaluation time.
    const body = WELL_FORMED.replace(
      '          factSource: repo-files\n',
      '          factSource: repo-files\n          check: { type: file-contins, value: x }\n',
    );
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'unknown check type file-contins' },
    ]);
  });

  it('accepts a trial with a valid check', () => {
    const body = WELL_FORMED.replace(
      '          factSource: repo-files\n',
      '          factSource: repo-files\n          check: { type: file-contains, value: x }\n',
    );
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([]);
  });

  it('accepts a trial with no check at all', () => {
    // The mock security standard has none. Those trials become
    // unmeasured{no-resolver} at evaluation, which is not a shape error.
    expect(validateStandard(fixture(WELL_FORMED, ['docs/fix.md']))).toEqual([]);
  });

  it('rejects an empty check, which is not the same as no check', () => {
    // `check:` with nothing after it parses as null. That is a half-written
    // declaration, and treating it as absent lets an unfinished trial validate
    // clean and go unmeasured at runtime — the exact failure this catches.
    const body = WELL_FORMED.replace(
      '          factSource: repo-files\n',
      '          factSource: repo-files\n          check:\n',
    );
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'check is not a mapping' },
    ]);
  });

  it('rejects a block with no appliesTo', () => {
    // A block without it applies to nothing, so its trials never run — which
    // looks exactly like a component with nothing to answer for.
    const body = WELL_FORMED.replace("      appliesTo: ['*']\n", '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'only', problem: 'missing appliesTo' },
    ]);
  });

  it('rejects an appliesTo entry that is not a usable facet name', () => {
    // A populated array is not a valid one. Facets are compared as strings, so
    // a number or a blank silences the block exactly as a missing appliesTo
    // would — while looking, in the file, entirely filled in.
    const body = WELL_FORMED.replace(
      "      appliesTo: ['*']\n",
      "      appliesTo: ['web-ui', '', 3]\n",
    );
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'only', problem: 'appliesTo has a non-string entry' },
    ]);
  });

  it('rejects a block with no id, naming it by position', () => {
    // Non-optional in the shared Block type. Without the check a block with
    // valid trials returns clean, which is a promise the type does not keep.
    const body = WELL_FORMED.replace('    - id: only\n', '    - \n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'block[0]', problem: 'missing id' },
    ]);
  });

  it('rejects a padded appliesTo entry, which trims to something valid', () => {
    // The dangerous shape: it looks correct and trims to a real facet, so a
    // validator inspecting only the trimmed copy calls the file clean while
    // the raw value matches nothing downstream.
    const body = WELL_FORMED.replace(
      "      appliesTo: ['*']\n",
      "      appliesTo: [' web-ui ']\n",
    );
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'only', problem: 'appliesTo has a padded entry' },
    ]);
  });

  it('rejects a padded check type, before testing the vocabulary', () => {
    // Order matters. ' file-contains ' trims to a real member, so a membership
    // test on the trimmed copy passes and the file reads as clean — then the
    // same test downstream, where nothing trims it, resolves to unmeasured.
    const body = WELL_FORMED.replace(
      '          factSource: repo-files\n',
      "          factSource: repo-files\n          check: { type: ' file-contains ', value: x }\n",
    );
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'padded check type file-contains' },
    ]);
  });

  it('rejects a standard with no aspect', () => {
    // Non-optional in the shared Standard type, so a clean return is a promise
    // it is present.
    const body = WELL_FORMED.replace('  aspect: demo\n', '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: '(standard)', problem: 'missing aspect' },
    ]);
  });

  it('rejects a standard with no id', () => {
    const body = WELL_FORMED.replace('  id: demo\n', '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: '(standard)', problem: 'missing id' },
    ]);
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
  aspect: demo
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

  it('rejects a remediation whose REAL path leaves the module', () => {
    // The symlink case, tested without needing to create one — Windows refuses
    // file symlinks without Developer Mode, and this branch is too easy to get
    // wrong to leave covered only on Linux. The vísir exists and is textually
    // contained; only canonicalising reveals it resolves elsewhere.
    const outside = mkdtempSync(join(tmpdir(), 'outside-'));
    const realFile = join(outside, 'real.md');
    writeFileSync(realFile, '# elsewhere\n', 'utf8');
    const standard = fixture(WELL_FORMED, ['docs/fix.md']);

    mockRealpath = p => (p.endsWith('fix.md') ? realFile : p);
    try {
      expect(validateStandard(standard)).toEqual([
        { trial: 'a-trial', problem: 'remediation ./docs/fix.md escapes the module' },
      ]);
    } finally {
      mockRealpath = null;
    }
  });

  (symlinksWork ? it : it.skip)('rejects a remediation symlinked out of the module', () => {
    // Textually contained, actually elsewhere. The `../` case above cannot
    // cover this: that one never exists, while this one resolves to a real
    // file that simply will not travel with the module.
    const outside = mkdtempSync(join(tmpdir(), 'outside-'));
    writeFileSync(join(outside, 'real.md'), '# elsewhere\n', 'utf8');
    const standard = fixture(WELL_FORMED);
    const moduleDir = join(standard, '..');
    mkdirSync(join(moduleDir, 'docs'), { recursive: true });
    symlinkSync(join(outside, 'real.md'), join(moduleDir, 'docs', 'fix.md'));

    expect(validateStandard(standard)).toEqual([
      { trial: 'a-trial', problem: 'remediation ./docs/fix.md escapes the module' },
    ]);
  });

  it('reports malformed YAML instead of throwing out of the validator', () => {
    // The run exists to say what is wrong with the file. A stack trace does
    // not, and it fails hardest on the input that most needed explaining.
    expect(validateStandard(fixture('standard:\n  id: broken\n  blocks: [oops\n'))).toEqual([
      { trial: '(standard)', problem: 'invalid YAML' },
    ]);
  });
});
