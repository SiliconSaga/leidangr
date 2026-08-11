// Pure logic for the page-theme swatch report (real IO lives in
// run-theme-swatches.mjs). Everything here is string-in / string-out so the
// parsing and the resolution rules stay unit-testable.
//
// Why this exists: Backstage page themes are keyed by `spec.type`, and picking a
// new colour means knowing which hues are already spoken for — across both the
// stock map and our overrides — plus which types are currently falling through
// to the default. That is tedious to assemble by hand and easy to get wrong.

/** One themeable colour: a stock Backstage theme, one of ours, or a proposal. */
export interface PageThemeEntry {
  id: string;
  colors: string[];
  shape?: string;
  source: 'backstage' | 'guildhall' | 'candidate';
  /** Only set for candidates — the pitch for why this colour. */
  note?: string;
}

/** A `spec.type` found in the catalog, and the theme it actually resolves to. */
export interface TypeUsage {
  specType: string;
  entities: string[];
  /** The theme id used at render time — `home` when nothing is registered. */
  resolvesTo: string;
  registered: boolean;
}

/**
 * The theme id Backstage falls back to. `EntityLayout` resolves a page theme
 * with `entity?.spec?.type?.toString() ?? 'home'` — it reads spec.type ONLY and
 * never the kind, so an entity with no spec.type always lands here regardless of
 * what is registered.
 */
export const FALLBACK_THEME_ID = 'home';

const unquote = (v: string) => v.replace(/^['"]|['"]$/g, '');

/**
 * Normalise line endings before any line-oriented matching.
 *
 * Load-bearing on Windows, where checkouts carry CRLF: JavaScript's `.` does not
 * match `\r`, so a pattern anchored with `$` silently fails on every CRLF line
 * while succeeding on LF ones. That produced a census that looked plausible and
 * was quietly missing whole files.
 */
const normalize = (text: string) => text.replace(/\r\n?/g, '\n');

/**
 * Expand shorthand hex so every byte-pair reader sees six or eight digits.
 * Without this a `#abc` from `--candidate` reads garbage for red and NaN for
 * green and blue, and the NaN propagates silently into saturation, contrast and
 * every ΔE — producing a report that looks authoritative and means nothing.
 */
export function normalizeHex(hex: string): string {
  const v = hex.trim();
  const short = /^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/.exec(v);
  if (!short) return v;
  const [, r, g, b] = short;
  return `#${r}${r}${g}${g}${b}${b}`;
}

/**
 * Opaque colours only — #rgb or #rrggbb.
 *
 * Alpha forms are rejected rather than accepted-and-ignored. Every metric here
 * (contrast, saturation, ΔE, the CVD transforms) is defined against a solid
 * colour, so analysing `#rrggbbaa` by dropping its alpha would report numbers
 * for a colour nobody sees. Compositing would need a known backdrop, and a
 * gradient bar has two of them — the page ground in light and in dark. Refusing
 * is the honest answer until there is a reason to define that.
 */
export const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/**
 * Pull `key: genPageTheme({ colors: [...], shape: shapes.x })` entries out of
 * the plugin's pageThemes source. Parsed rather than imported because the plugin
 * is TypeScript that is only compiled as part of an app build — this script has
 * to work from a cold checkout with nothing built.
 */
export function parseGuildhallThemes(source: string): PageThemeEntry[] {
  const entries: PageThemeEntry[] = [];
  const re =
    /^\s*([A-Za-z][\w-]*):\s*genPageTheme\(\{\s*colors:\s*\[([^\]]+)\][^}]*?(?:shape:\s*shapes\.(\w+))?\s*\}\)/gm;
  for (const m of source.matchAll(re)) {
    const colors = m[2]
      .split(',')
      .map(c => unquote(c.trim()))
      .filter(c => HEX_RE.test(c))
      .map(normalizeHex);
    if (colors.length) {
      entries.push({ id: m[1], colors, shape: m[3], source: 'guildhall' });
    }
  }
  return entries;
}

/** Split a multi-document YAML string into its documents. */
export function splitDocuments(text: string): string[] {
  return normalize(text)
    .split(/^---\s*$/m)
    .map(d => d.trim())
    .filter(Boolean);
}

