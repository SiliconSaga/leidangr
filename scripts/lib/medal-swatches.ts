// The badge's six states, rendered to one page so they can be compared side by
// side without booting the app and hand-making each state in a database.
//
// Comparison is the whole point. The states matter RELATIVE to each other —
// gold must not be mistakable for bronze, and neither withheld nor unevaluated
// may read as a fourth, lesser tier — and none of that is visible one state at
// a time on a running card.
//
// The SVG is duplicated from plugins/gildi/src/badge/MedalBadge.tsx rather than
// imported: that file is TSX inside a plugin that only exists compiled in an app
// build, and this has to work from a cold checkout — the same constraint
// theme-swatches.ts already documents for the guildhall themes. The duplication
// is bounded (two shapes and a palette) and drift is visible the moment anyone
// looks at the page, which is the only reason it is acceptable here.
//
// `renderMedalSwatchPage` emits <title> + <style> + content with no document
// skeleton, which is the shape the Artifact publisher wants. `standalone()`
// wraps that for a file you can double-click. One source, two wrappers — so the
// page under review and the page on disk can never disagree.

export interface MedalSwatch {
  state: string;
  label: string;
  meaning: string;
}

export interface MedalBand {
  /** What this group of states IS, which is the page's actual argument. */
  eyebrow: string;
  claim: string;
  states: MedalSwatch[];
}

// The badge's own values, lifted verbatim. Deliberately NOT themed: these are
// the thing under review, so they must render identically to the card.
export const METAL: Record<string, { fill: string; rim: string; charge: string }> = {
  gold: { fill: '#d9b23a', rim: '#8f7220', charge: '#4a3c10' },
  silver: { fill: '#dcdce0', rim: '#9a9aa2', charge: '#4a4a52' },
  bronze: { fill: '#a9713b', rim: '#6d4724', charge: '#2f1e0f' },
};

export const MUTED = '#8a8a94';
export const RIBBON = '#6b3a6b'; // purpure

/**
 * Three bands, not six rows. The grouping IS the design argument: the earned
 * tiers and `none` sit on one scale and share a silhouette, while the two gap
 * states are a different kind of answer and get a different shape.
 */
export const BANDS: MedalBand[] = [
  {
    eyebrow: 'Earned',
    claim:
      'A verdict about the component, and an achievement. Medals are derived from what passed, never assigned to named rungs — so an aspect is complete at any standard size (ADR 0013).',
    states: [
      { state: 'gold', label: 'gold', meaning: 'Every applicable trial passed.' },
      { state: 'silver', label: 'silver', meaning: 'One trial short of complete.' },
      { state: 'bronze', label: 'bronze', meaning: 'At least one applicable trial passed.' },
    ],
  },
  {
    eyebrow: 'Measured, nothing earned',
    claim:
      'Still a verdict about the component — we measured, and nothing passed. It belongs on the tier scale, so it keeps the medallion silhouette and simply holds no metal.',
    states: [
      {
        state: 'none',
        label: 'none',
        meaning: 'The standard applied, and no applicable trial passed.',
      },
    ],
  },
  {
    eyebrow: 'Could not say',
    claim:
      'Not a verdict at all — a statement about us. A dimmed medal would read as a worse medal and put a gap in our own knowledge onto the component’s record, so these take a different silhouette entirely.',
    states: [
      {
        state: 'withheld',
        label: 'withheld',
        meaning:
          'A trial could not be measured, so the medal is suppressed rather than denied. The hover names every reason.',
      },
      {
        state: 'unevaluated',
        label: 'not evaluated',
        meaning: 'We never learned what the trials were — the standard itself could not be read.',
      },
    ],
  },
];

export const ALL_STATES: MedalSwatch[] = BANDS.flatMap(b => b.states);

/** How a stored run becomes one of the six. The real derivation, in order. */
export const DERIVATION: Array<[string, string]> = [
  ['no run recorded', 'nothing is drawn'],
  ['kind = unevaluated', 'not evaluated'],
  ['kind = evaluated, medal = null', 'withheld'],
  ['medal = gold | silver | bronze', 'that tier'],
  ['medal = none', 'none'],
];

