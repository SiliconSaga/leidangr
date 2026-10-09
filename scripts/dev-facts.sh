#!/usr/bin/env bash
# dev-facts — `make dev`, but with the trial store already populated so the medal
# badges are there when the page loads.
#
# WHY THIS EXISTS. The dev backend's database is `connection: ':memory:'`, so the
# trial store starts EMPTY on every boot — a reboot has nothing to do with it.
# On top of that the sweep carries a deliberate two-minute initial delay, so a
# plain `make dev` shows an empty badge column for the first couple of minutes
# and then fills it in while you are looking somewhere else. That makes the one
# surface the badges live on the hardest thing in the app to actually look at.
#
# This boots the app exactly as `make dev` does, waits for the catalog, then
# drives the SAME `runOne` the sweep uses through the refresh endpoint for every
# enrolled component. The server is left running afterwards, so the log keeps
# scrolling and the app stays browsable.
#
# Nothing here is a production code path: the seeding is HTTP calls against the
# running backend, so the plugin needs no dev flag and the sweep keeps its delay.
#
# Run: `make dev-facts`. Needs network. Without GH_TOKEN exported the Pages trial
# cannot be measured, so hygiene-testsite seeds as `withheld` rather than silver —
# which is correct behaviour, and worth seeing too.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

for _cmd in corepack curl jq; do
  command -v "$_cmd" >/dev/null 2>&1 || { echo "dev-facts: missing prerequisite '$_cmd'" >&2; exit 1; }
done

mkdir -p .dev
ROOT="$(cygpath -m "$PWD" 2>/dev/null || pwd)"
LOG="$ROOT/.dev/dev-facts.log"
TOKEN="leidangr-devfacts-$$-local-only"
BASE=http://localhost:7007

# Generated, never committed (.dev is gitignored): a static token so this script
# can reach the catalog and the gildi API while the app runs with guest auth.
cat > .dev/app-config.devfacts.yaml <<EOF
backend:
  auth:
    externalAccess:
      - type: static
        options:
          token: ${TOKEN}
          subject: leidangr-dev-facts
EOF

DEV_PID=""
TAIL_PID=""

