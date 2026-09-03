import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Guards `startup_race_lost` in scripts/smoke-catalog.sh — the three lines that
// decide whether a failed smoke run gets retried.
//
// Worth a test because both failure directions are SILENT. Too eager and a real
// catalog regression is retried and reported as a flake; too shy and a 50%
// startup race reads as 37 assertion failures, which is what it did for weeks
// before anyone named it. The first version of this function was also wrong —
// it matched only the error NAME, which reaches the log through a logger field
// rather than the thrown message.
//
// The function is extracted from the real script rather than restated here, so
// editing the script changes what this asserts.
const SCRIPT = join(__dirname, '..', 'smoke-catalog.sh');

// bash is present on every machine that can run the smoke at all, but the unit
// suite should not fail for its absence — same reasoning as the symlink probe
// in standard-shape.test.ts.
const bashWorks = (() => {
  try {
    execFileSync('bash', ['-c', 'exit 0'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function extractFunction(): string {
  const src = readFileSync(SCRIPT, 'utf8');
  const match = src.match(/^startup_race_lost\(\) \{[\s\S]*?^\}/m);
  // Fails loudly rather than silently testing an empty string, which is the
  // standing hazard with pulling source out of another file by pattern.
  if (!match) {
    throw new Error('startup_race_lost() not found in smoke-catalog.sh');
  }
  return match[0];
}

function detects(logBody: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'smoke-race-'));
  const log = join(dir, 'backend.log').replace(/\\/g, '/');
  writeFileSync(log, logBody, 'utf8');
  const program = `${extractFunction()}\nLOG="${log}"\nstartup_race_lost`;
  try {
    execFileSync('bash', ['-c', program], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const maybe = bashWorks ? describe : describe.skip;

maybe('startup_race_lost', () => {
  it('detects the signature this actually produced', () => {
    // Faithful excerpt of a run on 2026-08-27: the thrown message and the
    // logger's name field both appear, which is what the real thing looks like.
    expect(
      detects(
        `backstage error Unhandled rejection Backend startup failed due to the following errors:
  Plugin 'kubernetes' startup failed; caused by Error: IPC request 'DevDataStore.load' with ID 8 timed out
 type="unhandledRejection" name="BackendStartupError"`,
      ),
    ).toBe(true);
  });

  it.each([
    [
      'the message alone',
      `Backend startup failed due to the following errors:
  Error: IPC request 'DevDataStore.load' with ID 9 timed out`,
    ],
    [
      'the error name alone',
      `name="BackendStartupError"
Error: IPC request 'DevDataStore.load' with ID 9 timed out`,
    ],
  ])('detects it from %s, so neither spelling is load-bearing', (_label, body) => {
    expect(detects(body)).toBe(true);
  });

  it('ignores a healthy log', () => {
    expect(
      detects(`rootHttpRouter info Listening on :7007
catalog info Full refresh of the catalog completed`),
    ).toBe(false);
  });

  // THE ONE THAT MATTERS. A startup failure that is not this race must not be
  // retried: a retry would hide a real regression behind a second attempt and a
  // reassuring message about timing.
  it('declines a startup failure that is not this race', () => {
    expect(
      detects(`Backend startup failed due to the following errors:
  Plugin 'catalog' startup failed; caused by Error: connect ECONNREFUSED 127.0.0.1:5432`),
    ).toBe(false);
  });

  it('declines a DevDataStore mention with no startup failure', () => {
    // The store is used on healthy boots too, so its name alone proves nothing.
    expect(detects('debug DevDataStore.load loaded=true key=auth-keys')).toBe(false);
  });
});
