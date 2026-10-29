import {
  ALL_STATES,
  BANDS,
  ERROR,
  isErrorState,
  markFor,
  medallionSvg,
  noVerdictSvg,
  renderMedalSwatchPage,
  standalone,
} from './medal-swatches.ts';

describe('the medal marks', () => {
  // THE DESIGN CLAIM, and the one thing a regression here would silently undo.
  // The earned tiers and `none` share a silhouette because they sit on one
  // scale; withheld and unevaluated take a different shape because they are a
  // different kind of answer, not a lower rank.
  it('draws none in the medallion family, with no metal in it', () => {
    const svg = markFor('none');
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<polygon points="24,17');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke-dasharray');
  });

  it.each(['withheld', 'unevaluated', 'unavailable'])(
    'draws %s as a lozenge, not a medallion',
    state => {
      expect(markFor(state)).toContain('<polygon points="24,9 39,24 24,39 9,24"');
    },
  );

  // ⚠ THE THREE GAP STATES MUST NOT BE INTERCHANGEABLE. They shared one mark
  // and were told apart only by their label, which is what prompted this split.
  it('bars the withheld lozenge and leaves the unevaluated one empty', () => {
    expect(noVerdictSvg('withheld')).toContain('<rect x="16" y="22.5"');
    expect(noVerdictSvg('unevaluated')).not.toContain('<rect');
    expect(noVerdictSvg('unevaluated')).not.toContain('<circle');
  });

  // Only the state that actually broke is red, and it is solid rather than
  // dashed: an absence nobody needs to act on must not look like a fault.
  it('reddens and solidifies only unavailable', () => {
    const bad = noVerdictSvg('unavailable');
    expect(bad).toContain(ERROR);
    expect(bad).not.toContain('stroke-dasharray');
    // A warning glyph rather than a bar — the mark says "fault", not "held".
    expect(bad).toContain('<circle cx="24" cy="29.5"');

    for (const soft of ['withheld', 'unevaluated']) {
      expect(noVerdictSvg(soft)).toContain('stroke-dasharray');
      expect(noVerdictSvg(soft)).not.toContain(ERROR);
    }
  });

  // `none` is a measured verdict. Colouring it as a fault would be the same
  // inversion the outcome model exists to prevent.
  it('never reddens none or an earned tier', () => {
    for (const state of ['gold', 'silver', 'bronze', 'none']) {
      expect(markFor(state)).not.toContain(ERROR);
    }
  });

  it.each(['gold', 'silver', 'bronze'])('fills %s with its own metal', state => {
    const svg = markFor(state);
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('stroke-dasharray');
    // The charge only appears on an earned medal — it is what `none` drops.
    expect(svg).toContain('<polygon points="24,22');
  });

  // ⚠ THE ALIGNMENT REGRESSION. `align-items: center` centres the SVG BOX, so a
  // mark drawn off-centre inside it floats against its own label — and two
  // shapes sitting at different heights float by different amounts, which is
  // what made the real card read as crooked. A square box with both marks on
  // (24, 24) is the fix, and these pin it.
  it('gives every mark the same square box', () => {
    for (const s of ALL_STATES) {
      expect(markFor(s.state, 26)).toContain('viewBox="0 0 48 48"');
      expect(markFor(s.state, 26)).toContain('width="26" height="26"');
    }
  });

  it('centres both silhouettes on the same point', () => {
    // Medallion: ribbon apex down to the circle's lower edge, about 4 to 44.
    expect(medallionSvg('gold')).toContain('cy="30"');
    expect(medallionSvg('gold')).toContain('r="13"');
    expect(medallionSvg('gold')).toContain('M18 6 L24 18 L30 6');
    // Lozenge: symmetric about (24, 24) by construction — 9 and 39 either side.
    expect(noVerdictSvg()).toContain('24,9 39,24 24,39 9,24');
    // Its bar straddles the same centre line rather than sitting below it.
    expect(noVerdictSvg()).toContain('y="22.5"');
    expect(noVerdictSvg()).toContain('height="3"');
  });

  it('gives gold and bronze visibly different hues rather than two close yellows', () => {
    const gold = medallionSvg('gold');
    const bronze = medallionSvg('bronze');
    expect(gold).toContain('#d9b23a');
    expect(bronze).toContain('#a9713b');
    expect(gold).not.toContain('#a9713b');
  });

  it('treats unavailable as the only error state', () => {
    expect(isErrorState('unavailable')).toBe(true);
    for (const state of ['withheld', 'unevaluated', 'none', 'gold', 'silver', 'bronze']) {
      expect(isErrorState(state)).toBe(false);
    }
  });

  it('labels every mark for a screen reader', () => {
    for (const s of ALL_STATES) {
      expect(markFor(s.state)).toContain('role="img"');
      expect(markFor(s.state)).toContain('aria-label=');
    }
    // Named by its own state now that the three marks differ, so the label is
    // not three different drawings all announcing "no verdict".
    expect(noVerdictSvg('unavailable')).toContain('aria-label="unavailable"');
  });

  it('scales the viewBox rather than the coordinates', () => {
    // Same drawing at any size, so the 26px strip and the 48px rows cannot
    // drift apart into two different marks.
    expect(medallionSvg('gold', 26)).toContain('viewBox="0 0 48 48"');
    expect(medallionSvg('gold', 26)).toContain('width="26"');
  });
});

describe('renderMedalSwatchPage', () => {
  const page = renderMedalSwatchPage();

  it('shows every state the badge can draw', () => {
    expect(ALL_STATES).toHaveLength(7);
    for (const s of ALL_STATES) {
      expect(page).toContain(`>${s.state}</span>`);
    }
  });

  it('groups them by what kind of answer they are, not as one flat list', () => {
    expect(BANDS).toHaveLength(3);
    for (const b of BANDS) {
      expect(page).toContain(b.eyebrow);
    }
  });

  it('repeats every mark at the size the card uses', () => {
    // The functional half of the page: a mark that reads at 48 and muddies at
    // 26 is a mark that does not work.
    const strip = page.slice(page.indexOf('At the size the card uses'));
    for (const s of ALL_STATES) {
      expect(strip).toContain(s.label);
    }
    expect(strip).toContain('width="26"');
  });

  it('documents how a stored run becomes a mark, including the no-run case', () => {
    expect(page).toContain('no run recorded');
    expect(page).toContain('nothing is drawn');
  });

  // Theme-aware, per the artifact page contract: every colour token is defined
  // on bare :root first, so a page with no data-theme attribute still resolves.
  it('defines its palette on bare :root and redefines it for dark', () => {
    const rootBlock = page.slice(page.indexOf(':root {'), page.indexOf('@media'));
    for (const token of ['--ground', '--surface', '--ink', '--rule', '--accent']) {
      expect(rootBlock).toContain(token);
    }
    expect(page).toContain('prefers-color-scheme: dark');
    expect(page).toContain(':root[data-theme="dark"]');
    expect(page).toContain('color-scheme: dark');
  });

  it('carries a title but no document skeleton, which is what the publisher wants', () => {
    expect(page).toContain('<title>Guildhall medal badges</title>');
    expect(page).not.toContain('<!doctype');
    expect(page).not.toContain('<body');
  });

  it('wraps into a standalone file for opening off disk', () => {
    const file = standalone(page);
    expect(file.startsWith('<!doctype html>')).toBe(true);
    expect(file).toContain('<meta name="viewport"');
    expect(file).toContain('<title>Guildhall medal badges</title>');
  });
});
