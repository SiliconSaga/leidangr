// Renderer for `scripts/dev-secrets`: reads `bao kv get -format=json` output from
// stdin, validates the required keys, and renders the gitignored .env.local using
// the tested logic in dev-secrets.ts. Prints key presence only — never values.
import { writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { validateKeys, renderEnvLocal } from './dev-secrets.ts';

// Gitea's Backstage integration authenticates with username + password (the
// access token is the password), so both are rendered into .env.local.
const REQUIRED = ['gitea_user', 'gitea_token'];
const MAPPING = { gitea_user: 'GITEA_USER', gitea_token: 'GITEA_TOKEN' };

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
// 0600: the file holds secrets; do not rely on the caller's umask, and normalize
// the mode after overwriting an existing file.
writeFileSync('.env.local', content, { mode: 0o600 });
chmodSync('.env.local', 0o600);
console.log(`dev-secrets: wrote .env.local (${presentKeys.join(', ')} present)`);
