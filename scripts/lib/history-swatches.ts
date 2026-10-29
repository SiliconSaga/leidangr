// A standalone preview of the medal history chart: several representative
// histories on one page, so the shapes can be judged against each other
// without booting the app.
//
// ⚠ WHY THIS EXISTS AT ALL. The chart needs at least two measured runs, and
// `dev-facts` seeds exactly one per component — so on a real dev stack the
// chart renders nothing. There is no way to look at it except here.
//
// ⚠ WHAT IS DUPLICATED, AND WHAT IS NOT. The pixel geometry is restated,
// because the component is React and this is plain Node. The SERIES LOGIC is
// imported from the component's own module, so the page cannot disagree with
// the card about where a gap goes or whether a span is dashed — which is the
// part that carries the design claim. `series.ts` imports only types, so
// Node's type stripping loads it with no runtime dependency on Backstage.
//
// `renderHistoryPage` emits <title> + <style> + content with no document
// skeleton, so it can be published as an artifact directly. `standalone`
// wraps it for a local file.

import type { HistoryEvent, TrialRun } from '@siliconsaga/plugin-gildi-common';
import { RUNGS, seriesFor } from '../../plugins/gildi/src/history/series.ts';

const W = 640;
const H = 180;
const PAD = { top: 14, right: 20, bottom: 30, left: 62 };
const PLOT_H = H - PAD.top - PAD.bottom;

const rungY = (rung: number) => PAD.top + PLOT_H * (1 - rung / (RUNGS.length - 1));

// One dash, used by the line, the overdue tail and the gap marker alike: the
// channel means "unconfirmed" wherever it turns up. The marker's is its own
// circumference cut into twelve, so six dashes close the ring evenly.
const DASH = '4 4';
const MARKER_R = 4.5;
const PERFORATED = ((2 * Math.PI * MARKER_R) / 12).toFixed(2);

// The badge's metals and rims. The rim is load-bearing: bare gold is 1.97:1
// against a light surface and bare silver 1.33:1, both under the 3:1 a graphic
// owes, so the darker edge is what makes the marker readable.
export const METAL: Record<string, { fill: string; rim: string }> = {
  gold: { fill: '#d9b23a', rim: '#8f7220' },
  silver: { fill: '#dcdce0', rim: '#9a9aa2' },
  bronze: { fill: '#a9713b', rim: '#6d4724' },
  none: { fill: 'transparent', rim: '#8a8a94' },
};

export interface Scenario {
  title: string;
  claim: string;
  runs: TrialRun[];
  events?: HistoryEvent[];
  /**
   * When "now" is for this case. Defaults to the newest run, which is the only
   * value that leaves a scenario un-stale — so the overdue tail is something a
   * case opts into rather than something every case on the page inherits from
   * the day the page happened to be generated.
   */
  asOf?: string;
}

const run = (day: number, over: Partial<TrialRun> = {}): TrialRun => ({
  entityRef: 'component:default/hygiene-testsite',
  aspectId: 'website-hygiene',
  runAt: `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`,
  kind: 'evaluated',
  medal: 'gold',
  suppressedReasons: null,
  applicable: 4,
  passing: 4,
  outcomes: [],
  ...over,
});

const withheld = (day: number) =>
  run(day, { medal: null, suppressedReasons: ['no-resolver'], passing: 3 });

const unevaluated = (day: number) =>
  run(day, { kind: 'unevaluated', medal: null, applicable: null, passing: null });

/**
 * Chosen so the page answers the questions the design actually makes, rather
 * than showing one pretty line. Each scenario exists to be compared with
 * another: the gap against the fall, the climb against the steady hold.
 */
