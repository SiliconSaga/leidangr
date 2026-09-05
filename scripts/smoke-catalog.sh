#!/usr/bin/env bash
# smoke-catalog — real catalog-ingestion check for the custom kinds, headless and
# self-terminating. The committed counterpart to the source-assertion BDD smokes:
# it boots ONLY the backend in stub mode (app-config.yaml — no cluster, no secrets),
# waits for the MTL seed to process, and asserts via the catalog API that the custom
# `Cycle` and `Saga` entities ingested WITH their emitted relations. Logs to
# .dev/backend.log; tears the backend down on exit.
#
# Run: `make smoke-catalog`. Unlike smoke-gitea (@live, needs OpenBao+Gitea), this
# needs no cluster and no secrets — but it DOES need network, since the volundr
# aspect module is registered over `type: url`. Offline runs fail those three
# assertions and pass the rest. GH_TOKEN is used when present; volundr is
# public, so an unauthenticated read works but shares the low anonymous rate
# limit. Splitting offline and online variants is on the backlog.
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

# Always reap the backend, even on interrupt, so a stray process can't keep port
# 7007 occupied and poison later make smoke-catalog / make dev runs.
PID=""
cleanup() {
  [[ -n "$PID" ]] || return 0
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  PID=""
}
trap cleanup EXIT INT TERM

