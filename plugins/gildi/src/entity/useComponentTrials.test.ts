import { medalFromRun, type TrialRunView } from './useComponentTrials';

const run = (over: Partial<TrialRunView>): TrialRunView => ({
  entityRef: 'component:default/site',
  aspectId: 'website-hygiene',
  runAt: '2026-09-01T00:00:00.000Z',
  kind: 'evaluated',
  medal: null,
  suppressedReasons: null,
  applicable: 1,
  passing: 0,
  outcomes: [],
  ...over,
});

describe('medalFromRun', () => {
  it('is the stored medal for an evaluated run', () => {
    expect(medalFromRun(run({ medal: 'gold' }))).toBe('gold');
  });

  // Suppressed and unevaluated are NOT medals, and must not collapse to
  // `none`. `none` means measured and nothing passed — a verdict about the
  // component. The other two are statements about us.
  it.each([
    ['suppressed', run({ medal: null, suppressedReasons: ['no-resolver'] })],
    ['unevaluated', run({ kind: 'unevaluated', medal: null })],
  ])('is undefined for a %s run rather than none', (_label, value) => {
    expect(medalFromRun(value)).toBeUndefined();
  });

  it('is undefined when there is no run at all', () => {
    expect(medalFromRun(undefined)).toBeUndefined();
  });

  it('keeps none, which is a real verdict', () => {
    expect(medalFromRun(run({ medal: 'none' }))).toBe('none');
  });
});