// ⚠ BOTH MARKS CENTRE ON (24, 24) IN A SQUARE 48×48 BOX. Centring aligns the
// SVG BOX, so content sitting off-centre inside it shows up as a mark floating
// against its own label — and two shapes at different heights inside the box
// float by different amounts, which reads as a crooked row. Keep any new mark
// centred on the same point. See MedalBadge.tsx, which carries the same
// geometry for the reason documented at the top of this file.
const MEDALLION_STAR =
  '24,22 26,27.3 31.6,27.5 27.2,31.1 28.7,36.5 24,33.4 19.3,36.5 20.8,31.1 16.4,27.5 22,27.3';

export function medallionSvg(state: string, size = 48): string {
  const m = METAL[state];
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="${state} medal"${
    m ? '' : ' class="void"'
  }>
<path d="M18 6 L24 18 L30 6" fill="none" stroke="${RIBBON}" stroke-width="3.5" opacity="${m ? 1 : 0.4}"/>
<circle cx="24" cy="30" r="13" fill="${m ? m.fill : 'none'}" stroke="${m ? m.rim : MUTED}" stroke-width="2.5"${
    m ? '' : ' stroke-dasharray="3 3"'
  }/>
${m ? `<polygon points="${MEDALLION_STAR}" fill="${m.charge}"/>` : ''}
</svg>`;
}

export function noVerdictSvg(size = 48): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="no verdict">
<polygon points="24,9 39,24 24,39 9,24" fill="none" stroke="${MUTED}" stroke-width="2.5" stroke-dasharray="3 3"/>
<rect x="16" y="22.5" width="16" height="3" fill="${MUTED}" rx="1.5"/>
</svg>`;
}

export function markFor(state: string, size = 48): string {
  return state === 'withheld' || state === 'unevaluated'
    ? noVerdictSvg(size)
    : medallionSvg(state, size);
}

const STYLE = `
/* Layout: a stacked spec sheet — three argument bands, then the size check. */
:root {
  --ground: #faf8fb;
  --surface: #ffffff;
  --ink: #241f28;
  --ink-soft: #6b6474;
  --rule: #e4dfe9;
  --accent: #6b3a6b;
  --accent-wash: #f1eaf1;
  --display: 'Newsreader', Georgia, 'Times New Roman', serif;
  --body: 'Archivo', 'Segoe UI', system-ui, sans-serif;
  --mono: ui-monospace, 'Cascadia Mono', Consolas, monospace;
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
  padding-block: 2.5rem 3.5rem;
  padding-left: 20px;
  padding-right: 20px;
}
.wrap { max-width: 50rem; margin: 0 auto; display: flex; flex-direction: column; gap: 2.75rem; }

header { display: flex; flex-direction: column; gap: 0.6rem; }
h1 {
  font-family: var(--display);
  font-weight: 600;
  font-size: clamp(1.75rem, 5vw, 2.4rem);
  line-height: 1.15;
  margin: 0;
  text-wrap: balance;
  letter-spacing: -0.01em;
}
.thesis { margin: 0; color: var(--ink-soft); max-width: 42rem; }
.thesis strong { color: var(--ink); font-weight: 600; }

.band {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 1.4rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.eyebrow {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0;
}
.claim { margin: -0.5rem 0 0; color: var(--ink-soft); font-size: 0.93rem; max-width: 44rem; }

.states { display: flex; flex-direction: column; gap: 1.1rem; }
.state {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 0 1rem;
  align-items: start;
}
/* No nudge needed: the mark is centred inside a square box, so it lines up with
   the name beside it on its own. */
.state .mark { display: flex; justify-content: center; align-items: center; }
.state .mark svg { display: block; }
.state .name {
  font-family: var(--display);
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}
.state .token {
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--ink-soft);
  background: var(--accent-wash);
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 0.5rem;
  font-weight: 400;
}
.state .meaning { margin: 0.15rem 0 0; color: var(--ink-soft); font-size: 0.93rem; min-width: 0; }

.check { display: flex; flex-direction: column; gap: 0.9rem; }
.strip {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 1.1rem 1.3rem;
}
.chip { display: inline-flex; align-items: center; gap: 5px; }
.chip svg { display: block; flex: none; }
/* line-height matches the component, so the label sits on the mark's centre
   line rather than carrying its own leading. */
.chip span { font-size: 12px; line-height: 1; white-space: nowrap; }
.chip .earned { font-weight: 600; }
.chip .gap { color: ${MUTED}; }

table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
th, td { text-align: left; padding: 7px 10px 7px 0; border-bottom: 1px solid var(--rule); }
th { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); font-weight: 600; }
td:first-child { font-family: var(--mono); font-size: 0.82rem; white-space: nowrap; }
.scroll { overflow-x: auto; }

footer { color: var(--ink-soft); font-size: 0.85rem; border-top: 1px solid var(--rule); padding-top: 1.1rem; }
footer code { font-family: var(--mono); font-size: 0.82rem; }
h2 { font-family: var(--display); font-size: 1.25rem; font-weight: 600; margin: 0; }
svg.void { opacity: 0.95; }
@media (max-width: 420px) {
  .state { grid-template-columns: 44px 1fr; gap: 0 0.7rem; }
}
`;

