# Leiðangr Backstage — DevEx envelope.
# One command per workflow. `yarn` is invoked via `corepack` so it works
# without a global install (Node ships Corepack; the pinned Yarn is in
# package.json `packageManager`).

# Recipes use bash so dotenv sourcing (dev-gitea) is portable across platforms.
SHELL := bash

COREPACK_ENABLE_DOWNLOAD_PROMPT ?= 0
export COREPACK_ENABLE_DOWNLOAD_PROMPT

.PHONY: doctor deps dev dev-gitea smoke-gitea smoke-catalog test test-app lint config-check secrets ci

## doctor — check Node, Corepack, bao, and required dev ports (no secret values printed)
doctor:
	node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/lib/run-doctor.mjs

## deps — install dependencies (immutable)
deps:
	corepack yarn install --immutable

## dev — start Backstage in stub mode (zero secrets)
dev:
	corepack yarn start

## dev-gitea — start Backstage with the Gitea catalog source (after `make secrets`)
dev-gitea:
	node scripts/preflight-gitea.mjs
	test -f .env.local || { echo "dev-gitea: no .env.local — run 'make secrets' first." >&2; exit 1; }
	set -a; . ./.env.local; set +a; ROOT="$$(cygpath -m "$$PWD" 2>/dev/null || pwd)"; corepack yarn start --config "$$ROOT/app-config.yaml" --config "$$ROOT/app-config.gitea.yaml"

## smoke-gitea — headless @live check: assert the Gitea entities ingest, then tear down
smoke-gitea:
	node scripts/preflight-gitea.mjs
	bash scripts/smoke-gitea.sh

## smoke-catalog — headless real-ingestion check for the custom Cycle/Saga kinds
## (stub mode — no cluster, no secrets; safe anywhere incl. CI)
smoke-catalog:
	bash scripts/smoke-catalog.sh

## test — envelope tooling + BDD acceptance (jest-cucumber)
test:
	corepack yarn jest --config jest.envelope.config.cjs

## test-app — the generated app/backend unit tests (backstage-cli)
test-app:
	corepack yarn backstage-cli repo test

## lint — repo lint across all workspaces
lint:
	corepack yarn backstage-cli repo lint

## config-check — validate the app-config (the base is the zero-secret dev/stub config)
config-check:
	corepack yarn backstage-cli config:check --config app-config.yaml

## secrets — render .env.local from OpenBao (browser OIDC login)
secrets:
	bash scripts/dev-secrets

## ci — the gate: config-check, lint, envelope tests, app/backend unit tests
ci: config-check lint test test-app