// Read a scalar that may be written either as a flow mapping on the parent line
// (`spec: { type: x }`) or as a block key indented exactly two spaces under it.
// The two-space requirement is load-bearing: scaffolder Templates nest their own
// `type:` keys much deeper under `parameters`, and those must not be mistaken
// for the entity's spec.type.
function readScalar(raw: string, parent: string, key: string): string | undefined {
  const doc = normalize(raw);
  const flow = doc.match(new RegExp(`^${parent}:\\s*\\{([^}]*)\\}`, 'm'));
  if (flow) {
    const m = flow[1].match(new RegExp(`(?:^|,)\\s*${key}:\\s*([^,}]+)`));
    return m ? unquote(m[1].trim()) : undefined;
  }
  const start = doc.search(new RegExp(`^${parent}:\\s*$`, 'm'));
  if (start < 0) return undefined;
  for (const line of doc.slice(start).split('\n').slice(1)) {
    if (/^\S/.test(line)) break; // reached the next top-level key
    const m = line.match(new RegExp(`^ {2}${key}:\\s*(\\S.*)$`));
    if (m) return unquote(m[1].trim());
  }
  return undefined;
}

export function specTypeOf(doc: string): string | undefined {
  return readScalar(doc, 'spec', 'type');
}

export function entityNameOf(doc: string): string | undefined {
  return readScalar(doc, 'metadata', 'name');
}

/**
 * Collect every `spec.type` across the given catalog files, with the entities
 * carrying it. Entities with no spec.type are counted under a synthetic
 * `(untyped)` bucket — they are the ones silently stuck on the fallback.
 */
export function collectSpecTypes(
  files: { path: string; text: string }[],
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of files) {
    for (const doc of splitDocuments(file.text)) {
      if (!/^kind:\s*\S+/m.test(doc)) continue;
      const name = entityNameOf(doc) ?? '(unnamed)';
      const type = specTypeOf(doc) ?? '(untyped)';
      found.set(type, [...(found.get(type) ?? []), name]);
    }
  }
  return found;
}

/** Join observed types to registered themes, flagging what hits the fallback. */
export function resolveUsage(
  types: Map<string, string[]>,
  registered: Set<string>,
): TypeUsage[] {
  return [...types.entries()]
    .map(([specType, entities]) => {
      const isRegistered = specType !== '(untyped)' && registered.has(specType);
      return {
        specType,
        entities: [...entities].sort(),
        resolvesTo: isRegistered ? specType : FALLBACK_THEME_ID,
        registered: isRegistered,
      };
    })
    .sort((a, b) => a.specType.localeCompare(b.specType));
}

/**
 * Parse `--candidate name:#hex,#hex[:note]` arguments. Proposals are passed in
 * rather than hardcoded so the same report serves both a plain "what is taken?"
 * run and a round where someone (or an agent) is pitching new colours.
 */
export function parseCandidates(args: string[]): PageThemeEntry[] {
  const out: PageThemeEntry[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--candidate') continue;
    const raw = args[i + 1];
    if (!raw) throw new Error('--candidate needs a value like name:#4E4361,#7C6E96');
    const [id, hexes, ...noteParts] = raw.split(':');
    const colors = (hexes ?? '')
      .split(',')
      .map(c => c.trim())
      .filter(c => HEX_RE.test(c))
      .map(normalizeHex);
    if (!id || !colors.length) {
      throw new Error(`could not parse --candidate ${raw} (want name:#hex,#hex)`);
    }
    out.push({
      id,
      colors,
      source: 'candidate',
      note: noteParts.join(':') || undefined,
    });
  }
  return out;
}

