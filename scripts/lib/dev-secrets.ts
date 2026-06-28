// Pure logic for `scripts/dev-secrets` — the only supported local secret path.
// The app stays secret-store-agnostic: this resolves the OpenBao target, validates
// the fetched keys, and renders the gitignored .env.local. All IO (bao login, kv
// read, port-forward, file write) lives in the thin orchestrator, not here.

export type BaoTarget =
  | { mode: 'direct'; addr: string }
  | { mode: 'port-forward' };

/**
 * Resolve which OpenBao the script talks to — a direct URL when BAO_ADDR is set
 * (the contributor path), otherwise a kubectl port-forward (the cluster-owner
 * path). The running Backstage never sees this; it only reads .env.local.
 */
export function resolveTarget(env: Record<string, string | undefined>): BaoTarget {
  const addr = env.BAO_ADDR?.trim();
  return addr ? { mode: 'direct', addr } : { mode: 'port-forward' };
}

export interface KeyValidation {
  ok: boolean;
  missing: string[];
}

/**
 * Confirm every required KV key is present AND non-empty; report which are missing.
 * A blank value (e.g. an empty `gitea_token`) is treated as missing so it fails here
 * rather than later as a confusing auth/catalog error.
 */
export function validateKeys(
  data: Record<string, string>,
  required: string[],
): KeyValidation {
  const missing = required.filter(k => {
    const value = data[k];
    return typeof value !== 'string' || value.trim() === '';
  });
  return { ok: missing.length === 0, missing };
}

export interface RenderResult {
  content: string;
  presentKeys: string[];
}

/**
 * POSIX single-quote a value so the rendered file is safe to `source`. The
 * .env.local is sourced as shell by `make dev-gitea` / `scripts/smoke-gitea.sh`,
 * so an unquoted value containing shell metacharacters or command substitution
 * could execute. Embedded single quotes become `'\''`.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Render the .env.local body from an OpenBao KV payload, mapping kv keys to env
 * var names. Values are shell-quoted (the file is sourced). Entries whose kv key
 * is absent from the data are skipped. presentKeys is for status reporting only
 * (never log values).
 */
export function renderEnvLocal(
  data: Record<string, string>,
  mapping: Record<string, string>,
): RenderResult {
  const presentKeys = Object.keys(mapping).filter(k => k in data);
  const content = presentKeys.map(k => `${mapping[k]}=${shellQuote(data[k])}\n`).join('');
  return { content, presentKeys };
}
