import { asRun, devSeedEnabled } from './devSeed';

const seed = (over: Record<string, unknown> = {}) => ({
  runAt: '2026-09-01T00:00:00.000Z',
  kind: 'evaluated',
  medal: 'gold',
  applicable: 4,
  passing: 4,
  ...over,
});

const asRunOf = (over: Record<string, unknown> = {}) =>
  asRun(seed(over), 'component:default/site', 'website-hygiene');

// ⚠ BOTH GATES, AND NEITHER IS ENOUGH ALONE. This endpoint writes runs nobody
// measured, which is the one thing the outcome model exists to prevent — so the
// test that matters most here is the one proving it stays off.
describe('devSeedEnabled', () => {
  it('is off with nothing set', () => {
    expect(devSeedEnabled({})).toBe(false);
  });

  it('is on only for the exact opt-in', () => {
    expect(devSeedEnabled({ GILDI_DEV_SEED: '1', NODE_ENV: 'development' })).toBe(true);
    for (const value of ['', '0', 'true', 'yes', 'TRUE']) {
      expect(devSeedEnabled({ GILDI_DEV_SEED: value, NODE_ENV: 'development' })).toBe(
        false,
      );
    }
  });

  // The second gate. Whatever is in the environment, production never gets this.
  it('refuses in production even when opted in', () => {
    expect(devSeedEnabled({ GILDI_DEV_SEED: '1', NODE_ENV: 'production' })).toBe(
      false,
    );
  });

  // ⚠ THE DENYLIST VERSION OF THIS GATE PASSED EVERY TEST ABOVE. Refusing only
  // `production` left an unset, misspelled or unfamiliar NODE_ENV wide open, and
  // an environment nobody named is exactly the one we know least about.
  it('stays shut for any environment that does not name itself', () => {
    for (const value of [undefined, '', 'Production', 'PRODUCTION', 'staging', 'prod']) {
      expect(devSeedEnabled({ GILDI_DEV_SEED: '1', NODE_ENV: value })).toBe(false);
    }
  });

  // `test` is admitted alongside `development` because the app's own suites run
  // under it, and a gate that only a human can open cannot be exercised by one.
  it('admits the test environment as well as development', () => {
    expect(devSeedEnabled({ GILDI_DEV_SEED: '1', NODE_ENV: 'test' })).toBe(true);
  });
});

// Strict on input even though we wrote the only caller: a malformed row does not
// fail here, it fails later in the chart and looks like a bug in the chart.
describe('asRun', () => {
  it('takes the subject from the URL, never from the body', () => {
    const run = asRun(
      seed({ entityRef: 'component:default/somewhere-else', aspectId: 'security' }),
      'component:default/site',
      'website-hygiene',
    );
    expect(run.entityRef).toBe('component:default/site');
    expect(run.aspectId).toBe('website-hygiene');
  });

  it('normalises the timestamp so stored rows sort as one format', () => {
    expect(asRunOf({ runAt: '2026-09-01T12:00:00+02:00' }).runAt).toBe(
      '2026-09-01T10:00:00.000Z',
    );
  });

  it.each([
    ['a missing timestamp', { runAt: undefined }],
    ['an unparseable timestamp', { runAt: 'last tuesday' }],
    ['an unknown kind', { kind: 'guessed' }],
    ['a medal outside the union', { medal: 'platinum' }],
    ['a fractional count', { passing: 1.5 }],
    ['a negative count', { applicable: -1 }],
    ['reasons that are not strings', { suppressedReasons: [1, 2] }],
  ])('refuses %s', (_label, over) => {
    expect(() => asRunOf(over)).toThrow();
  });

  // ⚠ THE INVARIANT THE REAL WRITER HOLDS, held here too. A run that measured
  // nothing cannot have awarded anything, and a seeded row that broke it would
  // teach every consumer downstream that the rule is negotiable.
  it('refuses an unevaluated run carrying a medal', () => {
    expect(() => asRunOf({ kind: 'unevaluated', medal: 'gold' })).toThrow(
      /cannot carry a medal/,
    );
  });

  it('accepts a withheld run, which is a null medal and a reason', () => {
    const run = asRunOf({ medal: null, suppressedReasons: ['no-resolver'] });
    expect(run.medal).toBeNull();
    expect(run.suppressedReasons).toEqual(['no-resolver']);
  });

  // `none` is a measured verdict, not an absence, and the whole point of the
  // chart is that it sits on the ladder rather than off it.
  it('accepts none as the verdict it is', () => {
    expect(asRunOf({ medal: 'none', passing: 0 }).medal).toBe('none');
  });

  // Outcomes are per-trial detail the badge's popover reads. Fabricating them
  // would put invented trial names on a component.
  it('never seeds outcomes, whatever the body says', () => {
    expect(asRunOf({ outcomes: [{ id: 'made-up', state: 'pass' }] }).outcomes).toBeNull();
  });

  // A count of zero is a real measurement — a standard that loaded and applied
  // nothing — and must not be coerced to null on the way in.
  it('keeps a zero count as zero', () => {
    expect(asRunOf({ applicable: 0, passing: 0 }).applicable).toBe(0);
  });
});
