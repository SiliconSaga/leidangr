import type { TrialRun } from '@siliconsaga/plugin-gildi-common';
import { badgeLabelFor, badgeStateFor, badgeTitleFor, isEarned } from './badge';

const run = (over: Partial<TrialRun> = {}): TrialRun => ({
  entityRef: 'component:default/site',
  aspectId: 'website-hygiene',
  runAt: '2026-09-18T10:00:00.000Z',
  kind: 'evaluated',
  medal: 'gold',
  suppressedReasons: null,
  applicable: 4,
  passing: 4,
  outcomes: [],
  ...over,
});

describe('badgeStateFor', () => {
  it.each(['gold', 'silver', 'bronze', 'none'] as const)(
    'passes through the measured verdict %s',
    medal => {
      expect(badgeStateFor(run({ medal }))).toBe(medal);
    },
  );

  // THE DISTINCTION THE WHOLE OUTCOME MODEL EXISTS FOR. A suppressed run is a
  // statement about us; `none` is a verdict about the component. Rendering them
  // alike would tell a component it earned nothing on a run that measured
  // nothing.
  it('separates a withheld medal from a measured none', () => {
    expect(badgeStateFor(run({ medal: null, suppressedReasons: ['no-resolver'] }))).toBe(
      'withheld',
    );
    expect(badgeStateFor(run({ medal: 'none', passing: 0 }))).toBe('none');
  });

  it('separates an unevaluated run from both', () => {
    expect(
      badgeStateFor(run({ kind: 'unevaluated', medal: null, applicable: null, passing: null })),
    ).toBe('unevaluated');
  });

  // Draw NOTHING rather than a placeholder: a component the sweep has not
  // reached is not a finding, and a mark on every unswept row reads as a broken
  // card.
  it('is undefined when there is no run at all', () => {
    expect(badgeStateFor(undefined)).toBeUndefined();
  });

  it('never reads a medal off an unevaluated run', () => {
    expect(badgeStateFor(run({ kind: 'unevaluated', medal: 'gold' }))).toBe('unevaluated');
  });

  it('falls back to none for a medal outside the union', () => {
    expect(badgeStateFor(run({ medal: 'platinum' as never }))).toBe('none');
  });
});

describe('isEarned', () => {
  it('counts the three tiers and nothing else', () => {
    expect(['gold', 'silver', 'bronze'].map(s => isEarned(s as never))).toEqual([
      true,
      true,
      true,
    ]);
    expect(['none', 'withheld', 'unevaluated'].map(s => isEarned(s as never))).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe('badgeLabelFor', () => {
  it('names the gap states in words rather than leaving them blank', () => {
    expect(badgeLabelFor('withheld')).toBe('withheld');
    expect(badgeLabelFor('unevaluated')).toBe('not evaluated');
  });

  it('names a tier by its own name', () => {
    expect(badgeLabelFor('gold')).toBe('gold');
    expect(badgeLabelFor('none')).toBe('none');
  });
});

describe('badgeTitleFor', () => {
  it('counts the trials behind an earned medal', () => {
    expect(badgeTitleFor(run({ medal: 'silver', passing: 3, applicable: 4 }), 'silver')).toBe(
      'Silver — 3 of 4 applicable trials passed',
    );
  });

  it('says none was measured rather than implying nothing happened', () => {
    expect(badgeTitleFor(run({ medal: 'none', passing: 0, applicable: 2 }), 'none')).toBe(
      'No medal — 0 of 2 applicable trials passed',
    );
  });

  // Plural: several trials can be unmeasured for different reasons in one run,
  // and the hover is the only place that can say which.
  it('lists every suppression reason', () => {
    const title = badgeTitleFor(
      run({ medal: null, suppressedReasons: ['no-resolver', 'error'] }),
      'withheld',
    );
    expect(title).toContain('no-resolver, error');
    expect(title).toContain('not a failing grade');
  });

  it('explains an unevaluated run with its detail', () => {
    expect(
      badgeTitleFor(
        run({ kind: 'unevaluated', unevaluatedReason: 'no-standard', unevaluatedDetail: 'HTTP 404' }),
        'unevaluated',
      ),
    ).toBe('Not evaluated: HTTP 404');
  });

  it('still explains an unevaluated run carrying no detail', () => {
    expect(badgeTitleFor(run({ kind: 'unevaluated' }), 'unevaluated')).toContain(
      'could not be read',
    );
  });
});