/** Saturation of a hex colour in 0..1, using the HSV definition. */
export function saturationOf(hex: string): number {
  const v = normalizeHex(hex);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

// ---------------------------------------------------------------------------
// Colour vision
//
// A tool for picking colours has no business ignoring the people who will read
// them differently. Everything below is a screening aid, not a verdict: it
// catches the obvious collisions so a human looks harder, and the page can be
// flipped into each simulation so you can judge with your own eyes.
// ---------------------------------------------------------------------------

export type Vision = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export const VISIONS: Vision[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];

/** Roughly how common each is, for labelling the UI honestly. */
export const VISION_LABEL: Record<Vision, string> = {
  normal: 'Normal',
  protanopia: 'Protanopia (red-blind, ~1% of men)',
  deuteranopia: 'Deuteranopia (green-blind, ~6% of men)',
  tritanopia: 'Tritanopia (blue-blind, rare)',
};

// Machado, Oliveira & Fernandes (2009) severity-1.0 matrices, applied in linear
// RGB. Chosen over a naive channel swap because it models the actual confusion
// axes rather than just muting a channel.
const CVD_MATRIX: Record<Exclude<Vision, 'normal'>, number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

const toChannels = (hex: string) =>
  [1, 3, 5].map(i => parseInt(normalizeHex(hex).slice(i, i + 2), 16) / 255);
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const toHex = (c: number) =>
  Math.round(clamp01(c) * 255)
    .toString(16)
    .padStart(2, '0');

/** Simulate how a hex colour appears under a given colour vision deficiency. */
export function simulateVision(hex: string, vision: Vision): string {
  if (vision === 'normal') return hex.toLowerCase();
  const m = CVD_MATRIX[vision];
  const [r, g, b] = toChannels(hex).map(srgbToLinear);
  const out = [
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ].map(v => linearToSrgb(clamp01(v)));
  return `#${out.map(toHex).join('')}`;
}

/** Relative luminance per WCAG 2.x. */
export function luminance(hex: string): number {
  const [r, g, b] = toChannels(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toLab(hex: string): [number, number, number] {
  const [r, g, b] = toChannels(hex).map(srgbToLinear);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference. Crude next to CIEDE2000, but ample for "are these two the same at a glance". */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Below this, two large flat colours read as the same at a glance. Deliberately
 * generous — page headers are big blocks seen apart from each other, not
 * swatches held side by side, so near-misses are worth surfacing.
 */
export const CONFUSABLE_DELTA_E = 14;

export interface Confusion {
  a: string;
  b: string;
  vision: Vision;
  normalDelta: number;
  visionDelta: number;
}

/**
 * Pairs that are clearly distinct to normal vision but collapse under a
 * simulation. Pairs already similar for everyone are not reported — that is a
 * palette choice, not an accessibility regression.
 */
export function findConfusions(
  entries: PageThemeEntry[],
  threshold = CONFUSABLE_DELTA_E,
): Confusion[] {
  const found: Confusion[] = [];
  // Entries with no colours cannot be compared at all — drop them rather than
  // feed undefined into the colour maths, where it surfaces as a NaN verdict.
  const usable = entries.filter(e => e.colors.length > 0);

  // Compare EVERY rendered stop, not just the first. Both ends of a gradient
  // are on screen, so two headers whose left edges differ can still be
  // indistinguishable at their right edges. Single-stop themes are expanded the
  // same way gradient() expands them, so what is compared is what is painted.
  const stopsOf = (e: PageThemeEntry) =>
    e.colors.length === 1 ? [e.colors[0], e.colors[0]] : e.colors;

  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const [x, y] = [usable[i], usable[j]];
      const [xs, ys] = [stopsOf(x), stopsOf(y)];
      const pairs = Math.min(xs.length, ys.length);
      for (const vision of VISIONS) {
        if (vision === 'normal') continue;
        // A pair is confusable only when it collapses at EVERY stop that was
        // distinct to begin with. One stop matching is not enough: both ends of
        // a gradient are on screen, so if the left edges stay far apart the two
        // headers remain tellable apart regardless of what the right edges do.
        // Flagging any single stop over-reports — it would condemn guild
        // against practice, whose right edges converge under protanopia while
        // their left edges never do.
        let distinct = 0;
        let collapsed = 0;
        let worst: Pick<Confusion, 'normalDelta' | 'visionDelta'> | undefined;
        for (let k = 0; k < pairs; k++) {
          const normalDelta = deltaE(xs[k], ys[k]);
          if (normalDelta < threshold) continue; // alike for everyone here
          distinct++;
          const visionDelta = deltaE(
            simulateVision(xs[k], vision),
            simulateVision(ys[k], vision),
          );
          if (visionDelta >= threshold) continue;
          collapsed++;
          if (!worst || visionDelta < worst.visionDelta) worst = { normalDelta, visionDelta };
        }
        if (worst && distinct > 0 && collapsed === distinct) {
          found.push({ a: x.id, b: y.id, vision, ...worst });
        }
      }
    }
  }
  return found.sort((p, q) => p.visionDelta - q.visionDelta);
}

/**
 * Page themes render white header text, so a stop that is too light fails
 * everyone, not just colour-blind readers. 3:1 is the WCAG AA bar for large
 * text, which is what a page header is.
 */
export const MIN_CONTRAST = 3;

export function contrastWarnings(entries: PageThemeEntry[]): { id: string; hex: string; ratio: number }[] {
  const out: { id: string; hex: string; ratio: number }[] = [];
  for (const e of entries) {
    for (const hex of e.colors) {
      const ratio = contrastRatio(hex, '#FFFFFF');
      if (ratio < MIN_CONTRAST) out.push({ id: e.id, hex, ratio });
    }
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const gradient = (colors: string[]) =>
  `linear-gradient(90deg, ${(colors.length === 1 ? [colors[0], colors[0]] : colors).join(', ')})`;

/**
 * Each bar carries all four renderings as custom properties, and the vision
 * radios swap which one is painted. Simulating in CSS rather than shipping four
 * copies of every row means you compare the same layout, not four small ones.
 */
function visionVars(colors: string[]): string {
  return VISIONS.map(v => `--${v}: ${gradient(colors.map(c => simulateVision(c, v)))}`).join('; ');
}

function swatchRow(entry: PageThemeEntry, usage?: TypeUsage): string {
  const used = usage
    ? `${usage.entities.length} entit${usage.entities.length === 1 ? 'y' : 'ies'} — <em>${esc(
        usage.entities.slice(0, 6).join(', '),
      )}${usage.entities.length > 6 ? ', …' : ''}</em>`
    : '<em>no entity uses this today</em>';
  const worst = Math.min(...entry.colors.map(c => contrastRatio(c, '#FFFFFF')));
  const contrastFlag =
    worst < MIN_CONTRAST
      ? ` <span class="warn-chip">white text ${worst.toFixed(1)}:1</span>`
      : '';
  return `      <div class="row${entry.source === 'candidate' ? ' tall' : ''}">
        <div class="bar" style="${visionVars(entry.colors)}">${esc(entry.id)}</div>
        <div class="meta">
          <span class="use">${entry.note ? esc(entry.note) : used}${contrastFlag}</span>
          <span class="hex">${entry.colors.map(esc).join(' → ')}${
            entry.shape ? ` · ${esc(entry.shape)}` : ''
          } · sat ${entry.colors.map(c => saturationOf(c).toFixed(2)).join(' / ')}</span>
        </div>
      </div>`;
}

/**
 * Group findings by whether they are ours to fix. An undifferentiated list is
 * how an accessibility report gets ignored: most collisions in a Backstage
 * palette are between two stock themes, which no amount of care here can change.
 * Those still belong on the page — they constrain future choices — but never
 * above the ones we own.
 */
function accessibilitySection(entries: PageThemeEntry[], usage: TypeUsage[]): string {
  const sourceOf = new Map(entries.map(e => [e.id, e.source]));
  const inUse = new Set(usage.filter(u => u.registered).map(u => u.specType));
  const isOurs = (id: string) => sourceOf.get(id) !== 'backstage';

  const confusions = findConfusions(entries);
  const ours = confusions.filter(c => isOurs(c.a) && isOurs(c.b));

  // Ours against a stock default splits by whether that default is *rendered*.
  // Testing "either half is in use" would pass on our half alone — which is
  // always in use — and file a dormant stock colour as a live collision.
  const oneSided = confusions.filter(c => isOurs(c.a) !== isOurs(c.b));
  const stockHalfLive = (c: Confusion) => inUse.has(isOurs(c.a) ? c.b : c.a);
  const mixed = oneSided.filter(stockHalfLive);
  const dormant = oneSided.filter(c => !stockHalfLive(c));
  const stock = confusions.filter(c => !ours.includes(c) && !oneSided.includes(c));

  const contrast = contrastWarnings(entries);
  const contrastOurs = contrast.filter(c => isOurs(c.id));
  const contrastStock = contrast.filter(c => !isOurs(c.id));

  const line = (c: Confusion) =>
    `      <li><strong>${esc(c.a)}</strong> and <strong>${esc(c.b)}</strong> converge under
      ${esc(VISION_LABEL[c.vision])} — apart by ΔE ${c.normalDelta.toFixed(0)} normally,
      ${c.visionDelta.toFixed(0)} simulated.</li>`;

  const contrastLine = (c: { id: string; hex: string; ratio: number }) =>
    `      <li><strong>${esc(c.id)}</strong> ${esc(c.hex)} gives white header text only
      ${c.ratio.toFixed(1)}:1 — under the ${MIN_CONTRAST}:1 WCAG bar for large text.</li>`;

  const group = (title: string, note: string, rows: string[]) =>
    rows.length
      ? `    <p class="finding-head">${esc(title)}</p>
    <p class="section-note">${esc(note)}</p>
    <ul class="findings">
${rows.join('\n')}
    </ul>`
      : '';

  const actionable = [...ours, ...mixed].length + contrastOurs.length;

  return `  <section>
    <p class="eyebrow">Accessibility</p>
    <p class="section-note">A screening pass, not a verdict — flip the radios above and judge with
    your own eyes. Confusion is only reported for pairs that are clearly distinct to normal vision
    and collapse under a simulation, since a pair that looks alike to everyone is a palette choice
    rather than an accessibility regression.</p>
    ${
      actionable === 0
        ? `<p class="ok">Nothing of ours collides above ΔE ${CONFUSABLE_DELTA_E}, and every colour we
    define clears ${MIN_CONTRAST}:1 for white header text.</p>`
        : ''
    }
${group('Ours — fix these', 'Both colours are defined in this repo, so both are ours to move.', [
  ...ours.map(line),
  ...contrastOurs.map(contrastLine),
])}
${group(
  'Ours against a stock colour in use',
  'One side is a Backstage default that entities here actually render, so the collision is real even though only our half can move.',
  mixed.map(line),
)}
${group(
  'Ours against a stock colour nothing renders yet',
  'No entity resolves to that default today, so nothing is wrong on screen. It still costs you the hue: adopting that spec.type later would bring the collision with it.',
  dormant.map(line),
)}
${group(
  'Between stock defaults — context only',
  'Neither colour is ours. Nothing to fix, but worth knowing before claiming a hue near either of them.',
  [...stock.map(line), ...contrastStock.map(contrastLine)],
)}
  </section>`;
}

// `note` is interpolated raw so section copy can carry <code> markup. Callers
// must pass authored, static text — never anything read from the catalog or a
// CLI arg. Candidate notes, which DO come from user input, go through esc().
function section(title: string, note: string, rows: string): string {
  if (!rows.trim()) return '';
  return `  <section>
    <p class="eyebrow">${esc(title)}</p>
    ${note ? `<p class="section-note">${note}</p>` : ''}
    <div class="rows">
${rows}
    </div>
  </section>`;
}

export interface RenderInput {
  themes: PageThemeEntry[];
  usage: TypeUsage[];
  candidates: PageThemeEntry[];
  generatedAt: string;
}

/**
 * Render the standalone swatch page. Self-contained (no network, no fonts) so
 * it opens straight from disk.
 */
export function renderSwatchPage(input: RenderInput): string {
  const { themes, usage, candidates, generatedAt } = input;
  const byType = new Map(usage.map(u => [u.specType, u]));
  const inUse = (e: PageThemeEntry) => byType.get(e.id);

  const ours = themes.filter(t => t.source === 'guildhall');
  const stockUsed = themes.filter(t => t.source === 'backstage' && inUse(t));
  const stockFree = themes.filter(t => t.source === 'backstage' && !inUse(t));
  const orphans = usage.filter(u => !u.registered);

  const orphanRows = orphans
    .map(
      u => `      <div class="row">
        <div class="bar" style="${visionVars(['#005B4B'])}">${esc(u.specType)} → home</div>
        <div class="meta">
          <span class="use">${esc(u.entities.slice(0, 6).join(', '))}${
            u.entities.length > 6 ? ', …' : ''
          }</span>
          <span class="hex">falls through to the default teal</span>
        </div>
      </div>`,
    )
    .join('\n');

  // A standalone document opened over file://, so it declares its own head.
  // The charset is load-bearing rather than ceremonial: without it a browser
  // may fall back to a system codepage and mangle the em-dashes, arrows and ΔE
  // this report is full of.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Backstage page themes — swatches</title>
<style>
  :root {
    --ground:#F7F5FA; --raised:#FFF; --ink:#1B1824; --ink-soft:#514A61;
    --ink-faint:#8A8399; --rule:#E2DDEA; --rule-strong:#CFC7DB; --accent:#6A1B9A;
    --warn-bg:#FBF3E7; --warn-rule:#E4C9A0; --warn-ink:#6B4A17;
    --display:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;
    --body:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    --mono:ui-monospace,'SF Mono',SFMono-Regular,'Cascadia Mono',Menlo,Consolas,monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root { --ground:#131019; --raised:#1B1723; --ink:#EDE9F4; --ink-soft:#B3AAC4;
      --ink-faint:#7C7390; --rule:#2A2436; --rule-strong:#3B3349; --accent:#B77BD8;
      --warn-bg:#241C10; --warn-rule:#4E3D1E; --warn-ink:#D8B77A; }
  }
  :root[data-theme='dark'] { --ground:#131019; --raised:#1B1723; --ink:#EDE9F4;
    --ink-soft:#B3AAC4; --ink-faint:#7C7390; --rule:#2A2436; --rule-strong:#3B3349;
    --accent:#B77BD8; --warn-bg:#241C10; --warn-rule:#4E3D1E; --warn-ink:#D8B77A; }
  :root[data-theme='light'] { --ground:#F7F5FA; --raised:#FFF; --ink:#1B1824;
    --ink-soft:#514A61; --ink-faint:#8A8399; --rule:#E2DDEA; --rule-strong:#CFC7DB;
    --accent:#6A1B9A; --warn-bg:#FBF3E7; --warn-rule:#E4C9A0; --warn-ink:#6B4A17; }
  body { margin:0; background:var(--ground); color:var(--ink); font-family:var(--body);
    line-height:1.55; -webkit-font-smoothing:antialiased; }
  .page { max-width:62rem; margin:0 auto; padding:3.5rem 1.5rem 6rem;
    display:flex; flex-direction:column; gap:3rem; }
  h1 { font-family:var(--display); font-size:clamp(1.9rem,4vw,2.6rem); font-weight:600;
    letter-spacing:-.015em; margin:0 0 .6rem; text-wrap:balance; }
  .lede { margin:0; max-width:62ch; color:var(--ink-soft); }
  .note { background:var(--warn-bg); border:1px solid var(--warn-rule); border-radius:3px;
    padding:.9rem 1.1rem; color:var(--warn-ink); font-size:.92rem; max-width:62ch; }
  section { display:flex; flex-direction:column; gap:1rem; }
  .eyebrow { font-size:.72rem; text-transform:uppercase; letter-spacing:.13em; font-weight:650;
    color:var(--ink-faint); margin:0; padding-bottom:.55rem; border-bottom:1px solid var(--rule-strong); }
  .section-note { margin:-.35rem 0 0; color:var(--ink-soft); font-size:.92rem; max-width:62ch; }
  .rows { display:flex; flex-direction:column; gap:.85rem; }
  .row { display:grid; grid-template-columns:minmax(11rem,15rem) 1fr; gap:.35rem 1.25rem; align-items:center; }
  @media (max-width:40rem) { .row { grid-template-columns:1fr; } }
  .bar { height:2.4rem; border-radius:3px; border:1px solid rgba(0,0,0,.18); display:flex;
    align-items:center; padding:0 .7rem; color:#fff; font-size:.8rem; font-weight:600;
    text-shadow:0 1px 2px rgba(0,0,0,.45); background:var(--normal); }
  /* Vision simulation: the radios live before .page so a sibling selector can
     repaint every bar at once. Pure CSS — no script, and the controls stay real
     focusable radios. */
  .vision-input { position:absolute; opacity:0; pointer-events:none; }
  #v-protanopia:checked ~ .page .bar { background:var(--protanopia); }
  #v-deuteranopia:checked ~ .page .bar { background:var(--deuteranopia); }
  #v-tritanopia:checked ~ .page .bar { background:var(--tritanopia); }
  /* A control strip, not body copy — it sat inside the intro text and read as
     part of the prose. Standing alone above the first section, with the page's
     3rem gap either side, it reads as something you operate. */
  .vision-bar { display:flex; flex-direction:column; gap:.85rem; padding:.5rem 0; }
  .vision { display:flex; flex-wrap:wrap; gap:.4rem; }
  .vision label { font-size:.78rem; padding:.3rem .7rem; border:1px solid var(--rule-strong);
    border-radius:999px; cursor:pointer; color:var(--ink-soft); }
  .vision label:hover { border-color:var(--accent); color:var(--ink); }
  #v-normal:checked ~ .page label[for='v-normal'],
  #v-protanopia:checked ~ .page label[for='v-protanopia'],
  #v-deuteranopia:checked ~ .page label[for='v-deuteranopia'],
  #v-tritanopia:checked ~ .page label[for='v-tritanopia'] {
    background:var(--accent); border-color:var(--accent); color:#fff; }
  .vision-input:focus-visible ~ .page label[for] { outline:2px solid var(--accent); outline-offset:2px; }
  .warn-chip { display:inline-block; font-size:.7rem; font-weight:700; padding:.05rem .4rem;
    border:1px solid var(--warn-rule); background:var(--warn-bg); color:var(--warn-ink);
    border-radius:2px; margin-left:.4rem; }
  .findings { margin:0; padding-left:1.1rem; display:flex; flex-direction:column; gap:.45rem;
    font-size:.9rem; color:var(--ink); max-width:70ch; }
  .ok { margin:0; font-size:.9rem; color:var(--ink-soft); }
  .finding-head { margin:.6rem 0 -.5rem; font-size:.85rem; font-weight:700; color:var(--ink); }
  .row.tall .bar { height:3.5rem; font-size:.9rem; }
  .meta { display:flex; flex-direction:column; gap:.15rem; min-width:0; }
  .hex { font-family:var(--mono); font-size:.78rem; font-variant-numeric:tabular-nums; color:var(--ink-soft); }
  .use { font-size:.88rem; }
  .use em { color:var(--ink-faint); font-style:normal; }
  code { font-family:var(--mono); font-size:.86em; background:var(--raised);
    border:1px solid var(--rule); border-radius:2px; padding:.05em .3em; }
  footer { border-top:1px solid var(--rule-strong); padding-top:1.2rem; color:var(--ink-faint);
    font-size:.85rem; max-width:62ch; }
</style>
</head>
<body>
${VISIONS.map(
  v =>
    `<input class="vision-input" type="radio" name="vision" id="v-${v}"${
      v === 'normal' ? ' checked' : ''
    }>`,
).join('\n')}
<div class="page">
  <header>
    <h1>Backstage page themes — what's taken, what's free</h1>
    <p class="lede">Generated from the stock <code>@backstage/theme</code> map, this repo's
    <code>guildhallPageThemes</code>, and the <code>spec.type</code> values actually present in the
    catalog. Bars show the raw gradient — in the app each also carries a white wave mask, which
    lightens but does not shift the hue. Saturation is printed because it is often the only axis
    left once a hue band fills up.</p>
  </header>
  <div class="note"><strong>A theme key is a <code>spec.type</code>, never a kind.</strong>
  <code>EntityLayout</code> resolves with <code>entity?.spec?.type ?? 'home'</code>, so a theme named
  after a kind can never match, and any entity without a <code>spec.type</code> renders the default
  teal <code>#005B4B</code> no matter what is registered.</div>
  <div class="vision-bar">
    <p class="eyebrow">Colour vision</p>
    <div class="vision">
${VISIONS.map(v => `      <label for="v-${v}">${esc(VISION_LABEL[v])}</label>`).join('\n')}
    </div>
    <p class="section-note">Repaints every bar below. Deuteranopia is the one worth checking by
    default — it is by far the most common, and it is the one that flattens the red-green
    separation most palettes lean on.</p>
  </div>
${section('Registered here', 'Defined by this repo and overriding the stock map.', ours.map(e => swatchRow(e, inUse(e))).join('\n'))}
${section('Stock themes in use', 'Backstage defaults that entities in this catalog actually resolve to.', stockUsed.map(e => swatchRow(e, inUse(e))).join('\n'))}
${section('Stock themes unused here', 'Defined by Backstage but unreached today — still worth avoiding, since a future spec.type could land on one.', stockFree.map(e => swatchRow(e)).join('\n'))}
${section('Falling through to the fallback', 'These types have no registered theme, so every one of them renders the same teal.', orphanRows)}
${section('Candidates', 'Proposals passed in with --candidate. Nothing here is registered yet.', candidates.map(e => swatchRow(e)).join('\n'))}
${accessibilitySection([...themes, ...candidates], usage)}
  <footer>Generated ${esc(generatedAt)} by <code>make theme-swatches</code>. Re-run after changing
  <code>pageThemes.ts</code> or adding entity types.</footer>
</div>
</body>
</html>
`;
}
