#!/usr/bin/env bash
# with-mkdocs.sh — put a real mkdocs on PATH, then exec the given command.
#
#   bash scripts/with-mkdocs.sh corepack yarn start
#
# WHY THIS EXISTS
# TechDocs spawns `mkdocs` WITHOUT a shell, so Node has to exec the file
# directly. A pyenv shim (`mkdocs.bat`, or the extensionless launcher beside it)
# cannot be exec'd that way, and the failure surfaces only at render time as a
# bare `spawn mkdocs ENOENT` — long after `make dev` looked healthy. Backstage
# offers no config for the binary path (the generator hardcodes
# `command: "mkdocs"`), so PATH is the only lever. See
# docs/development/local-dev.md.
#
# RESOLUTION ORDER
#   1. $MKDOCS_BIN — the explicit override, for system Python, conda, a venv, or
#      anything pyenv cannot answer for. `ws run` exports the workspace .env, so
#      setting it there is enough to reach this.
#   2. `pyenv which mkdocs` — reports the real executable, unlike `which`/`where`
#      which find the shim first.
#   3. Nothing. If mkdocs is already a real executable on PATH, or is not
#      installed at all, this is a silent no-op and the command runs unchanged —
#      TechDocs is optional for most local work.
set -euo pipefail

# Git Bash gets Windows paths out of pyenv (C:\...\mkdocs.exe). `dirname` does
# not treat backslashes as separators and would answer "." — which would then be
# prepended to PATH. Normalise first where cygpath exists.
to_unix_path() {
    if command -v cygpath >/dev/null 2>&1; then
        cygpath -u "$1"
    else
        printf '%s' "$1"
    fi
}

bin_dir="${MKDOCS_BIN:-}"
[[ -n "$bin_dir" ]] && bin_dir="$(to_unix_path "$bin_dir")"

if [[ -z "$bin_dir" ]] && command -v pyenv >/dev/null 2>&1; then
    resolved="$(pyenv which mkdocs 2>/dev/null || true)"
    if [[ -n "$resolved" ]]; then
        bin_dir="$(dirname "$(to_unix_path "$resolved")")"
    fi
fi

# Guard the empty case deliberately: a leading ":" in PATH means the current
# directory, which is not something to add behind someone's back.
if [[ -n "$bin_dir" && -d "$bin_dir" ]]; then
    export PATH="$bin_dir:$PATH"
fi

exec "$@"