export function renderMedalSwatchPage(bands: MedalBand[] = BANDS): string {
  const band = (b: MedalBand) => `<section class="band">
<p class="eyebrow">${b.eyebrow}</p>
<p class="claim">${b.claim}</p>
<div class="states">
${b.states
  .map(
    s => `  <div class="state">
    <div class="mark">${markFor(s.state)}</div>
    <div>
      <p class="name">${s.label}<span class="token">${s.state}</span></p>
      <p class="meaning">${s.meaning}</p>
    </div>
  </div>`,
  )
  .join('\n')}
</div>
</section>`;

  const states = bands.flatMap(b => b.states);
  const earned = new Set(['gold', 'silver', 'bronze']);
  const chips = states
    .map(
      s =>
        `<span class="chip">${markFor(s.state, 26)}<span class="${
          earned.has(s.state) ? 'earned' : 'gap'
        }">${s.label}</span></span>`,
    )
    .join('\n');

  const rows = DERIVATION.map(([from, to]) => `<tr><td>${from}</td><td>${to}</td></tr>`).join('\n');

  return `<title>Guildhall medal badges</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=Archivo:wght@400;500;600&display=swap">
<style>${STYLE}</style>
<div class="wrap">
<header>
  <h1>Guildhall medal badges</h1>
  <p class="thesis">
    <strong>Six states, not three.</strong> A component earns a tier by passing an aspect’s
    trials, and the badge has to carry three different kinds of “no medal” without
    flattening them. The marks below are grouped by <em>what kind of answer they are</em>,
    because that grouping is the whole design.
  </p>
</header>

${bands.map(band).join('\n\n')}

<section class="check">
  <h2>At the size the card uses</h2>
  <div class="strip">
${chips}
  </div>
  <p class="claim">
    26px, in a row, as they appear in <code>ComponentAspectsCard</code>. A mark that reads at
    48px and turns to mud at 26 is a mark that does not work — and gold beside bronze is the
    pair to check.
  </p>
</section>

<section class="check">
  <h2>How a run becomes a mark</h2>
  <div class="scroll">
    <table>
      <tr><th>Stored run</th><th>Badge</th></tr>
${rows}
    </table>
  </div>
</section>

<footer>
  The metals are the badge’s own values and are deliberately <em>not</em> themed — they must
  render identically to the card in light and dark. The ribbon is <code>purpure</code>, the
  guildhall’s own tincture, shared with the generated guild crests. Regenerate this page with
  <code>make medal-swatches</code>.
</footer>
</div>
`;
}

/** The same page wrapped for a file you can open directly. */
export function standalone(body: string = renderMedalSwatchPage()): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0">
${body}
</body>
</html>
`;
}
