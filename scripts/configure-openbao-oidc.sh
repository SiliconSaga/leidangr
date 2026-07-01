#!/usr/bin/env bash
# configure-openbao-oidc.sh — (re)apply the OpenBao OIDC auth method that backs
# `bao login -method=oidc` (scripts/dev-secrets). Idempotent; safe to re-run, so
# a fresh OpenBao re-applies the same auth method + policy + role with one command.
#
# The Keycloak `openbao-cli` client and the dev user are provisioned separately
# and declaratively by the siliconsaga realm import (nidavellir keycloak/), which
# reads the client secret from the SAME OpenBao path this script does
# (secret/leidangr/oidc) — so the two sides never drift. This script owns only
# the OpenBao end of the handshake.
#
# Prerequisites (see docs/development/openbao-setup.md):
#   - OpenBao reachable + unsealed; BAO_ADDR set (direct URL or a port-forward).
#   - BAO_TOKEN set to an OpenBao admin token (e.g. the openbao-init root_token).
#   - secret/leidangr/oidc seeded with `client-secret` (and `dev-user-password`,
#     consumed by the realm import). Same value the Keycloak client carries.
#   - keycloak.localhost resolvable in-cluster (nordri CoreDNS rewrite) so the
#     config-write's discovery fetch and later token exchange succeed.
#
# Env overrides: OIDC_ISSUER, OIDC_CLIENT_ID.
set -euo pipefail

ISSUER="${OIDC_ISSUER:-http://keycloak.localhost/realms/siliconsaga}"
CLIENT_ID="${OIDC_CLIENT_ID:-openbao-cli}"
KV_OIDC="secret/leidangr/oidc"

: "${BAO_ADDR:?set BAO_ADDR (e.g. http://127.0.0.1:8200 via a port-forward)}"
: "${BAO_TOKEN:?set BAO_TOKEN to an OpenBao admin token}"

# Single source of truth for the client secret — the same value the realm import
# delivers to Keycloak via ESO. Never printed.
CLIENT_SECRET="$(bao kv get -field=client-secret "$KV_OIDC")"

# 1. OIDC auth method (idempotent — only enable if absent)
if bao auth list -format=json | grep -q '"oidc/"'; then
  echo "oidc auth method already enabled"
else
  bao auth enable oidc
fi

# 2. Read-only policy on the dev-scope KV path (KV v2 ⇒ data/ + metadata/)
bao policy write leidangr-dev-read - <<'EOF'
path "secret/data/leidangr/dev"     { capabilities = ["read"] }
path "secret/metadata/leidangr/dev" { capabilities = ["read"] }
EOF

# 3. Auth method config. default_role is load-bearing: dev-secrets runs
#    `bao login -method=oidc` with NO role, so the default selects leidangr-dev.
bao write auth/oidc/config \
  oidc_discovery_url="$ISSUER" \
  oidc_client_id="$CLIENT_ID" \
  oidc_client_secret="$CLIENT_SECRET" \
  default_role="leidangr-dev"

# 4. Role — role-only gating (any authenticated realm user gets the read policy).
bao write auth/oidc/role/leidangr-dev \
  user_claim="sub" \
  allowed_redirect_uris="http://localhost:8250/oidc/callback,http://127.0.0.1:8250/oidc/callback" \
  policies="leidangr-dev-read" \
  oidc_scopes="openid,profile,email" \
  token_ttl="1h"

echo "OpenBao OIDC configured (method=oidc, role=leidangr-dev, policy=leidangr-dev-read)."
