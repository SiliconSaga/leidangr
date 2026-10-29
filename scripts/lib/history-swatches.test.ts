import {
  SCENARIOS,
  historySvg,
  renderHistoryPage,
  standalone,
} from './history-swatches';

const svgsIn = (html: string) => html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];

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
  const gapCase = SCENARIOS.find(s => s.title === 'A gap, not a fall')!;
  const fallCase = SCENARIOS.find(s => s.title === 'A real fall')!;

  // Dashes come from the component's own `seriesFor`, not from a second
  // implementation here — which is the point of importing it rather than
  // restating it. Two withheld runs in the middle leave three unconfirmed
  // spans: into the gap, across it, and out of it.
  it('dashes the unconfirmed spans of the gap case', () => {
    const svg = historySvg(gapCase.runs, gapCase.events);
    expect(svg.match(/stroke-dasharray/g) ?? []).toHaveLength(3);
  });

  // The whole argument in one assertion: a measured decline carries no dash,
  // so it cannot be mistaken for an outage.
  it('draws the measured fall with no dash at all', () => {
    expect(historySvg(fallCase.runs)).not.toMatch(/stroke-dasharray/);
  });

  it('steps rather than slopes', () => {
    const svg = historySvg(fallCase.runs);
    // Every span is a horizontal move then a vertical one. A diagonal would be
    // a single L or a bare coordinate pair.
    for (const path of svg.match(/d="M[^"]+"/g) ?? []) {
      expect(path).toMatch(/^d="M [\d.]+ [\d.]+ H [\d.]+ V [\d.]+"$/);
    }
  });

  // Nothing was ever measured, so there is nothing to hold. A chart with
  // gridlines and no data would be a confident picture of nothing.
  it('says so in words when no run was ever measured', () => {
    const neverSeen = SCENARIOS.find(s => s.title === 'Never seen at all')!;
    const out = historySvg(neverSeen.runs);
    expect(out).not.toMatch(/<svg/);
    expect(out).toMatch(/no run was ever measured/);
  });

  it('marks a release change with a rule and its version', () => {
    const bar = SCENARIOS.find(s => s.title === 'The bar moved, not the component')!;
    const svg = historySvg(bar.runs, bar.events);
    expect(svg).toMatch(/class="release"/);
    expect(svg).toMatch(/>1\.1</);
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
  it('states what the dash and the hollow marker mean', () => {
    const page = renderHistoryPage();
    expect(page).toMatch(/Dashed — not confirmed/);
    expect(page).toMatch(/Hollow marker/);
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