# cleanup kills the process this script started, but the listener is a
# GRANDCHILD — corepack spawns backstage-cli, which spawns the node backend —
# and killing a parent does not guarantee the grandchild goes with it,
# particularly on Windows. If the old listener survives, the retry cannot bind
# and reports "never logged 'Listening on'", which is a misleading error of
# exactly the kind this script exists to stop producing.
#
# curl is already a prerequisite, so no new dependency: a refused connection
# means the port is free. Any HTTP response at all, 404 included, means
# something is still holding it.
wait_for_port_release() {
  for _ in $(seq 1 30); do
    if ! curl -s -o /dev/null --connect-timeout 1 "http://localhost:7007/" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Boot and wait for the port. Returns non-zero if it never listened at all,
# which is a different failure from listening and then not ingesting.
start_backend() {
  : > "$LOG"
  corepack yarn workspace backend start \
    --config "$ROOT/app-config.yaml" \
    --config "$ROOT/.dev/app-config.smoke.yaml" >"$LOG" 2>&1 &
  PID=$!
  for _ in $(seq 1 150); do
    if grep -q "Listening on" "$LOG" 2>/dev/null; then return 0; fi
    if ! kill -0 "$PID" 2>/dev/null; then return 1; fi
    sleep 1
  done
  return 1
}

# A KNOWN STARTUP RACE, and the reason this script retries at all.
#
# `backstage-cli package start` runs the backend in dev mode: the child is
# spawned with a --require hook that transpiles every workspace .ts file through
# swc SYNCHRONOUSLY, with no cache, on every boot. Meanwhile `core.auth` asks the
# parent for its dev signing key over IPC, and that request carries a hard-coded
# 5s timeout (IPC_TIMEOUT_MS in @backstage/backend-dev-utils, not configurable).
# The parent answers instantly — it is a Map lookup — but the child cannot
# process the reply while it is still blocked transpiling, so on a cold file
# cache or a busy disk the timer wins. Every plugin waiting on core.auth then
# fails at once, which is why the four failures always arrive together.
#
# WHAT IT LOOKS LIKE IS THE PROBLEM: the backend still logs "Listening on" and
# still serves the API, so the run proceeds and every entity 404s. That is
# indistinguishable at a glance from a real catalog regression, and has been
# mistaken for one. Naming it here is most of the value of this function.
# Matches the thrown MESSAGE as well as the error name. The name only reaches
# the log through the logger's own `name=`/`stack=` fields, which is a format
# detail that could change; "Backend startup failed" is the error's own text and
# is the more durable half. Both are accepted so neither alone is load-bearing.
startup_race_lost() {
  grep -qE "BackendStartupError|Backend startup failed" "$LOG" 2>/dev/null || return 1
  # The TIMEOUT, not merely the store's name. A healthy boot mentions
  # DevDataStore too, so matching the name alone would retry any startup failure
  # that happened to occur in a log where the store was also busy — and then
  # report it as an environment problem on the second attempt, which is the
  # precise misdiagnosis this function exists to prevent.
  grep -qE "IPC request 'DevDataStore\.load'.* timed out" "$LOG" 2>/dev/null
}

hdr=(-H "Authorization: Bearer ${TOKEN}")
# One entity by `<kind>/<namespace>/<name>`, as JSON. Answers `{}` rather than
# failing when the lookup does — the poll loop below calls this before the
# catalog has ingested anything, and under `set -e` a bare curl failure would
# abort the run instead of retrying. Every caller therefore gets valid JSON and
# an absent entity reads as an empty object, not an error.
byname() { curl -fsS --connect-timeout 3 --max-time 5 "${hdr[@]}" "http://localhost:7007/api/catalog/entities/by-name/$1" 2>/dev/null || echo '{}'; }

# Must stay in step with the two `type: url` locations in app-config.yaml — this is
# the source the network-read entities are asserted against, not a second opinion
# about where they live.
#
# ⚠ `tree`, though app-config declares `blob`. GithubIntegration.resolveUrl runs
# every GitHub URL through replaceGithubUrlType(..., "tree"), so the target stored
# on the location — and therefore the annotation — is always the tree form. Copying
# the URL out of app-config gives you `blob` and a failing check. Confirmed by
# running this smoke, not by reading app-config.
VOLUNDR_ASPECT='url:https://github.com/SiliconSaga/volundr/tree/main/aspect'

# Backend readiness != catalog-ingestion readiness. Poll until the custom entities
# appear (or the timeout expires) rather than sleeping once and querying once.
# The wall-clock deadline keeps the worst case near the budget: thirteen lookups
# per iteration could each burn their 5s curl timeout when the catalog is wedged,
# so iteration count alone is not a real bound. The deadline is checked once per
# iteration, so a fully wedged run can overshoot it by up to one iteration
# (~65s) — acceptable slack for a smoke.
CYCLE='{}'; SAGA='{}'; GROUP='{}'; RLCYCLE='{}'; RLSAGA='{}'
GILDI='{}'; UMBRELLA='{}'; INSTANCE='{}'; CORNERSTONE='{}'; TRACKAPI='{}'; PRACTICE='{}'; ADOPTION='{}'
FOXDEPT='{}'; FOXSCAN='{}'; DRVSAGA='{}'; WEBPRACTICE='{}'; WEBADOPT='{}'

# Returns 0 once every entity has appeared, non-zero if the deadline passes
# first. The assertions below run either way — a partial ingest should report
# which parts are missing rather than just that something is.
poll_for_entities() {
deadline=$((SECONDS + 300))
for _ in $(seq 1 120); do
  if (( SECONDS >= deadline )); then return 1; fi
  CYCLE="$(byname cycle/default/soccer-2026-spring)"
  SAGA="$(byname saga/default/saga-soccer-2026-spring)"
  GROUP="$(byname group/default/mtl)"
  RLCYCLE="$(byname cycle/default/tracking-2026-2)"
  RLSAGA="$(byname saga/default/saga-tracking-2026-2)"
  GILDI="$(byname group/default/security-gildi)"
  UMBRELLA="$(byname domain/default/siliconsaga)"
  INSTANCE="$(byname system/default/leidangr)"
  CORNERSTONE="$(byname component/default/gildi)"
  TRACKAPI="$(byname component/default/tracking-api)"
  PRACTICE="$(byname component/default/security-practice)"
  ADOPTION="$(byname template/default/apply-security-aspect)"
  FOXDEPT="$(byname group/default/foxholm)"
  FOXSCAN="$(byname component/default/intake-scanner)"
  DRVSAGA="$(byname saga/default/saga-dependency-scanning-drive)"
  # The volundr aspect module, read over the network — the only two entities
  # here that are not local files, and so the slowest to appear.
  WEBPRACTICE="$(byname component/default/website-hygiene-practice)"
  WEBADOPT="$(byname template/default/apply-website-hygiene-aspect)"
  if printf '%s' "$CYCLE" | grep -q 'soccer-2026-spring' \
     && printf '%s' "$SAGA" | grep -q 'saga-soccer-2026-spring' \
     && printf '%s' "$GROUP" | grep -q '"name":"mtl"' \
     && printf '%s' "$RLCYCLE" | grep -q 'tracking-2026-2' \
     && printf '%s' "$RLSAGA" | grep -q 'saga-tracking-2026-2' \
     && printf '%s' "$GILDI" | grep -q 'security-gildi' \
     && printf '%s' "$UMBRELLA" | grep -q '"name":"siliconsaga"' \
     && printf '%s' "$INSTANCE" | grep -q '"name":"leidangr"' \
     && printf '%s' "$CORNERSTONE" | grep -q '"name":"gildi"' \
     && printf '%s' "$TRACKAPI" | grep -q 'tracking-api' \
     && printf '%s' "$PRACTICE" | grep -q 'security-practice' \
     && printf '%s' "$ADOPTION" | grep -q 'apply-security-aspect' \
     && printf '%s' "$FOXDEPT" | grep -q '"name":"foxholm"' \
     && printf '%s' "$FOXSCAN" | grep -q 'intake-scanner' \
     && printf '%s' "$DRVSAGA" | grep -q 'saga-dependency-scanning-drive' \
     && printf '%s' "$WEBPRACTICE" | grep -q 'website-hygiene-practice' \
     && printf '%s' "$WEBADOPT" | grep -q 'apply-website-hygiene-aspect'; then return 0; fi
  sleep 1
done
return 1
}

# One retry, and only for the race named above. A backend that listened and then
# ingested nothing for any OTHER reason is a real finding and must not be
# retried into looking flaky — so the log signature, not the failure itself, is
# what earns the second attempt.
for attempt in 1 2; do
  if ! start_backend; then
    echo "smoke-catalog FAIL: backend never logged 'Listening on'. Recent log:" >&2
    tail -n 40 "$LOG" >&2 || true
    exit 1
  fi
  if poll_for_entities; then break; fi
  if ! startup_race_lost; then break; fi
  if (( attempt == 2 )); then
    echo "smoke-catalog FAIL: the backend lost the DevDataStore IPC race twice." >&2
    echo "  This is an ENVIRONMENT failure, not a change you made — see" >&2
    echo "  startup_race_lost() in this script for the mechanism. Every entity" >&2
    echo "  will read as missing below. Re-run on a quieter machine." >&2
    exit 1
  fi
  echo "smoke-catalog: backend lost the DevDataStore IPC race on boot, retrying once."
  echo "  (a startup timing race, not a catalog problem — see startup_race_lost)"
  cleanup
  if ! wait_for_port_release; then
    echo "smoke-catalog FAIL: port 7007 is still bound 30s after cleanup." >&2
    echo "  A backend from the first attempt outlived the process we killed, so" >&2
    echo "  the retry could not bind. Kill the stray node process and re-run —" >&2
    echo "  reported separately because it is a leak, not the startup race." >&2
    exit 1
  fi
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
# Source binding — a by-name lookup proves an entity of that name exists, not that
# it came from where app-config points. That gap matters only for the volundr
# entities, which are the sole ones read over the network: a same-named local seed
# would shadow them and the network assertions would keep passing while testing
# nothing. Location refs stringify as `<type>:<target>` (catalog-model
# location/helpers), so the expected value carries the `url:` prefix. Prints the
# observed annotation on failure — a mismatch here is worth seeing, not guessing.
check_src() {
  local got
  got="$(printf '%s' "$2" | jq -r '.metadata.annotations["backstage.io/managed-by-location"] // "<none>"' 2>/dev/null)" || got='<unparseable>'
  if [[ "$got" == "$3" ]]; then
    echo "  PASS $1"; else echo "  FAIL $1 (managed-by-location: $got)"; return 1; fi
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
# side of the two-family model plus a guild-typed Group, ingesting with the
# same machinery and zero new code.
check     "Ravenline Cycle ingested (release)"       "$RLCYCLE" '"type":"release"'                          || pass=0
check_rel "Ravenline Cycle partOf parcel-tracking"   "$RLCYCLE" partOf    system:default/parcel-tracking    || pass=0
check_rel "Ravenline Cycle dependsOn prod-cluster"   "$RLCYCLE" dependsOn resource:default/prod-cluster     || pass=0
check     "Guild Group ingested (type guild)"        "$GILDI"   '"type":"guild"'                            || pass=0
check     "Umbrella Domain ingested (type community)" "$UMBRELLA" '"type":"community"'                      || pass=0
check     "Instance System ingested (type instance)" "$INSTANCE" '"type":"instance"'                        || pass=0
check_rel "Instance System partOf siliconsaga"       "$INSTANCE" partOf   domain:default/siliconsaga        || pass=0
check     "Guild Hall cornerstone (type plugin)"     "$CORNERSTONE" '"type":"plugin"'                       || pass=0
check_rel "Guild Hall cornerstone partOf leidangr"   "$CORNERSTONE" partOf system:default/leidangr          || pass=0
# Live-topology per-repo catalog-info + the aspect's adoption template (vanilla Template kind).
check     "tracking-api facets override (api, batch)" "$TRACKAPI" '"siliconsaga.org/facets":"api, batch"'   || pass=0
check     "Practice Component (type practice)"       "$PRACTICE" '"type":"practice"'                        || pass=0
check     "Adoption Template ingested (type aspect)" "$ADOPTION" '"type":"aspect"'                          || pass=0
check_rel "Adoption Template ownedBy security-gildi" "$ADOPTION" ownedBy   group:default/security-gildi     || pass=0
# The first REAL aspect: read from volundr over the network rather than from a
# seed file. The release assertion is deliberately exact rather than a presence
# check — it is what fails loudly when the module's release is bumped in one of
# its three places and not the others (see the annotation's own comment).
check     "Website practice ingested (type practice)" "$WEBPRACTICE" '"type":"practice"'                   || pass=0
check     "Website practice module release 1.1"      "$WEBPRACTICE" '"siliconsaga.org/module-release":"1.1"' || pass=0
check     "Website adoption Template (type aspect)"  "$WEBADOPT" '"type":"aspect"'                         || pass=0
check_src "Website practice read from volundr"       "$WEBPRACTICE" "$VOLUNDR_ASPECT/catalog-info.yaml"    || pass=0
check_src "Website adoption Template read from volundr" "$WEBADOPT" "$VOLUNDR_ASPECT/template.yaml"        || pass=0
check     "Ravenline Saga ingested"                  "$RLSAGA"  '"kind":"Saga"'                             || pass=0
check_rel "Ravenline Saga ownedBy skald (runa)"      "$RLSAGA"  ownedBy   user:default/runa                 || pass=0
check_rel "Ravenline Saga dependsOn its Cycle"       "$RLSAGA"  dependsOn cycle:default/tracking-2026-2     || pass=0
# Round-1 narrative additions: the Foxholm department (practice reuse across an
# org boundary), the versioned-enrollment annotation, and the drive's mid-run
# Saga with its relations.
check     "Foxholm department ingested"              "$FOXDEPT" '"type":"department"'                       || pass=0
check     "Foxholm enrollment versioned (1.3)"       "$FOXSCAN" '"siliconsaga.org/aspect-versions":"security@1.3"' || pass=0
check_rel "Foxholm component ownedBy team-returns"   "$FOXSCAN" ownedBy   group:default/team-returns        || pass=0
check     "Drive Saga ingested"                      "$DRVSAGA" '"kind":"Saga"'                             || pass=0
check_rel "Drive Saga ownedBy skald (astrid)"        "$DRVSAGA" ownedBy   user:default/astrid               || pass=0
check_rel "Drive Saga dependsOn the drive Cycle"     "$DRVSAGA" dependsOn cycle:default/dependency-scanning-drive || pass=0

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
