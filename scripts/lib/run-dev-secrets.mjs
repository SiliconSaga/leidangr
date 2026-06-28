// Renderer for `scripts/dev-secrets`: reads `bao kv get -format=json` output from
// stdin, validates the required keys, and renders the gitignored .env.local using
// the tested logic in dev-secrets.ts. Prints key presence only — never values.
import { writeFileSync, readFileSync } from 'node:fs';
import { validateKeys, renderEnvLocal } from './dev-secrets.ts';

const REQUIRED = ['gitea_token'];
const MAPPING = { gitea_token: 'GITEA_TOKEN' };

const raw = readFileSync(0, 'utf8'); // fd 0 = stdin

let data;
try {
  const parsed = JSON.parse(raw);
  // OpenBao KV v2 nests under .data.data; KV v1 uses .data.
  data = parsed?.data?.data ?? parsed?.data ?? {};
} catch {
  console.error('dev-secrets: could not parse OpenBao KV JSON from stdin');
  process.exit(1);
}

const { ok, missing } = validateKeys(data, REQUIRED);
if (!ok) {
  console.error(
    `dev-secrets: missing required key(s): ${missing.join(', ')} — .env.local not written`,
  );
  process.exit(1);
}

const { content, presentKeys } = renderEnvLocal(data, MAPPING);
writeFileSync('.env.local', content);
console.log(`dev-secrets: wrote .env.local (${presentKeys.join(', ')} present)`);