export const SCENARIOS: Scenario[] = [
  {
    title: 'Holding gold',
    claim:
      'The boring case, and it should look boring. A component that keeps its medal is a flat line, not an achievement re-announced every sweep.',
    runs: [run(5), run(4), run(3), run(2), run(1)],
  },
  {
    title: 'A gap, not a fall',
    claim:
      'Two runs could not be measured. The line HOLDS at gold and goes dashed, because dropping it to the floor would draw a cliff and read as a measured regression — when nothing was measured at all.',
    runs: [run(5), withheld(4), withheld(3), run(2), run(1)],
  },
  {
    title: 'A real fall',
    claim:
      'Compare with the one above: this component genuinely lost ground, and it was measured each time. Solid, stepped, downward. If these two looked alike the chart would be useless.',
    runs: [
      run(5, { medal: 'none', passing: 0 }),
      run(4, { medal: 'bronze', passing: 1 }),
      run(3, { medal: 'silver', passing: 3 }),
      run(2),
      run(1),
    ],
  },
  {
    title: 'The bar moved, not the component',
    claim:
      'The module went to 1.1 and the medal fell the same day. The rule is why: the component did not get worse, the standard got harder. Without it this reads as a regression.',
    runs: [
      run(5, { medal: 'silver', moduleRelease: '1.1', passing: 3 }),
      run(4, { medal: 'silver', moduleRelease: '1.1', passing: 3 }),
      run(3, { moduleRelease: '1.0' }),
      run(2, { moduleRelease: '1.0' }),
    ],
    events: [
      { type: 'release-changed', at: '2026-09-04T00:00:00.000Z', from: '1.0', to: '1.1' },
    ],
  },
  {
    title: 'Climbing the ladder',
    claim:
      'Steps, never slopes. A diagonal from none to gold would put the component at bronze and silver on days it held neither.',
    runs: [
      run(5),
      run(4, { medal: 'silver', passing: 3 }),
      run(3, { medal: 'bronze', passing: 1 }),
      run(2, { medal: 'none', passing: 0 }),
      run(1, { medal: 'none', passing: 0 }),
    ],
  },
  {
    title: 'Nobody has looked in weeks',
    claim:
      'The medal was gold and measured cleanly — and then the sweep stopped. The axis runs to TODAY rather than to the last run, so the stretch we did not look at is in the frame instead of cropped out of it. Ending the chart at the last measurement would draw this identically to the first case above.',
    runs: [run(5), run(4), run(3), run(2), run(1)],
    asOf: '2026-09-26T00:00:00.000Z',
  },
  {
    title: 'Never seen at all',
    claim:
      'The standard could not be read on either run, so there is nothing to hold and no line is drawn. Starting it at the floor would invent a verdict for a component we never measured.',
    runs: [unevaluated(2), unevaluated(1)],
  },
];

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** The chart as a standalone SVG string. Geometry only — `series.ts` decides. */
export function historySvg(
  runs: TrialRun[],
  events: HistoryEvent[] = [],
  asOf?: number,
): string {
  const { points, segments, tail } = seriesFor(runs, asOf);
  const drawable = points.filter(p => p.carried !== null);
  if (drawable.length < 2) {
    return `<p class="nothing">Nothing is drawn: no run was ever measured, so there is no medal to hold.</p>`;
  }

  const first = Date.parse(points[0].at);
  // To NOW when a run is overdue, not to the last run — see the component. A
  // chart cropped at its last measurement cannot show that there has not been
  // one in months.
  const last = Date.parse(tail?.toAt ?? points[points.length - 1].at);
  const span = last - first || 1;
  const x = (iso: string) =>
    PAD.left + ((Date.parse(iso) - first) / span) * (W - PAD.left - PAD.right);

  const grid = RUNGS.map(
    (rung, i) => `
    <line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${rungY(i)}" y2="${rungY(i)}" />
    <text class="rung" x="${PAD.left - 10}" y="${rungY(i)}" text-anchor="end" dominant-baseline="middle">${rung}</text>`,
  ).join('');

  const releases = events
    .flatMap(e => (e.type === 'release-changed' ? [e] : []))
    .map(
      e => `
    <line class="release" x1="${x(e.at)}" x2="${x(e.at)}" y1="${PAD.top}" y2="${PAD.top + PLOT_H}" />
    <text class="release-label" x="${x(e.at)}" y="${PAD.top - 4}" text-anchor="middle">${e.to}</text>`,
    )
    .join('');

  const spans = segments
    .map(
      seg => `
    <path class="line${seg.dashed ? ' unconfirmed' : ''}"${seg.dashed ? ` stroke-dasharray="${DASH}"` : ''}
      d="M ${x(seg.fromAt)} ${rungY(seg.fromRung)} H ${x(seg.toAt)} V ${rungY(seg.toRung)}" />`,
    )
    .join('');

  // Flat and dashed, with no marker at its end: no run happened there, and a
  // marker would invent one out of our own silence.
  const overdue = tail
    ? `
    <path class="line unconfirmed" stroke-dasharray="${DASH}"
      d="M ${x(tail.fromAt)} ${rungY(tail.rung)} H ${x(tail.toAt)}" />`
    : '';

  const marks = points
    .filter(p => p.carried !== null)
    .map(p => {
      const cx = x(p.at);
      const cy = rungY(p.carried as number);
      const metal = p.medal ? METAL[p.medal] : undefined;
      return `
    <circle class="ring" cx="${cx}" cy="${cy}" r="${MARKER_R + 1}" />
    <circle cx="${cx}" cy="${cy}" r="${MARKER_R}"
      ${
        metal
          ? `fill="${metal.fill}" stroke="${metal.rim}"`
          : `class="hollow" stroke-dasharray="${PERFORATED} ${PERFORATED}"`
      } stroke-width="1.5" />`;
    })
    .join('');

  const end = drawable[drawable.length - 1];
  const endY = rungY(end.carried as number);
  const endLabelY = endY - 10 >= PAD.top + 8 ? endY - 10 : endY + 18;
  const endLabel = `
    <text class="end" x="${W - PAD.right}" y="${endLabelY}" text-anchor="end">${
      end.gap || tail ? 'unconfirmed' : end.medal ?? ''
    }</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Medal history">
    ${grid}${releases}${spans}${overdue}${marks}${endLabel}
    <text class="axis" x="${PAD.left}" y="${H - 10}" text-anchor="start">${day(points[0].at)}</text>
    <text class="axis" x="${W - PAD.right}" y="${H - 10}" text-anchor="end">${
      tail ? 'today' : day(points[points.length - 1].at)
    }</text>
  </svg>`;
}

