# Leiðangr Backstage — DevEx envelope.
# One command per workflow. `yarn` is invoked via `corepack` so it works
# without a global install (Node ships Corepack; the pinned Yarn is in
# package.json `packageManager`).

COREPACK_ENABLE_DOWNLOAD_PROMPT ?= 0
export COREPACK_ENABLE_DOWNLOAD_PROMPT

.PHONY: doctor deps dev test test-app lint config-check secrets ci

## doctor — check Node, Corepack, bao, and required dev ports (no secret values printed)
doctor:
	node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/lib/run-doctor.mjs

## deps — install dependencies (immutable)
deps:
	corepack yarn install --immutable

## dev — start Backstage (frontend + backend) in the local config stack
dev:
	corepack yarn start

## test — envelope tooling + BDD acceptance (jest-cucumber)
test:
	corepack yarn jest --config jest.envelope.config.cjs

## test-app — the generated app/backend unit tests (backstage-cli)
test-app:
	corepack yarn backstage-cli repo test

## lint — repo lint across all workspaces
lint:
	corepack yarn backstage-cli repo lint

## config-check — validate the layered app-config
config-check:
	corepack yarn backstage-cli config:check --config app-config.yaml --config app-config.development.yaml

## secrets — render .env.local from OpenBao (browser OIDC login)
secrets:
	bash scripts/dev-secrets

## ci — the gate: config-check, lint, envelope tests
ci: config-check lint test
