import {
  ALL_STATES,
  BANDS,
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

  it.each(['withheld', 'unevaluated'])('draws %s as a lozenge, not a medallion', state => {
    const svg = markFor(state);
    expect(svg).toContain('<polygon points="24,17');
    expect(svg).not.toContain('<circle');
  });

  it.each(['gold', 'silver', 'bronze'])('fills %s with its own metal', state => {
    const svg = markFor(state);
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('stroke-dasharray');
    // The charge only appears on an earned medal — it is what `none` drops.
    expect(svg).toContain('<polygon points="24,27');
  });

  it('gives gold and bronze visibly different hues rather than two close yellows', () => {
    const gold = medallionSvg('gold');
    const bronze = medallionSvg('bronze');
    expect(gold).toContain('#d9b23a');
    expect(bronze).toContain('#a9713b');
    expect(gold).not.toContain('#a9713b');
  });

  it('labels every mark for a screen reader', () => {
    for (const s of ALL_STATES) {
      expect(markFor(s.state)).toContain('role="img"');
      expect(markFor(s.state)).toContain('aria-label=');
    }
    expect(noVerdictSvg()).toContain('aria-label="no verdict"');
  });

  it('scales the viewBox rather than the coordinates', () => {
    // Same drawing at any size, so the 26px strip and the 48px rows cannot
    // drift apart into two different marks.
    expect(medallionSvg('gold', 26)).toContain('viewBox="0 0 48 60"');
    expect(medallionSvg('gold', 26)).toContain('width="26"');
  });
});

describe('renderMedalSwatchPage', () => {
  const page = renderMedalSwatchPage();

  it('shows all six states', () => {
    expect(ALL_STATES).toHaveLength(6);
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
