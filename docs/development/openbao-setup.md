# OpenBao → Gitea live setup (the `@live` checkpoint)

This is the one-time setup behind `make secrets` → `make dev-gitea`: the real
OpenBao → Gitea catalog loop. Everything here is human-gated (cluster access, an
unseal, a browser OIDC login), so it lives as a runbook rather than automation.

## Prerequisites

- `kubectl` pointed at the cluster running OpenBao + Keycloak + Gitea (homelab: `rancher-desktop`/`loki`).
- The `bao` CLI installed and on PATH (`make doctor` shows `bao` as `warn` until it is).
- OpenBao **unsealed**. Homelab OpenBao comes back **sealed** after any restart — unseal with 2 of 3 Shamir shares from the `openbao-init` Secret. See the canonical runbook: `components/nidavellir/docs/secrets-management.md` ("pod restarted and shows 0/1"). `kubectl get pods -n openbao` should show `openbao-0` as `1/1` once unsealed.
- **`gitea.localhost` resolvable by Node.** The Backstage backend fetches Gitea by hostname, and Node — unlike curl/git — does not special-case `*.localhost` (RFC 6761), so without a hosts entry the catalog silently comes up **empty** (`fetch failed` / `ENOTFOUND` in the backend log). Add it once per machine:
  - Windows (elevated PowerShell): `Add-Content -Path "$env:windir\System32\drivers\etc\hosts" -Value "127.0.0.1 gitea.localhost"`
  - Linux/macOS (`/etc/hosts`): `127.0.0.1 gitea.localhost`

  `make dev-gitea` and `make smoke-gitea` run `scripts/preflight-gitea.mjs` first, which fails fast with this fix if the host doesn't resolve — so a fresh machine surfaces the requirement instead of forgetting it.

## 1. OpenBao OIDC auth backed by Keycloak (one-time)

`dev-secrets` uses `bao login -method=oidc`, which opens a browser to Keycloak. Enable and configure the OIDC auth method against the `siliconsaga` Keycloak realm. Exact client id/secret and discovery URL must be confirmed against that realm:

```bash
bao auth enable oidc   # if not already enabled

bao write auth/oidc/config \
  oidc_discovery_url="https://<keycloak-host>/realms/siliconsaga" \
  oidc_client_id="<backstage-or-cli-client-id>" \
  oidc_client_secret="<client-secret>" \
  default_role="leidangr-dev"

bao write auth/oidc/role/leidangr-dev \
  user_claim="sub" \
  allowed_redirect_uris="http://localhost:8250/oidc/callback" \
  policies="leidangr-dev" \
  oidc_scopes="openid,profile,email"
```

Grant the `leidangr-dev` policy read on the dev-scope KV path only:

```bash
bao policy write leidangr-dev - <<'EOF'
path "secret/data/leidangr/dev" { capabilities = ["read"] }
path "secret/metadata/leidangr/dev" { capabilities = ["read"] }
EOF
```

(KV v2 reads use the `secret/data/...` API path even though the CLI addresses `secret/leidangr/dev`.)

## 2. Seed the Gitea catalog-seed repo (one-time)

Create a small repo on the in-cluster Gitea that the catalog ingests:

- On `http://gitea.localhost`, create `leidangr/catalog-seed` (owner `leidangr`, or adjust the `target` in `app-config.gitea.yaml` to the owner you use).
- Add a `catalog-info.yaml` at the repo root declaring a couple of entities — `tests/acceptance/fixtures/gitea-catalog-info.yaml` is a ready template.
- Create a Gitea access token with read scope for that repo, and note the owning username.

## 3. Seed the OpenBao KV (one-time)

```bash
bao kv put secret/leidangr/dev \
  gitea_user="<gitea-username>" \
  gitea_token="<gitea-read-token>"
```

`dev-secrets` requires both keys (Gitea auth is username + access-token-as-password).

## 4. Run the loop

```bash
make secrets       # resolves OpenBao (port-forward or BAO_ADDR), browser OIDC login, renders .env.local
make smoke-gitea   # headless: assert both catalog-seed entities ingest, then tear down (PASS/FAIL)
make dev-gitea     # interactive: open http://localhost:3000 to see them
```

`make smoke-gitea` is the automated `@live` check — it boots only the backend, asserts `leidangr-portal` + `gear-swap` are in the catalog via the catalog API, logs to `.dev/backend.log`, and shuts down. `make dev-gitea` is the interactive view: open `http://localhost:3000` and confirm the catalog shows the entities from the Gitea `catalog-seed` repo. Both correspond to the `@live` scenario in `tests/acceptance/checkpoint-2-openbao-gitea.feature` passing for real.

## Notes

- `.env.local` is gitignored; it holds the rendered `GITEA_USER`/`GITEA_TOKEN`. Never commit it.
- Contributors without `kubectl` port-forward rights set `BAO_ADDR` to a reachable OpenBao URL instead; the app is unchanged either way (ADR 0003).
- Stub mode (`make dev`) never needs any of this.
