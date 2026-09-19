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

export interface MedalSwatch {
  state: string;
  label: string;
  meaning: string;
  earned: boolean;
}

export const METAL: Record<string, { fill: string; rim: string; charge: string }> = {
  gold: { fill: '#d9b23a', rim: '#8f7220', charge: '#4a3c10' },
  silver: { fill: '#dcdce0', rim: '#9a9aa2', charge: '#4a4a52' },
  bronze: { fill: '#a9713b', rim: '#6d4724', charge: '#2f1e0f' },
};

export const MUTED = '#8a8a94';
export const RIBBON = '#6b3a6b';

export const SWATCHES: MedalSwatch[] = [
  {
    state: 'gold',
    label: 'gold',
    meaning: 'Every applicable trial passed. Complete at any standard size (ADR 0013).',
    earned: true,
  },
  {
    state: 'silver',
    label: 'silver',
    meaning: 'One trial short of complete.',
    earned: true,
  },
  {
    state: 'bronze',
    label: 'bronze',
    meaning: 'At least one applicable trial passed.',
    earned: true,
  },
  {
    state: 'none',
    label: 'none',
    meaning:
      'A VERDICT ABOUT THE COMPONENT — we measured, and nothing passed. On the tier scale, so it keeps the medal silhouette and simply holds no metal.',
    earned: false,
  },
  {
    state: 'withheld',
    label: 'withheld',
    meaning:
      'A statement about US — a trial could not be measured, so the medal is suppressed rather than denied. NOT a lower rank, so not a medal shape.',
    earned: false,
  },
  {
    state: 'unevaluated',
    label: 'not evaluated',
    meaning:
      'Also about us, one step earlier — we never learned what the trials were. Same kind of answer as withheld, different cause.',
    earned: false,
  },
];

export function medallionSvg(state: string, size = 44): string {
  const m = METAL[state];
  const star =
    '24,27 26.6,34.2 34.2,34.2 28.1,38.7 30.4,46 24,41.5 17.6,46 19.9,38.7 13.8,34.2 21.4,34.2';
  return `<svg width="${size}" height="${(size * 60) / 48}" viewBox="0 0 48 60" role="img" aria-label="${state}">
    <path d="M17 6 L24 22 L31 6" fill="none" stroke="${RIBBON}" stroke-width="4" opacity="${m ? 1 : 0.4}"/>
    <circle cx="24" cy="36" r="15" fill="${m ? m.fill : 'none'}" stroke="${m ? m.rim : MUTED}" stroke-width="2.5"${m ? '' : ' stroke-dasharray="3 3"'}/>
    ${m ? `<polygon points="${star}" fill="${m.charge}"/>` : ''}
  </svg>`;
}

export function noVerdictSvg(size = 44): string {
  return `<svg width="${size}" height="${(size * 60) / 48}" viewBox="0 0 48 60" role="img" aria-label="no verdict">
    <polygon points="24,17 39,36 24,55 9,36" fill="none" stroke="${MUTED}" stroke-width="2.5" stroke-dasharray="3 3"/>
    <rect x="16" y="34.5" width="16" height="3" fill="${MUTED}" rx="1.5"/>
  </svg>`;
}

export function markFor(state: string, size = 44): string {
  return state === 'withheld' || state === 'unevaluated'
    ? noVerdictSvg(size)
    : medallionSvg(state, size);
}

export function renderMedalSwatchPage(swatches: MedalSwatch[] = SWATCHES): string {
  const rows = swatches
    .map(
      s => `<tr>
      <td class="mark">${markFor(s.state)}</td>
      <td><code>${s.state}</code></td>
      <td class="${s.earned ? 'earned' : 'gap'}">${s.label}</td>
      <td class="meaning">${s.meaning}</td>
    </tr>`,
    )
    .join('\n');

  // Also rendered at the size the card actually uses, because a mark that
  // reads at 44px and turns to mud at 26px is a mark that does not work.
  const inline = swatches
    .map(s => `<span class="chip">${markFor(s.state, 26)}<em>${s.label}</em></span>`)
    .join('\n');

  return `<!doctype html>
<meta charset="utf-8">
<title>Guildhall medal badges</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; max-width: 60rem; color: #23232a; }
  h1 { font-size: 1.3rem; }
  p.lede { color: #55555f; }
  table { border-collapse: collapse; width: 100%; margin-top: 1.5rem; }
  td { border-top: 1px solid #e4e4ea; padding: 12px 10px; vertical-align: middle; }
  td.mark { width: 60px; text-align: center; }
  td.meaning { color: #55555f; }
  .earned { font-weight: 600; }
  .gap { color: ${MUTED}; }
  code { background: #f2f2f6; padding: 1px 5px; border-radius: 3px; }
  .strip { margin-top: 2rem; padding: 1rem; background: #fafafc; border: 1px solid #e4e4ea; border-radius: 6px; display: flex; gap: 22px; flex-wrap: wrap; align-items: center; }
  .chip { display: inline-flex; align-items: center; gap: 5px; }
  .chip em { font-style: normal; font-size: 12px; }
</style>
<h1>Guildhall medal badges</h1>
<p class="lede">
  Six states, not three. The three earned tiers share one silhouette; <code>none</code>
  keeps that silhouette voided because it is a real measurement at the bottom of the
  same ladder; <code>withheld</code> and <code>unevaluated</code> get a different shape
  entirely, because they are a different <em>kind</em> of answer rather than a lower rank.
</p>
<table>
${rows}
</table>
<div class="strip">
${inline}
</div>
<p class="lede">Above: the same marks at the 26px the card renders them at.</p>
`;
}
