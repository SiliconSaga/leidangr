// Real-IO wiring for the medal history preview page (testable logic lives in
// history-swatches.ts). Run by `make history-swatches` via Node's native
// type-stripping (Node 22+ / 24), mirroring run-medal-swatches.mjs.
//
//   make history-swatches                      → .tmp/history-swatches.html
//   make history-swatches ARGS='--fragment'    → the Artifact-ready form
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHistoryPage, standalone } from './history-swatches.ts';

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
      ? '.tmp/history-swatches.fragment.html'
      : '.tmp/history-swatches.html',
);

const page = renderHistoryPage();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, fragment ? page : standalone(page), 'utf8');
console.log(`history swatches → ${path.relative(repo, outPath)}`);
