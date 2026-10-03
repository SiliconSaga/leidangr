// Real-IO wiring for the medal badge swatch page (testable logic lives in
// medal-swatches.ts). Run by `make medal-swatches` via Node's native
// type-stripping (Node 22+ / 24), mirroring run-theme-swatches.mjs.
//
//   make medal-swatches                      → .tmp/medal-swatches.html (standalone)
//   make medal-swatches ARGS='--fragment'    → the Artifact-ready form, no skeleton
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMedalSwatchPage, standalone } from './medal-swatches.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const outFlag = args.indexOf('--out');
const outPath = path.resolve(
  repo,
  outFlag >= 0 && args[outFlag + 1]
    ? args[outFlag + 1]
    : fragment
      ? '.tmp/medal-swatches.fragment.html'
      : '.tmp/medal-swatches.html',
);

const page = renderMedalSwatchPage();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, fragment ? page : standalone(page), 'utf8');
console.log(`medal swatches → ${path.relative(repo, outPath)}`);
