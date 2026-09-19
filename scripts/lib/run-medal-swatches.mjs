// Real-IO wiring for the medal badge swatch page (testable logic lives in
// medal-swatches.ts). Run by `make medal-swatches` via Node's native
// type-stripping (Node 22+ / 24), mirroring run-theme-swatches.mjs.
//
//   make medal-swatches
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMedalSwatchPage } from './medal-swatches.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const outPath = path.resolve(
  repo,
  outFlag >= 0 && args[outFlag + 1] ? args[outFlag + 1] : '.tmp/medal-swatches.html',
);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, renderMedalSwatchPage(), 'utf8');
console.log(`medal swatches → ${path.relative(repo, outPath)}`);
