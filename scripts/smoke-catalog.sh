#!/usr/bin/env bash
# smoke-catalog — real catalog-ingestion check for the custom kinds, headless and
# self-terminating. The committed counterpart to the source-assertion BDD smokes:
# it boots ONLY the backend in stub mode (app-config.yaml — no cluster, no secrets),
# waits for the MTL seed to process, and asserts via the catalog API that the custom
# `Cycle` and `Saga` entities ingested WITH their emitted relations. Logs to
# .dev/backend.log; tears the backend down on exit.
#
# Run: `make smoke-catalog`. Unlike smoke-gitea (@live, needs OpenBao+Gitea), this
# needs nothing external, so it is safe to run anywhere — including CI.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

# Fail fast if a prerequisite is missing rather than half-running.
for _cmd in corepack curl jq; do
  command -v "$_cmd" >/dev/null 2>&1 || { echo "smoke-catalog: missing prerequisite '$_cmd'" >&2; exit 1; }
done

mkdir -p .dev
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
  --config "$ROOT/.dev/app-config.smoke.yaml" >"$LOG" 2>&1 &
PID=$!
# Always reap the backend, even on interrupt, so a stray process can't keep port
# 7007 occupied and poison later make smoke-catalog / make dev runs.
cleanup() { kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

up=""
for _ in $(seq 1 150); do
  if grep -q "Listening on" "$LOG" 2>/dev/null; then up=1; break; fi
  if ! kill -0 "$PID" 2>/dev/null; then break; fi
  sleep 1
done
if [[ -z "$up" ]]; then
  echo "smoke-catalog FAIL: backend never logged 'Listening on'. Recent log:" >&2
  tail -n 40 "$LOG" >&2 || true
  exit 1
fi

hdr=(-H "Authorization: Bearer ${TOKEN}")
byname() { curl -fsS --connect-timeout 3 --max-time 5 "${hdr[@]}" "http://localhost:7007/api/catalog/entities/by-name/$1" 2>/dev/null || echo '{}'; }

# Backend readiness != catalog-ingestion readiness. Poll until the custom entities
# appear (or the timeout expires) rather than sleeping once and querying once.
# The wall-clock deadline bounds the worst case: six lookups per iteration could
# each burn their 5s curl timeout when the catalog is wedged, so iteration count
# alone is not a real bound.
CYCLE='{}'; SAGA='{}'; GROUP='{}'; RLCYCLE='{}'; RLSAGA='{}'; GILDI='{}'; PORTAL='{}'; TRACKAPI='{}'; PRACTICE='{}'; GRAFT='{}'
deadline=$((SECONDS + 300))
for _ in $(seq 1 120); do
  if (( SECONDS >= deadline )); then break; fi
  CYCLE="$(byname cycle/default/soccer-2026-spring)"
  SAGA="$(byname saga/default/saga-soccer-2026-spring)"
  GROUP="$(byname group/default/mtl)"
  RLCYCLE="$(byname cycle/default/tracking-2026-2)"
  RLSAGA="$(byname saga/default/saga-tracking-2026-2)"
  GILDI="$(byname group/default/security-gildi)"
  PORTAL="$(byname component/default/guildhall-portal)"
  TRACKAPI="$(byname component/default/tracking-api)"
  PRACTICE="$(byname component/default/security-practice)"
  GRAFT="$(byname template/default/apply-security-aspect)"
  if printf '%s' "$CYCLE" | grep -q 'soccer-2026-spring' \
     && printf '%s' "$SAGA" | grep -q 'saga-soccer-2026-spring' \
     && printf '%s' "$GROUP" | grep -q '"name":"mtl"' \
     && printf '%s' "$RLCYCLE" | grep -q 'tracking-2026-2' \
     && printf '%s' "$RLSAGA" | grep -q 'saga-tracking-2026-2' \
     && printf '%s' "$GILDI" | grep -q 'security-gildi' \
     && printf '%s' "$PORTAL" | grep -q 'guildhall-portal' \
     && printf '%s' "$TRACKAPI" | grep -q 'tracking-api' \
     && printf '%s' "$PRACTICE" | grep -q 'security-practice' \
     && printf '%s' "$GRAFT" | grep -q 'apply-security-aspect'; then break; fi
  sleep 1
done

# Field presence — a single-field substring is order-independent, so grep is fine.
check() { if printf '%s' "$2" | grep -qF "$3"; then echo "  PASS $1"; else echo "  FAIL $1"; return 1; fi; }
# Relation presence — parsed structurally with jq so JSON key order can't cause a
# false failure (grepping `"type":…,"targetRef":…` would be order-dependent).
check_rel() {
  if printf '%s' "$2" | jq -e --arg t "$3" --arg r "$4" \
       '(.relations // []) | any(.type == $t and .targetRef == $r)' >/dev/null 2>&1; then
    echo "  PASS $1"; else echo "  FAIL $1"; return 1; fi
}

# Run every check unconditionally (each prints its own PASS/FAIL) and track the
# overall result — chaining with && would hide all checks after the first failure.
pass=1
echo "Checks:"
# Cycle: kind + built-in relations emitted by CycleProcessor.
check     "Cycle ingested"                  "$CYCLE" '"kind":"Cycle"'                            || pass=0
check_rel "Cycle partOf mtl-soccer"         "$CYCLE" partOf    group:default/mtl-soccer          || pass=0
check_rel "Cycle ownedBy mtl-soccer"        "$CYCLE" ownedBy   group:default/mtl-soccer          || pass=0
check_rel "Cycle dependsOn field-1"         "$CYCLE" dependsOn resource:default/field-1          || pass=0
# Group tree ingested.
check     "Group tree (mtl, organization)"  "$GROUP" '"type":"organization"'                     || pass=0
# Saga: kind + built-in relations emitted by SagaProcessor.
check     "Saga ingested"                   "$SAGA"  '"kind":"Saga"'                              || pass=0
check_rel "Saga ownedBy skald (guest)"      "$SAGA"  ownedBy   user:default/guest                || pass=0
check_rel "Saga ownedBy owner (mtl-soccer)" "$SAGA"  ownedBy   group:default/mtl-soccer          || pass=0
check_rel "Saga dependsOn Cycle (touches)"  "$SAGA"  dependsOn cycle:default/soccer-2026-spring  || pass=0
check     "Saga doc annotation preserved"   "$SAGA"  'siliconsaga.org/saga-doc'                  || pass=0
# Mock software org (Ravenline — Guildhall running example): the software
# side of the two-family model plus a gildi-typed Group, ingesting with the
# same machinery and zero new code.
check     "Ravenline Cycle ingested (release)"       "$RLCYCLE" '"type":"release"'                          || pass=0
check_rel "Ravenline Cycle partOf parcel-tracking"   "$RLCYCLE" partOf    system:default/parcel-tracking    || pass=0
check_rel "Ravenline Cycle dependsOn prod-cluster"   "$RLCYCLE" dependsOn resource:default/prod-cluster     || pass=0
check     "Gildi Group ingested (type gildi)"        "$GILDI"   '"type":"gildi"'                            || pass=0
check     "Portal ingested (type portal)"            "$PORTAL"  '"type":"portal"'                           || pass=0
check_rel "Portal ownedBy team-devex"                "$PORTAL"  ownedBy   group:default/team-devex          || pass=0
# Live-topology per-repo catalog-info + the aspect's graft (vanilla Template kind).
check     "tracking-api from per-repo catalog-info"  "$TRACKAPI" 'siliconsaga.org/facets'                   || pass=0
check     "Practice Component (type practice)"       "$PRACTICE" '"type":"practice"'                        || pass=0
check     "Graft Template ingested (type aspect)"    "$GRAFT"    '"type":"aspect"'                          || pass=0
check_rel "Graft ownedBy security-gildi"             "$GRAFT"    ownedBy   group:default/security-gildi     || pass=0
check     "Ravenline Saga ingested"                  "$RLSAGA"  '"kind":"Saga"'                             || pass=0
check_rel "Ravenline Saga ownedBy skald (runa)"      "$RLSAGA"  ownedBy   user:default/runa                 || pass=0
check_rel "Ravenline Saga dependsOn its Cycle"       "$RLSAGA"  dependsOn cycle:default/tracking-2026-2     || pass=0

# Surface any catalog processing errors for the seeds (MTL + Ravenline).
echo "--- catalog errors mentioning the seeds (if any) ---"
grep -iE "error|InputError|Unable to read" "$LOG" 2>/dev/null | grep -iE "mtl|cycle|saga|ravenline|tracking|gildi|mock-org" | tail -20 || true
echo "(end errors)"

# Backend teardown is handled by the EXIT trap registered above.
if [[ "$pass" == 1 ]]; then
  echo "smoke-catalog PASS: MTL + Ravenline seeds ingested at runtime with their relations"
  exit 0
fi
echo "smoke-catalog FAIL: expected entities/relations missing. Recent log:" >&2
tail -n 30 "$LOG" >&2 || true
exit 1
