#!/usr/bin/env bash
# smoke-gitea — the @live check, headless and self-terminating.
#
# Boots ONLY the backend with the Gitea overlay, waits for the catalog to process
# the location, and asserts both catalog-seed entities are present via the catalog
# API. Logs to .dev/backend.log. Tears the backend down before exiting.
#
# Prereqs: `.env.local` (run `make secrets`) and a resolvable gitea.localhost
# (the Makefile runs preflight-gitea.mjs first).
set -uo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "smoke-gitea: no .env.local — run 'make secrets' first." >&2
  exit 1
fi

mkdir -p .dev
set -a; . ./.env.local; set +a
ROOT="$(cygpath -m "$PWD" 2>/dev/null || pwd)"
LOG="$ROOT/.dev/backend.log"
TOKEN="leidangr-smoke-$$-local-only"

# Generated, never committed (.dev is gitignored): a static token so the smoke can
# read the catalog API.
cat > .dev/app-config.smoke.yaml <<EOF
backend:
  auth:
    externalAccess:
      - type: static
        options:
          token: ${TOKEN}
          subject: leidangr-smoke
EOF

: > "$LOG"
corepack yarn workspace backend start \
  --config "$ROOT/app-config.yaml" \
  --config "$ROOT/app-config.gitea.yaml" \
  --config "$ROOT/.dev/app-config.smoke.yaml" >"$LOG" 2>&1 &
PID=$!
# Always reap the backend, even on interrupt, so a stray process can't keep
# port 7007 occupied and poison later make smoke-gitea / make dev-gitea runs.
cleanup() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

up=""
for _ in $(seq 1 120); do
  if grep -q "Listening on" "$LOG" 2>/dev/null; then up=1; break; fi
  if ! kill -0 "$PID" 2>/dev/null; then break; fi
  sleep 1
done
# Backend readiness != catalog-ingestion readiness. Poll the catalog until both
# entities appear or the timeout expires, rather than sleeping once and querying once.
RESULT='[]'
if [[ -n "$up" ]]; then
  for _ in $(seq 1 120); do
    RESULT="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" \
      "http://localhost:7007/api/catalog/entities?filter=kind=component" 2>/dev/null || echo '[]')"
    if printf '%s' "$RESULT" | grep -q "leidangr-portal" \
      && printf '%s' "$RESULT" | grep -q "gear-swap"; then
      break
    fi
    sleep 1
  done
fi

# Backend teardown is handled by the EXIT trap registered above.

pass=1
printf '%s' "$RESULT" | grep -q "leidangr-portal" || pass=0
printf '%s' "$RESULT" | grep -q "gear-swap" || pass=0

if [[ "$pass" == 1 ]]; then
  echo "smoke-gitea PASS: leidangr-portal + gear-swap ingested from Gitea"
  exit 0
fi
echo "smoke-gitea FAIL: expected entities missing. Recent log:" >&2
grep -iE "Unable to read|fetch failed|error" "$LOG" | tail -10 >&2 || true
exit 1
