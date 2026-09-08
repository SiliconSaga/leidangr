#!/usr/bin/env bash
# smoke-facts — end-to-end check that the fact source actually DERIVES A MEDAL.
#
# smoke-catalog proves the backend boots with the plugin registered. That is a
# different and much weaker claim: a plugin can register cleanly, schedule its
# sweep, serve its routes, and still never produce a correct verdict, because
# everything interesting happens on the first real run. This boots the backend,
# asks it to evaluate a REAL repository, and asserts what came back.
#
# The subject is SiliconSaga/hygiene-testsite, registered in app-config.yaml. It
# is deliberately NOT compliant: its Gemfile and both workflow stubs are in
# place, but its GitHub Pages source is `main` rather than `gh-pages`. So the
# expected verdict is SILVER — three of four applicable trials passing — and
# the one failure is the trial no pull request can satisfy. An all-passing
# fixture would prove far less, because it could not tell a working evaluator
# from one that says yes to everything.
#
# Run: `make smoke-facts`. Needs network and, for the Pages trial, GH_TOKEN —
# the Pages API is not readable anonymously, so without a token that one trial
# reports unmeasured and the medal is withheld rather than earned. The script
# says which mode it ran in and asserts accordingly.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

for _cmd in corepack curl jq; do
  command -v "$_cmd" >/dev/null 2>&1 || { echo "smoke-facts: missing prerequisite '$_cmd'" >&2; exit 1; }
done

mkdir -p .dev
ROOT="$(cygpath -m "$PWD" 2>/dev/null || pwd)"
LOG="$ROOT/.dev/facts-backend.log"
TOKEN="leidangr-facts-$$-local-only"

SUBJECT='component:default/hygiene-testsite'
ASPECT='website-hygiene'

cat > .dev/app-config.facts.yaml <<EOF
backend:
  auth:
    externalAccess:
      - type: static
        options:
          token: ${TOKEN}
          subject: leidangr-facts
EOF

PID=""
cleanup() {
  [[ -n "$PID" ]] || return 0
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  PID=""
}
trap cleanup EXIT INT TERM

# Same two boot conditions smoke-catalog documents at length: a port still held
# by a surviving grandchild, and the DevDataStore IPC race. Both are detected
# from the log rather than by probing, for the reasons recorded there.
port_still_held() {
  grep -qiE "EADDRINUSE|address already in use" "$LOG" 2>/dev/null
}
startup_race_lost() {
  grep -qE "BackendStartupError|Backend startup failed" "$LOG" 2>/dev/null || return 1
  grep -qE "IPC request 'DevDataStore\.load'.* timed out" "$LOG" 2>/dev/null
}

start_backend() {
  : > "$LOG"
  corepack yarn workspace backend start \
    --config "$ROOT/app-config.yaml" \
    --config "$ROOT/.dev/app-config.facts.yaml" >"$LOG" 2>&1 &
  PID=$!
  for _ in $(seq 1 150); do
    if grep -q "Listening on" "$LOG" 2>/dev/null; then return 0; fi
    if ! kill -0 "$PID" 2>/dev/null; then return 1; fi
    sleep 1
  done
  return 1
}

hdr=(-H "Authorization: Bearer ${TOKEN}")
byname() { curl -fsS --connect-timeout 3 --max-time 5 "${hdr[@]}" "http://localhost:7007/api/catalog/entities/by-name/$1" 2>/dev/null || echo '{}'; }

