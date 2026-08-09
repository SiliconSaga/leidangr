// Real-IO wiring for the page-theme swatch report (testable logic lives in
// theme-swatches.ts). Run by `make theme-swatches` via Node's native
// type-stripping (Node 22+ / 24).
//
//   make theme-swatches
//   make theme-swatches ARGS='--candidate plum:#4A1942,#7A2E63:past guild, darker than pink'
//
// Reads the stock theme map straight from @backstage/theme so the defaults can
// never drift from what the app actually renders. Our own themes are parsed from
// source instead — the plugin is TypeScript that only exists compiled inside an
// app build, and this has to work from a cold checkout.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseGuildhallThemes,
  collectSpecTypes,
  resolveUsage,
  parseCandidates,
  renderSwatchPage,
} from './theme-swatches.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const outPath = path.resolve(
  repo,
  outFlag >= 0 && args[outFlag + 1] ? args[outFlag + 1] : '.tmp/theme-swatches.html',
);

// Every catalog file we can find, so the usage picture matches the real catalog.
function catalogFiles() {
  const found = [];
  const walk = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.ya?ml$/.test(e.name)) found.push(full);
    }
  };
  walk(path.join(repo, 'examples'));
  walk(path.join(repo, 'plugins'));
  found.push(path.join(repo, 'catalog-info.yaml'));
  return found
    .filter(f => fs.existsSync(f))
    .map(f => ({ path: path.relative(repo, f), text: fs.readFileSync(f, 'utf8') }))
    // Only files that actually declare entities — app-config and CI YAML would
    // otherwise contribute noise to the type census.
    .filter(f => /^kind:\s*\S+/m.test(f.text));
}

// Deep import on purpose. The package root pulls in UnifiedTheme, which does a
// directory import of `@material-ui/core/styles` that plain Node ESM refuses
// (ERR_UNSUPPORTED_DIR_IMPORT). This leaf module holds the colour tables and
// nothing else, so it loads cleanly outside a bundler. @backstage/theme ships no
// `exports` map, so the deep path is reachable.
const themePkg = '@backstage/theme/dist/base/pageTheme.esm.js';
let stock;
try {
  ({ pageTheme: stock } = await import(themePkg));
} catch (err) {
  console.error(`theme-swatches: could not load ${themePkg} — the package layout changed.`);
  console.error(`  ${err.message}`);
  process.exit(1);
}

const stockThemes = Object.entries(stock).map(([id, pt]) => ({
  id,
  colors: pt.colors,
  source: 'backstage',
}));

const themesSource = fs.readFileSync(
  path.join(repo, 'plugins', 'gildi', 'src', 'theme', 'pageThemes.ts'),
  'utf8',
);
const ours = parseGuildhallThemes(themesSource);
if (ours.length === 0) {
  console.error('theme-swatches: parsed 0 themes from pageThemes.ts — the format changed.');
  process.exit(1);
}

const candidates = parseCandidates(args);
const usage = resolveUsage(
  collectSpecTypes(catalogFiles()),
  new Set([...stockThemes, ...ours].map(t => t.id)),
);

const html = renderSwatchPage({
  // Ours last so an override shadows the stock entry of the same id.
  themes: [...stockThemes, ...ours],
  usage,
  candidates,
  generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');

const orphans = usage.filter(u => !u.registered);
console.log(`  themes   ${stockThemes.length} stock + ${ours.length} ours (${ours.map(t => t.id).join(', ')})`);
console.log(`  types    ${usage.length} spec.type values across the catalog`);
if (orphans.length) {
  console.log(`  fallback ${orphans.length} unthemed → home teal: ${orphans.map(o => o.specType).join(', ')}`);
}
if (candidates.length) {
  console.log(`  proposed ${candidates.map(c => c.id).join(', ')}`);
}
console.log(`\n  wrote ${path.relative(repo, outPath)} — open it in a browser`);
