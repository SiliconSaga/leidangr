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
      .filter(c => /^#[0-9A-Fa-f]{3,8}$/.test(c));
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
      .filter(c => /^#[0-9A-Fa-f]{3,8}$/.test(c));
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
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const gradient = (colors: string[]) =>
  `linear-gradient(90deg, ${(colors.length === 1 ? [colors[0], colors[0]] : colors).join(', ')})`;

function swatchRow(entry: PageThemeEntry, usage?: TypeUsage): string {
  const used = usage
    ? `${usage.entities.length} entit${usage.entities.length === 1 ? 'y' : 'ies'} — <em>${esc(
        usage.entities.slice(0, 6).join(', '),
      )}${usage.entities.length > 6 ? ', …' : ''}</em>`
    : '<em>no entity uses this today</em>';
  return `      <div class="row${entry.source === 'candidate' ? ' tall' : ''}">
        <div class="bar" style="background: ${gradient(entry.colors)}">${esc(entry.id)}</div>
        <div class="meta">
          <span class="use">${entry.note ? esc(entry.note) : used}</span>
          <span class="hex">${entry.colors.map(esc).join(' → ')}${
            entry.shape ? ` · ${esc(entry.shape)}` : ''
          } · sat ${entry.colors.map(c => saturationOf(c).toFixed(2)).join(' / ')}</span>
        </div>
      </div>`;
}

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
        <div class="bar" style="background: ${gradient(['#005B4B'])}">${esc(u.specType)} → home</div>
        <div class="meta">
          <span class="use">${esc(u.entities.slice(0, 6).join(', '))}${
            u.entities.length > 6 ? ', …' : ''
          }</span>
          <span class="hex">falls through to the default teal</span>
        </div>
      </div>`,
    )
    .join('\n');

  return `<title>Backstage page themes — swatches</title>
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
    text-shadow:0 1px 2px rgba(0,0,0,.45); }
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
${section('Registered here', 'Defined by this repo and overriding the stock map.', ours.map(e => swatchRow(e, inUse(e))).join('\n'))}
${section('Stock themes in use', 'Backstage defaults that entities in this catalog actually resolve to.', stockUsed.map(e => swatchRow(e, inUse(e))).join('\n'))}
${section('Stock themes unused here', 'Defined by Backstage but unreached today — still worth avoiding, since a future spec.type could land on one.', stockFree.map(e => swatchRow(e)).join('\n'))}
${section('Falling through to the fallback', 'These types have no registered theme, so every one of them renders the same teal.', orphanRows)}
${section('Candidates', 'Proposals passed in with --candidate. Nothing here is registered yet.', candidates.map(e => swatchRow(e)).join('\n'))}
  <footer>Generated ${esc(generatedAt)} by <code>make theme-swatches</code>. Re-run after changing
  <code>pageThemes.ts</code> or adding entity types.</footer>
</div>
`;
}