# KILLS THE TREE, not just the process we spawned. The listener is a grandchild
# — corepack spawns backstage-cli, which spawns node — and on Windows killing
# the parent routinely leaves the backend holding port 7007. That stray then
# fails the NEXT run with EADDRINUSE, which is how this script's own testing
# burned two attempts. `taskkill //T` walks the tree (double slashes so MSYS does
# not mangle the flags into paths — see docs/development/local-dev.md); the plain
# kill is the fallback on a non-Windows host.
kill_tree() {
  local pid="$1"
  [[ -n "$pid" ]] || return 0
  if command -v taskkill >/dev/null 2>&1; then
    taskkill //F //T //PID "$pid" >/dev/null 2>&1 || true
  fi
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

cleanup() {
  # The tail first, so its last read does not race the server's teardown output.
  if [[ -n "$TAIL_PID" ]]; then
    kill "$TAIL_PID" 2>/dev/null || true
    wait "$TAIL_PID" 2>/dev/null || true
    TAIL_PID=""
  fi
  kill_tree "$DEV_PID"
  DEV_PID=""
}
# EXIT cleans up; INT and TERM clean up AND STOP. Trapping all three to the same
# handler let an interrupt fall back into whatever loop was running — Ctrl-C
# would tear the server down and then carry on polling a backend that no longer
# existed. The 130/143 statuses are the conventional "killed by SIGINT/SIGTERM".
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

hdr=(-H "Authorization: Bearer ${TOKEN}")
# Polled in a loop, so a lost call costs one iteration rather than the run — but
# the connect timeout is still well clear of what frontend compilation does to
# this box.
api() { curl -fsS --connect-timeout 15 --max-time "${2:-30}" "${hdr[@]}" "$1" 2>/dev/null || echo '{}'; }

# Same two boot conditions the smokes document at length — see
# scripts/smoke-catalog.sh for the mechanism behind both.
#
# ⚠ REPORTS WHICH PORT, rather than assuming the backend's. `yarn start` binds
# TWO — the frontend on 3000 and the backend on 7007 — and a stray frontend is
# just as likely to be the blocker. An earlier version of this message named 7007
# unconditionally and sent the reader after the wrong process while a leftover
# frontend held 3000 on IPv6 (`::1:3000`, which an IPv4-only netstat does not
# even list). The check was port-agnostic the whole time; only the prose was not.
HELD_PORT=""
port_still_held() {
  HELD_PORT="$(grep -aoiE "EADDRINUSE: address already in use [^ ]*" "$LOG" 2>/dev/null \
    | head -n 1 | grep -oE '[0-9]+$' || true)"
  grep -qai "EADDRINUSE" "$LOG" 2>/dev/null
}
startup_race_lost() {
  grep -qE "BackendStartupError|Backend startup failed" "$LOG" 2>/dev/null || return 1
  grep -qE "IPC request 'DevDataStore\.load'.* timed out" "$LOG" 2>/dev/null
}

# REDIRECTED, then tailed — not piped through tee. `cmd | tee f &` sets `$!` to
# tee's pid, so the cleanup would kill the tail and leave the dev server running;
# the retry below would then hit its own port as EADDRINUSE and blame the user.
# Redirecting makes `$!` unambiguously the server.
start_dev() {
  : > "$LOG"
  bash scripts/with-mkdocs.sh corepack yarn start \
    --config "$ROOT/app-config.yaml" \
    --config "$ROOT/.dev/app-config.devfacts.yaml" >"$LOG" 2>&1 &
  DEV_PID=$!
  tail -n +1 -f "$LOG" &
  TAIL_PID=$!
  for _ in $(seq 1 240); do
    grep -q "Listening on" "$LOG" 2>/dev/null && return 0
    kill -0 "$DEV_PID" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}

# Enrolled components, discovered rather than hardcoded, so this keeps working as
# the seed grows. Mirrors what the sweep itself looks for.
#
# Bounded by wall clock as well as iterations, and more generously than
# smoke-catalog's 300s: `yarn start` compiles the FRONTEND at the same time, so
# the catalog finishes processing its locations later here than in a
# backend-only boot. Two of those locations are read over the network.
PAIRS=""

# ⚠ `tr -d '\r'` BELOW IS LOAD-BEARING ON WINDOWS. jq here emits CRLF, so every
# line except the last carries a carriage return — which `read` puts straight
# into the aspect, and curl then rejects with "Malformed input to a URL
# function". Measured, not guessed: the first run that got this far seeded only
# its LAST pair and failed the other six, because the last line is the one
# without a trailing CR. One more platform assumption that only a real run could
# have corrected.
poll_for_pairs() {
  PAIRS=""
  local deadline=$((SECONDS + 420))
  while (( SECONDS < deadline )); do
    PAIRS="$(api "${BASE}/api/catalog/entities?filter=kind=component" 20 | jq -r '
      (if type == "array" then . else [] end)
      | map(select(.metadata.annotations["siliconsaga.org/aspects"] // "" | length > 0))
      | map(
          . as $e
          | ($e.metadata.annotations["siliconsaga.org/aspects"] | split(",") | map(ascii_downcase | gsub("^ +| +$"; "")) | map(select(length > 0)))
          | map("component:" + (($e.metadata.namespace // "default") | ascii_downcase) + "/" + ($e.metadata.name | ascii_downcase) + " " + .)
        )
      | flatten | .[]' 2>/dev/null | tr -d '\r' || true)"
    if [[ -n "$PAIRS" ]]; then return 0; fi
    # The race does NOT announce itself at the listen line — the IPC timeouts
    # land several seconds later, which is exactly how the first version of this
    # script missed it and then reported a flake as a hard failure. Checking it
    # here, against the thing we actually need, is the only placement that works.
    #
    # Spelled as `if` rather than `cond && return`: a failing AND-list is exempt
    # from `set -e` in this position, but relying on that quirk to not exit the
    # script is not something the next reader should have to verify.
    if startup_race_lost; then return 1; fi
    sleep 2
  done
  return 1
}

# One retry, and only for that race. Retried at all because it loses roughly half
# of dev-mode boots on this machine, and a tool that works half the time is not
# one you reach for; a backend that listened and then ingested nothing for any
# OTHER reason is a real finding and must not be retried into looking flaky.
echo "dev-facts: starting Backstage (frontend + backend)"
for attempt in 1 2; do
  if ! start_dev; then
    if port_still_held; then
      echo "" >&2
      echo "dev-facts: port ${HELD_PORT:-3000 or 7007} is already held by another process." >&2
      echo "  An earlier dev server outlived its terminal. 'yarn start' binds the" >&2
      echo "  frontend (3000) as well as the backend (7007), and either can be the" >&2
      echo "  leftover. A stray frontend binds IPv6, so 'netstat -ano' without" >&2
      echo "  '-p tcpv6' will not show it. The stop-cleanly section of" >&2
      echo "  docs/development/local-dev.md has the taskkill incantation." >&2
      exit 1
    fi
    echo "dev-facts: the dev server never logged 'Listening on' — see $LOG" >&2
    exit 1
  fi

  echo "dev-facts: waiting for enrolled components to ingest"
  if poll_for_pairs; then break; fi

  if ! startup_race_lost; then
    echo "" >&2
    echo "dev-facts: no enrolled components after $((SECONDS))s — nothing seeded." >&2
    echo "  The app is still up and still usable, and the sweep will fill the badges" >&2
    echo "  in on its own once the catalog settles. If this persists, the catalog is" >&2
    echo "  not ingesting at all — 'make smoke-catalog' will say why." >&2
    wait "$DEV_PID"
    exit 1
  fi

  if (( attempt == 2 )); then
    echo "" >&2
    echo "dev-facts: the backend lost the DevDataStore IPC race twice." >&2
    echo "  An ENVIRONMENT failure, not a change you made — see startup_race_lost()" >&2
    echo "  in scripts/smoke-catalog.sh. Re-run, ideally on a quieter machine." >&2
    exit 1
  fi

  echo ""
  echo "dev-facts: the backend lost the DevDataStore IPC race on boot, restarting once."
  echo "  (a startup timing flake — the catalog ingested nothing, so there is"
  echo "   nothing to seed yet. Not a code problem.)"
  echo ""
  cleanup
  # A moment for the OS to release the socket, so the retry's own bind failure
  # reports as port_still_held rather than a mysterious missing listen line.
  sleep 3
done

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "dev-facts: GH_TOKEN is unset, so the GitHub Pages trial cannot be measured."
  echo "  Expect 'withheld' where a medal would otherwise be earned — the correct"
  echo "  answer for a trial we could not read, not a failing grade."
fi

# GENEROUS CONNECT TIMEOUT, and curl's own error kept rather than discarded.
# `yarn start` is compiling the frontend while this runs, and a 3s connect
# timeout lost six of seven pairs to that contention on the first real run —
# requests that never reached the server at all, reported as "no run returned"
# because the error had been sent to /dev/null. A seeding call is not a liveness
# probe: it can afford to wait.
ERRFILE="$ROOT/.dev/dev-facts-curl.err"
refresh_one() {
  curl -fsS --connect-timeout 30 --max-time 300 -X POST "${hdr[@]}" \
    "${BASE}/api/gildi/trials/$(printf '%s' "$1" | jq -sRr @uri)/refresh?aspect=$(printf '%s' "$2" | jq -sRr @uri)" \
    2>"$ERRFILE"
}

echo "dev-facts: evaluating now, rather than waiting out the sweep's 2-minute delay"

# A HERE-STRING, not a pipe. `printf | while read` runs the loop in a subshell,
# so the counters below would be discarded at the end of it and the script would
# print its success message no matter what happened — which is exactly what it
# used to do.
SEEDED=0
FAILED=0
while read -r ref aspect; do
  if [[ -z "$ref" || -z "$aspect" ]]; then continue; fi
  : > "$ERRFILE"
  # Retried once: the first call for a given aspect pays for the practice lookup
  # and the standard fetch, so it is the one most likely to lose to a busy box.
  run="$(refresh_one "$ref" "$aspect" || refresh_one "$ref" "$aspect" || true)"
  if [[ -z "$run" ]]; then
    why="$(tr -d '\r' < "$ERRFILE" | tr '\n' ' ' | sed 's/  */ /g')"
    echo "  ?? ${ref} / ${aspect} — ${why:-no response and no error from curl}"
    FAILED=$((FAILED + 1))
    continue
  fi
  # One line per pair, naming the verdict AND why when there is no medal — the
  # whole point of the badge is that those are different answers. An unevaluated
  # or withheld run still COUNTS as seeded: a row was written, and the badge has
  # something true to draw.
  line="$(printf '%s\n' "$run" | jq -r --arg ref "$ref" --arg aspect "$aspect" '
    if .kind == null then "  ?? \($ref) / \($aspect) — no run in the response"
    elif .kind == "unevaluated" then "  -- \($ref) / \($aspect) — not evaluated (\(.unevaluatedReason // "unknown"))"
    elif .medal == null then "  -- \($ref) / \($aspect) — withheld (\((.suppressedReasons // []) | join(", ")))"
    else "  ok \($ref) / \($aspect) — \(.medal) (\(.passing)/\(.applicable))"
    end' 2>/dev/null || true)"
  if [[ -z "$line" ]]; then
    line="  ?? ${ref} / ${aspect} — malformed response"
  fi
  echo "$line"
  case "$line" in
    '  ??'*) FAILED=$((FAILED + 1)) ;;
    *) SEEDED=$((SEEDED + 1)) ;;
  esac
done <<< "$PAIRS"

echo ""
if (( SEEDED == 0 )); then
  # NOT a success message. The server is still the deliverable and the sweep
  # will populate the badges on its own in a couple of minutes, so this does not
  # tear anything down — but it must not claim the badges are there.
  echo "dev-facts: NOTHING was seeded — all ${FAILED} refresh attempts failed." >&2
  echo "  The app is up and usable, and the scheduled sweep will fill the badges" >&2
  echo "  in once it fires. The badge column is empty until then." >&2
elif (( FAILED > 0 )); then
  echo "dev-facts: seeded ${SEEDED}, FAILED ${FAILED}. The failures are listed above."
else
  echo "dev-facts: seeded ${SEEDED}."
fi

cat <<'EOF'
  http://localhost:3000/catalog/default/component/hygiene-testsite

  The sweep still fires on its own two minutes in and appends fresh runs on top
  of these. Stopping the server is the same story as `make dev` — Ctrl-C under
  Git Bash often lands as a reload rather than a kill; see the stop-cleanly
  section of docs/development/local-dev.md.
EOF

wait "$DEV_PID"
