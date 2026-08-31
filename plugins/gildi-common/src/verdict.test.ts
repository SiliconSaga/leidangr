import { fail, pass, unmeasured } from './outcome';
import { unevaluatedVerdict, verdictFor } from './verdict';

describe('verdictFor', () => {
  it('awards gold when every applicable trial passes', () => {
    expect(verdictFor([pass(), pass(), pass()])).toEqual({
      kind: 'medal',
      medal: 'gold',
      applicable: 3,
      passing: 3,
    });
  });

  it('awards silver when one trial short', () => {
    expect(verdictFor([pass(), pass(), fail()])).toEqual({
      kind: 'medal',
      medal: 'silver',
      applicable: 3,
      passing: 2,
    });
  });

  // NEGATIVE CONTROL. This is the failure that would silently inflate every
  // medal in the catalog: an unmeasured trial quietly dropping out of the
  // applicable set, so three passes and one missing resolver reads as gold.
  it('suppresses rather than awarding gold when a trial is unmeasured', () => {
    const verdict = verdictFor([pass(), pass(), pass(), unmeasured('no-resolver')]);
    expect(verdict.kind).toBe('suppressed');
    expect(verdict).not.toMatchObject({ medal: 'gold' });
  });

  it('reports how many were unmeasured and why, and still counts the passes', () => {
    // `passing` is carried even when suppressed: the stored run denormalises it
    // for charting, and without it the persistence path would invent a number.
    expect(verdictFor([pass(), unmeasured('error'), unmeasured('error')])).toEqual({
      kind: 'suppressed',
      reasons: ['error'],
      unmeasured: 2,
      applicable: 3,
      passing: 1,
    });
  });

  it('reports distinct reasons sorted, so the summary is stable', () => {
    // Stable ordering matters: this value ends up stored on a run row and
    // compared across runs to decide whether anything actually changed.
    expect(
      verdictFor([unmeasured('no-source'), unmeasured('error'), unmeasured('error')]),
    ).toMatchObject({ reasons: ['error', 'no-source'] });
  });

  it('suppresses even when another trial has already failed', () => {
    // A fail plus an unmeasured could arguably cap the medal at bronze, but the
    // ladder is defined over a KNOWN set. We cannot say, so we do not.
    expect(verdictFor([fail(), unmeasured('error')]).kind).toBe('suppressed');
  });

  it('returns none rather than suppressing when nothing is applicable', () => {
    // A == 0 is a real verdict per ADR 0013: an aspect that asked nothing of
    // this component has awarded it nothing. Nothing was unmeasurable.
    expect(verdictFor([])).toEqual({
      kind: 'medal',
      medal: 'none',
      applicable: 0,
      passing: 0,
    });
  });

  it('returns none when everything failed', () => {
    expect(verdictFor([fail(), fail()])).toEqual({
      kind: 'medal',
      medal: 'none',
      applicable: 2,
      passing: 0,
    });
  });
});

describe('unevaluatedVerdict', () => {
  it('is a distinct kind, not a medal and not a suppression', () => {
    expect(unevaluatedVerdict('no-standard')).toEqual({
      kind: 'unevaluated',
      reason: 'no-standard',
    });
  });

  it('carries detail when given', () => {
    expect(unevaluatedVerdict('no-standard', 'HTTP 404')).toEqual({
      kind: 'unevaluated',
      reason: 'no-standard',
      detail: 'HTTP 404',
    });
  });

  it('reports no applicable count, because the trial set is unknown', () => {
    // Not `applicable: 0`. Zero is a real, different claim — the standard
    // loaded and nothing applied — and reporting it here would let the stored
    // run and the chart present our failure as a fact about the component.
    expect(unevaluatedVerdict('no-standard')).not.toHaveProperty('applicable');
  });

  // THE DISTINCTION THIS FUNCTION EXISTS FOR. Reaching for verdictFor([]) when
  // the standard could not be read yields a confident `none`, which reads as
  // "measured, and nothing passed". Same input shape, opposite meaning.
  it('differs from an empty applicable set, which is a real none', () => {
    expect(verdictFor([])).toMatchObject({ kind: 'medal', medal: 'none' });
    expect(unevaluatedVerdict('no-standard').kind).toBe('unevaluated');
  });
});
