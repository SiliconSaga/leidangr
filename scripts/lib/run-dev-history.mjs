// Seeds fabricated trial history into an ALREADY RUNNING dev stack, so the
// medal history chart can be looked at in the app rather than only on the
// preview page.
//
//   terminal 1:  make dev-facts      # boots the app, seeds one real run each
//   terminal 2:  make dev-history    # seeds a history behind those runs
//
// ⚠ IT RUNS AGAINST A LIVE BACKEND ON PURPOSE. The dev database is `:memory:`,
// so there is nothing to write to before the app is up and nothing left to clean
// up after it stops — restarting the app IS the reset. That also means this adds
// to whatever is already there: seeding twice gives you two histories layered on
// each other, which is a restart away from fixed.
//
// ⚠ THE RUNS IT WRITES ARE FICTION. They say gold on days nobody measured
// anything. That is the whole point — and the reason the endpoint behind this is
// gated twice and never mounted outside a local stack. See devSeed.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, pairsIn } from './dev-history.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const base = process.env.GILDI_BASE_URL ?? 'http://localhost:7007';

// dev-facts writes a static external-access token into a gitignored file so it
// can reach the API while the app runs with guest auth. Reusing it is what lets
// this be a second terminal rather than a second boot.
function token() {
  if (process.env.GILDI_TOKEN) return process.env.GILDI_TOKEN;
  const file = path.join(repo, '.dev', 'app-config.devfacts.yaml');
  const found = fs.existsSync(file)
    ? /token:\s*(\S+)/.exec(fs.readFileSync(file, 'utf8'))?.[1]
    : undefined;
  if (found) return found;
  console.error(
    'dev-history: no token. Start the stack with `make dev-facts` (it writes one),\n' +
      '  or export GILDI_TOKEN to match an externalAccess token the backend accepts.',
  );
  process.exit(1);
}

const auth = { Authorization: `Bearer ${token()}` };

const die = (...lines) => {
  for (const line of lines) console.error(line);
  process.exit(1);
};

let catalog;
try {
  const res = await fetch(`${base}/api/catalog/entities?filter=kind=component`, {
    headers: auth,
  });
  if (!res.ok) die(`dev-history: the catalog answered ${res.status}.`);
  catalog = await res.json();
} catch (err) {
  die(
    `dev-history: could not reach ${base} — ${err.message}`,
    '  This seeds a RUNNING stack. Start one with `make dev-facts` first.',
  );
}

const pairs = pairsIn(catalog);
if (pairs.length === 0) {
  die(
    'dev-history: no enrolled components in the catalog, so there is nothing to seed.',
    '  If the stack has just booted the catalog may still be ingesting — give it a moment.',
  );
}

// `Date.now()` once, not per pair: the scenarios are anchored to "now" and a
// clock read per component would stagger them by however long the seeding took.
const plans = plan(pairs, Date.now());

let seeded = 0;
let failed = 0;
for (const p of plans) {
  const url =
    `${base}/api/gildi/dev/trials/${encodeURIComponent(p.entityRef)}/seed` +
    `?aspect=${encodeURIComponent(p.aspectId)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ runs: p.runs }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 404 is the gate doing its job, and the likeliest thing to go wrong.
      const hint =
        res.status === 404
          ? ' — the dev seed endpoint is not mounted; GILDI_DEV_SEED=1 must be set on the SERVER process'
          : '';
      console.error(`  ?? ${p.entityRef} / ${p.aspectId} — ${res.status}${hint}`);
      if (body && res.status !== 404) console.error(`     ${body.slice(0, 300)}`);
      failed++;
      continue;
    }
    console.log(`  ok ${p.entityRef} / ${p.aspectId} — "${p.scenario}" (${p.runs.length} runs)`);
    seeded++;
  } catch (err) {
    console.error(`  ?? ${p.entityRef} / ${p.aspectId} — ${err.message}`);
    failed++;
  }
}

console.log('');
if (seeded === 0) {
  die(`dev-history: NOTHING was seeded — all ${failed} attempts failed.`);
}
if (failed > 0) {
  console.log(`dev-history: seeded ${seeded}, failed ${failed}. The failures are above.`);
} else {
  console.log(`dev-history: seeded ${seeded}.`);
}
console.log('');
console.log('  http://localhost:3000/catalog/default/component/hygiene-testsite');
console.log('');
console.log('  These are the same cases `make history-swatches` draws, anchored to now —');
console.log('  so the app and the preview page should show the same shapes. The sweep');
console.log('  still appends real runs on top as it fires.');