const STYLE = `
:root {
  --ground: #fcfcfb;
  --surface: #ffffff;
  --ink: #221d26;
  --ink-soft: #645a6b;
  --rule: #e4dfe7;
  --accent: #6b3a6b;
  --accent-wash: #f3edf3;
  --display: "Iowan Old Style", Palatino, Georgia, serif;
  --body: system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #171419;
    --surface: #201c23;
    --ink: #ece8ef;
    --ink-soft: #a39baa;
    --rule: #332d38;
    --accent: #c08dc0;
    --accent-wash: #2a2130;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --ground: #171419;
  --surface: #201c23;
  --ink: #ece8ef;
  --ink-soft: #a39baa;
  --rule: #332d38;
  --accent: #c08dc0;
  --accent-wash: #2a2130;
  color-scheme: dark;
}
body {
  background: var(--ground);
  color: var(--ink);
  font-family: var(--body);
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
  padding: 2.5rem 20px 3.5rem;
}
.wrap { max-width: 52rem; margin: 0 auto; display: flex; flex-direction: column; gap: 2.5rem; }
header { display: flex; flex-direction: column; gap: 0.6rem; }
h1 {
  font-family: var(--display);
  font-weight: 600;
  font-size: clamp(1.75rem, 5vw, 2.4rem);
  line-height: 1.15;
  margin: 0;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.thesis { margin: 0; color: var(--ink-soft); max-width: 42rem; }
.thesis strong { color: var(--ink); font-weight: 600; }
.case {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 1.3rem 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.case h2 {
  font-family: var(--display);
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0;
}
.claim { margin: 0; color: var(--ink-soft); font-size: 0.93rem; max-width: 44rem; }
.case svg { display: block; width: 100%; height: auto; overflow: visible; }
.nothing {
  margin: 0;
  padding: 2rem 0;
  color: var(--ink-soft);
  font-style: italic;
  text-align: center;
}
/* SOLID hairlines. Dashing is the data's channel on this chart — it is what
   says "unconfirmed" — so a dashed gridline would read as meaning something. */
.grid { stroke: var(--rule); stroke-width: 1; }
.release { stroke: var(--rule); stroke-width: 1; }
.release-label { fill: var(--ink-soft); font-size: 10px; }
.rung { fill: var(--ink-soft); font-size: 11px; }
.axis { fill: var(--ink-soft); font-size: 11px; font-variant-numeric: tabular-nums; }
.line {
  stroke: var(--ink);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}
.unconfirmed { stroke: var(--ink-soft); }
.ring { fill: none; stroke: var(--surface); stroke-width: 2; }
.hollow { fill: var(--surface); stroke: var(--ink-soft); }
.end { fill: var(--ink); font-size: 11px; font-weight: 600; }
.key { display: flex; flex-wrap: wrap; gap: 1.5rem; color: var(--ink-soft); font-size: 0.9rem; }
.key span { display: inline-flex; align-items: center; gap: 0.5rem; }
`;

/**
 * When "now" is for a case. The newest run unless the case says otherwise, so
 * the page is the same page every day it is generated — a default of the real
 * clock would quietly turn all six cases stale and hide the one case that is
 * about staleness.
 */
export function asOfFor(s: Scenario): number {
  return s.asOf
    ? Date.parse(s.asOf)
    : Math.max(...s.runs.map(r => Date.parse(r.runAt)));
}

export function renderHistoryPage(scenarios: Scenario[] = SCENARIOS): string {
  const cases = scenarios
    .map(
      s => `
  <section class="case">
    <h2>${s.title}</h2>
    <p class="claim">${s.claim}</p>
    ${historySvg(s.runs, s.events, asOfFor(s))}
  </section>`,
    )
    .join('');

  return `<title>Medal history</title>
<style>${STYLE}</style>
<div class="wrap">
  <header>
    <h1>The medal over time</h1>
    <p class="thesis">
      Sub-project 4's second pass. The chart's job is to keep two things apart that
      look identical if you are careless: <strong>a medal the component lost</strong>
      and <strong>a medal we could not confirm</strong>. The first is a verdict and
      the second is a gap in our own knowledge, and drawing them the same way would
      put our outage on the component's record.
    </p>
    <p class="thesis">
      So a gap never drops the line. It <strong>holds the last known rung and goes
      dashed</strong>, with a hollow marker where a run happened and told us nothing.
      Colour is decoration here — the rung is carried by position and named on the
      axis, because bronze and the gap grey measure only ΔE 11.8 apart even in full
      colour vision.
    </p>
    <p class="key">
      <span>Solid line — measured</span>
      <span>Dashed — not confirmed</span>
      <span>Broken ring — a run that learned nothing</span>
      <span>Dashed past the last point — a run is overdue</span>
      <span>Vertical rule — the module's release changed</span>
    </p>
  </header>
  ${cases}
</div>`;
}

export function standalone(body: string = renderHistoryPage()): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${body}
</html>`;
}
