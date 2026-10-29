import {
  SCENARIOS,
  type Scenario,
  asOfFor,
  historySvg,
  renderHistoryPage,
  standalone,
} from './history-swatches';

const svgsIn = (html: string) => html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];

// ⚠ ALWAYS THROUGH `asOfFor`, never with the wall clock. These fixtures are
// dated, so a bare `historySvg(runs)` grows an overdue tail that gets longer
// every day the suite is run — and the assertions below, which are about the
// shapes a case was written to show, would be measuring that instead.
const svgOf = (s: Scenario) => historySvg(s.runs, s.events, asOfFor(s));
const named = (title: string) => SCENARIOS.find(s => s.title === title)!;

describe('the scenarios', () => {
  // The page exists to let two shapes be COMPARED. A gap and a fall are the
  // pair that must never look alike, so both have to be on it.
  it('carries both the gap case and the measured fall', () => {
    const titles = SCENARIOS.map(s => s.title);
    expect(titles).toContain('A gap, not a fall');
    expect(titles).toContain('A real fall');
  });

  it('explains every scenario rather than leaving the reader to infer it', () => {
    for (const s of SCENARIOS) {
      expect(s.claim.length).toBeGreaterThan(40);
    }
  });
});

describe('historySvg', () => {
  const gapCase = named('A gap, not a fall');
  const fallCase = named('A real fall');

  // Dashes come from the component's own `seriesFor`, not from a second
  // implementation here — which is the point of importing it rather than
  // restating it. Two withheld runs in the middle leave three unconfirmed
  // spans: into the gap, across it, and out of it.
  it('dashes the unconfirmed spans of the gap case', () => {
    expect(svgOf(gapCase).match(/class="line unconfirmed"/g) ?? []).toHaveLength(3);
  });

  // The same channel on the markers. A solid ring at a run that learned nothing
  // would assert a medal was measured that day.
  it('perforates the marker on each run that learned nothing', () => {
    expect(svgOf(gapCase).match(/class="hollow"/g) ?? []).toHaveLength(2);
  });

  // The whole argument in one assertion: a measured decline carries no dash,
  // so it cannot be mistaken for an outage.
  it('draws the measured fall with no dash at all', () => {
    expect(svgOf(fallCase)).not.toMatch(/stroke-dasharray/);
  });

  it('steps rather than slopes', () => {
    const svg = svgOf(fallCase);
    // Every span is a horizontal move then a vertical one. A diagonal would be
    // a single L or a bare coordinate pair.
    for (const path of svg.match(/d="M[^"]+"/g) ?? []) {
      expect(path).toMatch(/^d="M [\d.]+ [\d.]+ H [\d.]+ V [\d.]+"$/);
    }
  });

  // Nothing was ever measured, so there is nothing to hold. A chart with
  // gridlines and no data would be a confident picture of nothing.
  it('says so in words when no run was ever measured', () => {
    const out = svgOf(named('Never seen at all'));
    expect(out).not.toMatch(/<svg/);
    expect(out).toMatch(/no run was ever measured/);
  });

  it('marks a release change with a rule and its version', () => {
    const svg = svgOf(named('The bar moved, not the component'));
    expect(svg).toMatch(/class="release"/);
    expect(svg).toMatch(/>1\.1</);
  });

  // ⚠ The case that proves the page is still worth looking at. Five clean gold
  // runs and a stopped sweep must NOT draw the same picture as five clean gold
  // runs and a healthy one — which is exactly what a chart cropped at its last
  // measurement does.
  it('tells a stopped sweep apart from a healthy one', () => {
    const stale = svgOf(named('Nobody has looked in weeks'));
    const healthy = svgOf(named('Holding gold'));
    expect(stale).not.toEqual(healthy);
    // Flat, dashed, ending at the plot's right edge, and labelled as today.
    expect(stale).toMatch(/d="M [\d.]+ [\d.]+ H 620"/);
    expect(stale).toMatch(/>today</);
    expect(healthy).not.toMatch(/>today</);
  });
});

describe('renderHistoryPage', () => {
  // ⚠ The bug this caught for real: the end label was placed above the point
  // unconditionally, which put a gold endpoint at y=4 in a plot starting at
  // 14 — clipped by its own viewBox. A label cropped by its own mark is worse
  // than no label, and no unit test of the series logic can see it.
  it('keeps every coordinate inside the viewBox', () => {
    const page = renderHistoryPage();
    const out: string[] = [];
    for (const svg of svgsIn(page)) {
      for (const m of svg.matchAll(/\b(?:x|x1|x2|cx)="([-\d.]+)"/g)) {
        const v = Number(m[1]);
        if (v < 0 || v > 640) out.push(`x ${v}`);
      }
      for (const m of svg.matchAll(/\b(?:y|y1|y2|cy)="([-\d.]+)"/g)) {
        const v = Number(m[1]);
        if (v < 0 || v > 180) out.push(`y ${v}`);
      }
    }
    expect(out).toEqual([]);
  });

  it('draws a chart for every scenario that has one', () => {
    // One scenario is the never-measured case, which draws prose instead.
    expect(svgsIn(renderHistoryPage())).toHaveLength(SCENARIOS.length - 1);
  });

  // Dashing is not self-explanatory, and a reader who guesses gets the
  // component's record wrong in exactly the direction the model forbids.
  it('states what the dash and the broken ring mean', () => {
    const page = renderHistoryPage();
    expect(page).toMatch(/Dashed — not confirmed/);
    expect(page).toMatch(/Broken ring/);
    expect(page).toMatch(/a run is overdue/);
  });

  // ⚠ THE PAGE MUST NOT AGE. Staleness is decided against an instant, so a page
  // that let `seriesFor` read the clock would show every case as overdue a
  // fortnight after these fixtures were written — burying the one case that is
  // about being overdue among five that are not.
  it('goes stale only in the case that is about going stale', () => {
    expect(renderHistoryPage().match(/>today</g) ?? []).toHaveLength(1);
  });

  // Theming matches the other swatch pages: tokens on a bare :root, a
  // prefers-color-scheme block guarded against an explicit light override, and
  // a [data-theme="dark"] block for a manual toggle.
  it('themes through tokens in both modes', () => {
    const page = renderHistoryPage();
    expect(page).toMatch(/:root\s*\{/);
    expect(page).toMatch(/prefers-color-scheme: dark/);
    expect(page).toMatch(/:root:not\(\[data-theme="light"\]\)/);
    expect(page).toMatch(/:root\[data-theme="dark"\]/);
  });

  // The fragment carries no document skeleton, because the Artifact publisher
  // supplies one. `standalone` is the local-file form.
  it('emits a fragment that standalone wraps, not a whole document', () => {
    expect(renderHistoryPage()).not.toMatch(/<!doctype/i);
    expect(renderHistoryPage()).toMatch(/<title>/);
    expect(standalone()).toMatch(/^<!doctype html>/);
  });
});
