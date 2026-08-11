import { medalFor } from './medals';

describe('medalFor', () => {
  // The rule in one line: gold means every applicable trial passes, at any
  // standard size. Silver is one short. Everything else that passes something
  // is bronze.
  it.each([
    // applicable, passing, medal
    [1, 1, 'gold'],
    [1, 0, 'none'],
    [2, 2, 'gold'],
    [2, 1, 'silver'],
    [2, 0, 'none'],
    [3, 3, 'gold'],
    [3, 2, 'silver'],
    [3, 1, 'bronze'],
    [4, 4, 'gold'],
    [4, 3, 'silver'],
    [4, 2, 'bronze'],
    [4, 1, 'bronze'],
  ])('applicable %i, passing %i is %s', (applicable, passing, expected) => {
    expect(medalFor(applicable as number, passing as number)).toBe(expected);
  });

  it('awards gold to a one-trial standard, so a small aspect is still complete', () => {
    // This is the case assigned tiers could not express: with bronze/silver/gold
    // hardcoded, an aspect offering one check could never reach the top.
    expect(medalFor(1, 1)).toBe('gold');
  });

  it('counts only applicable trials, so a skipped trial never blocks gold', () => {
    // A standard with four trials where facet filtering leaves two: passing both
    // is gold, not silver. Non-applicable trials skip, they never count against.
    expect(medalFor(2, 2)).toBe('gold');
  });

  it('returns none when nothing applies, rather than a vacuous gold', () => {
    // An aspect that asked nothing of this component has awarded it nothing.
    expect(medalFor(0, 0)).toBe('none');
  });

  it('does not exceed gold if a caller passes more than it declared applicable', () => {
    // Clamping rather than falling through: a miscounting caller producing
    // silver out of more passes than trials would read as a real verdict.
    expect(medalFor(2, 3)).toBe('gold');
  });
});