# The subject and its practice must BOTH be ingested before a run can mean
# anything: without the practice there is no standard to fetch, and the run
# would correctly come back unevaluated — a real answer, but not the one this
# smoke is here to check.
poll_for_entities() {
  deadline=$((SECONDS + 300))
  for _ in $(seq 1 120); do
    if (( SECONDS >= deadline )); then return 1; fi
    if printf '%s' "$(byname component/default/hygiene-testsite)" | grep -q 'hygiene-testsite' \
       && printf '%s' "$(byname component/default/website-hygiene-practice)" | grep -q 'website-hygiene-practice'; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# ONE synchronous run, rather than waiting for the scheduled sweep. The sweep is
# staggered two minutes past boot on purpose, and both paths share `runOne`, so
# driving it through the endpoint tests the same code without the wait.
refresh() {
  curl -fsS --connect-timeout 3 --max-time 120 -X POST "${hdr[@]}" \
    "http://localhost:7007/api/gildi/trials/$(printf '%s' "$SUBJECT" | jq -sRr @uri)/refresh?aspect=${ASPECT}" \
    2>/dev/null || echo '{}'
}

echo "smoke-facts: booting the backend"
if ! start_backend; then
  if port_still_held; then
    echo "smoke-facts: port 7007 is still held by an earlier backend — stop it and retry" >&2
    exit 1
  fi
  if startup_race_lost; then
    echo "smoke-facts: backend lost the DevDataStore IPC race on boot, retrying once."
    cleanup
    start_backend || { echo "smoke-facts: backend never logged 'Listening on'" >&2; exit 1; }
  else
    echo "smoke-facts: backend never logged 'Listening on'" >&2
    exit 1
  fi
fi

echo "smoke-facts: waiting for the subject and its practice to ingest"
poll_for_entities || { echo "smoke-facts: entities never ingested — see $LOG" >&2; exit 1; }

echo "smoke-facts: evaluating ${SUBJECT} against ${ASPECT}"
RUN="$(refresh)"

# Without a token the Pages API is unreadable, so that trial is unmeasured and
# the verdict is SUPPRESSED rather than a medal. That is the correct behaviour
# and worth asserting in its own right — a missing credential must never look
# like a non-compliant repository.
if [[ -n "${GH_TOKEN:-}" ]]; then
  MODE=authenticated
  WANT_MEDAL='silver'
else
  MODE=anonymous
  WANT_MEDAL='null'
  echo "smoke-facts: GH_TOKEN unset — expecting the Pages trial to be unmeasured"
fi

pass=1
check() {
  local label="$1" want="$2" got="$3"
  if [[ "$got" == "$want" ]]; then
    printf '  PASS %s\n' "$label"
  else
    printf '  FAIL %s (want %s, got %s)\n' "$label" "$want" "$got"
    pass=0
  fi
}

field() { printf '%s' "$RUN" | jq -r "$1" 2>/dev/null || echo '?'; }
outcome() { printf '%s' "$RUN" | jq -r --arg t "$1" '(.outcomes[]? | select(.trialId==$t) | .state) // "absent"' 2>/dev/null || echo '?'; }

echo "Checks (${MODE}):"
check 'run is evaluated, not unevaluated'  'evaluated' "$(field '.kind')"
check 'the standard resolved four trials'  '4'         "$(field '.applicable')"
check 'module release travelled with it'   '1.1'       "$(field '.moduleRelease')"
check 'Gemfile declares the gem'           'pass'      "$(outcome gemfile-present)"
check 'deploy stub points at volundr'      'pass'      "$(outcome deploy-stub-points-at-volundr)"
check 'preview stub points at volundr'     'pass'      "$(outcome preview-stub-points-at-volundr)"

if [[ "$MODE" == authenticated ]]; then
  # THE INTERESTING ONE. Pages serves `main`, so this is a real measured
  # failure — not an error, not unmeasured. A run that reported pass here would
  # mean the evaluator is not reading the setting at all.
  check 'Pages source is measured and fails' 'fail'    "$(outcome pages-source-is-gh-pages)"
  check 'three of four trials passed'        '3'       "$(field '.passing')"
else
  check 'Pages source is unmeasured'         'unmeasured' "$(outcome pages-source-is-gh-pages)"
fi
check 'medal derived from what passed'     "$WANT_MEDAL" "$(field '.medal')"

# The run must also be READABLE BACK. An evaluation that is never persisted is
# invisible to every consumer, and the append path is the half the endpoint
# above does not exercise on its own.
LATEST="$(curl -fsS --connect-timeout 3 --max-time 10 "${hdr[@]}" \
  "http://localhost:7007/api/gildi/trials/$(printf '%s' "$SUBJECT" | jq -sRr @uri)?aspect=${ASPECT}" 2>/dev/null || echo '{}')"
check 'the run was stored and reads back'  "$(field '.runAt')" "$(printf '%s' "$LATEST" | jq -r '.runAt' 2>/dev/null || echo '?')"

echo "--- the run ---"
printf '%s\n' "$RUN" | jq '{kind, medal, applicable, passing, moduleRelease, suppressedReasons, outcomes}' 2>/dev/null || printf '%s\n' "$RUN"

if (( pass )); then
  echo "smoke-facts PASS: a real repository was evaluated and a verdict derived"
else
  echo "smoke-facts FAIL — see the run above and $LOG" >&2
  exit 1
fi
