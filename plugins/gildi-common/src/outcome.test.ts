import { fail, pass, unmeasured } from './outcome';

describe('outcome constructors', () => {
  it('builds a pass with no extra fields', () => {
    expect(pass()).toEqual({ state: 'pass' });
  });

  it('omits detail entirely when none is given', () => {
    // Not `{ detail: undefined }`: these outcomes are serialised into a stored
    // run row, and an explicit undefined key becomes null in JSON, which reads
    // as "there was a detail and it was empty" rather than "there was none".
    expect(fail()).toEqual({ state: 'fail' });
    expect(Object.keys(fail())).toEqual(['state']);
  });

  it('carries detail when given', () => {
    expect(fail('no github-pages gem')).toEqual({
      state: 'fail',
      detail: 'no github-pages gem',
    });
  });

  it('treats an empty detail as no detail, deliberately', () => {
    // A truthiness check rather than `!== undefined`, and on purpose. The
    // realistic source of an empty string here is `fail(err.message)` where the
    // message is blank — a detail that carries nothing. Storing `detail: ''`
    // would put a field on the run row that renders as an empty explanation,
    // which is worse than no explanation. Pinned so a later "fix" toward
    // `!== undefined` has to argue with this test first.
    expect(fail('')).toEqual({ state: 'fail' });
    expect(unmeasured('error', '')).toEqual({ state: 'unmeasured', reason: 'error' });
  });

  it('requires a reason for unmeasured', () => {
    expect(unmeasured('no-resolver')).toEqual({
      state: 'unmeasured',
      reason: 'no-resolver',
    });
  });

  it('carries reason and detail together', () => {
    expect(unmeasured('error', 'HTTP 403')).toEqual({
      state: 'unmeasured',
      reason: 'error',
      detail: 'HTTP 403',
    });
  });
});
