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

## 1. Prerequisites — reach OpenBao, unseal, resolve keycloak.localhost in-cluster

- **kubectl** pointed at homelab (`rancher-desktop`). Port-forward OpenBao and set the address:
  ```bash
  kubectl -n openbao port-forward svc/openbao 8200:8200 &
  export BAO_ADDR=http://127.0.0.1:8200
  ```
- **OpenBao unsealed.** It comes back **sealed after every restart/reboot** (`openbao-0` shows `0/1`). Unseal with 2 of the 3 Shamir shares from the `openbao-init` Secret — canonical runbook: `components/nidavellir/docs/secrets-management.md` → "The pod restarted and shows 0/1 — unseal it".
- **In-cluster `keycloak.localhost` resolution (homelab).** OpenBao runs the OIDC authorization-code → token exchange **server-side from its pod**, and must reach Keycloak at the *same* `http://keycloak.localhost` issuer the browser uses (Keycloak is in dynamic-hostname mode; OpenBao validates `iss` strictly). A homelab CoreDNS rewrite makes that name resolvable from pods — see `components/nordri/docs/keycloak-localhost-coredns.md`. **Without it the browser login succeeds but the token exchange fails** with a DNS error.

## 2. Create the Keycloak client + a realm user (siliconsaga realm, one-time)

The flow needs a confidential client and at least one realm **user** to authenticate as. Keycloak admin creds live in the operator's `keycloak-initial-admin` Secret; drive `kcadm.sh` inside the keycloak pod. (On Git Bash, prefix exec calls with `MSYS_NO_PATHCONV=1` so the in-pod `/opt/...` path isn't mangled.)

```bash
KC_USER=$(kubectl -n keycloak get secret keycloak-initial-admin -o jsonpath='{.data.username}' | base64 -d)
KC_PW=$(kubectl -n keycloak get secret keycloak-initial-admin -o jsonpath='{.data.password}' | base64 -d)
kc() { kubectl -n keycloak exec keycloak-0 -- /opt/keycloak/bin/kcadm.sh "$@"; }
kc config credentials --server http://localhost:8080 --realm master --user "$KC_USER" --password "$KC_PW"

# Confidential client `openbao-cli` — Standard flow; redirect to the bao CLI callback (:8250)
kc create clients -r siliconsaga \
  -s clientId=openbao-cli -s enabled=true -s protocol=openid-connect \
  -s publicClient=false -s standardFlowEnabled=true \
  -s 'redirectUris=["http://localhost:8250/oidc/callback","http://127.0.0.1:8250/oidc/callback"]'

# Read the generated client secret (feeds step 3)
CID=$(kc get clients -r siliconsaga -q clientId=openbao-cli | jq -r '.[0].id')
kc get clients/$CID/client-secret -r siliconsaga | jq -r '.value'

# A dev user to log in as. Role-only gating ⇒ any authenticated realm user gets the read policy.
kc create users -r siliconsaga -s username=<you> -s enabled=true -s emailVerified=true
kc set-password -r siliconsaga --username <you> --new-password '<pick-one>'
```

> The client and user above are created **imperatively**. The `siliconsaga` realm is otherwise declaratively imported, so fold both into the realm import (realm repo) for reproducibility — tracked as a follow-up.

## 3. Configure the OpenBao OIDC auth method (as admin, one-time)

`dev-secrets` calls `bao login -method=oidc` with **no role**, so `default_role` in the config is what selects the role — it is load-bearing.

```bash
export BAO_TOKEN=$(kubectl -n openbao get secret openbao-init -o jsonpath='{.data.root_token}' | base64 -d)

bao auth enable oidc   # if not already enabled

# Read-only on the dev-scope KV path (KV v2 ⇒ both data/ and metadata/ paths)
bao policy write leidangr-dev-read - <<'EOF'
path "secret/data/leidangr/dev"     { capabilities = ["read"] }
path "secret/metadata/leidangr/dev" { capabilities = ["read"] }
EOF

bao write auth/oidc/config \
  oidc_discovery_url="http://keycloak.localhost/realms/siliconsaga" \
  oidc_client_id="openbao-cli" \
  oidc_client_secret="<secret-from-step-2>" \
  default_role="leidangr-dev"

bao write auth/oidc/role/leidangr-dev \
  user_claim="sub" \
  allowed_redirect_uris="http://localhost:8250/oidc/callback,http://127.0.0.1:8250/oidc/callback" \
  policies="leidangr-dev-read" \
  oidc_scopes="openid,profile,email" \
  token_ttl="1h"
```

(KV v2 reads use the `secret/data/...` API path even though the CLI addresses `secret/leidangr/dev`.)

## 4. Seed the Gitea catalog-seed repo (one-time)

Create a small repo on the in-cluster Gitea that the catalog ingests:

- On `http://gitea.localhost`, create `leidangr/catalog-seed` (owner `leidangr`, or adjust the `target` in `app-config.gitea.yaml` to the owner you use).
- Add a `catalog-info.yaml` at the repo root declaring a couple of entities — `tests/acceptance/fixtures/gitea-catalog-info.yaml` is a ready template.
- Create a Gitea access token with read scope for that repo, and note the owning username.

## 5. Seed the OpenBao KV (one-time)

```bash
bao kv put secret/leidangr/dev \
  gitea_user="<gitea-username>" \
  gitea_token="<gitea-read-token>"
```

`dev-secrets` requires both keys (Gitea auth is username + access-token-as-password).

## 6. Run the loop

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
