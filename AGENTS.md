# AGENTS.md — Leiðangr (Backstage)

Agent-facing guidance for this component. The human entry point is [`README.md`](README.md); this file covers the conventions an agent should follow when changing the repo.

## What this is

The Backstage control-plane for the Leiðangr stack — a local-first skeleton. Two run modes: **stub** (zero secrets, the default/CI path) and **Gitea** (catalog sourced from a private Gitea repo, authenticated by an OpenBao-sourced token). See [`README.md`](README.md) for the full picture and [`docs/adrs/`](docs/adrs/) for why.

## Working here

- **Yarn runs through Corepack** — never assume a global `yarn`; use `make` / `corepack yarn`. (`corepack enable` needs admin on Windows; the Makefile avoids it.)
- **One command per workflow** via the `Makefile` (`doctor`/`dev`/`dev-gitea`/`smoke-gitea`/`test`/`test-app`/`lint`/`config-check`/`secrets`/`ci`). In the GDD workspace, `ws test leidangr` / `ws lint leidangr` run the same suites (allowlisted).
- **Secrets** only ever come from `make secrets` (OpenBao → gitignored `.env.local`); never hand-edit or commit secrets. The app reads only `${ENV}` references.
- **Gitea mode needs `gitea.localhost` in your hosts file** (Node doesn't resolve `*.localhost` like curl/git); `make dev-gitea` / `make smoke-gitea` preflight-check it and print the fix.

## Testing

- **TDD** the pure tooling in `scripts/lib/*.ts` (`doctor`, `dev-secrets`) — tests are `*.test.ts`, write the test first.
- **BDD** acceptance specs are `tests/acceptance/*.feature` + `*.steps.ts` (jest-cucumber). Keep the Gherkin step text identical between feature and steps. Scenarios that assert on source/config/fixtures are named as *contract* checks; the real live behavior is `make smoke-gitea` (the `@live` path, tag-excluded from `make test`).
- Both run on `jest.envelope.config.cjs`, separate from `backstage-cli repo test` (`make test-app`).

## Architecture Decision Records

**Capture durable architecture decisions as MADR ADRs in [`docs/adrs/`](docs/adrs/).**

Write an ADR when a decision is **costly to reverse** or a future contributor would otherwise **re-litigate** it — framework/system choices, the secret/auth model, the catalog source, the test strategy, the deployment shape. Do **not** ADR routine fixes, refactors, or bug fixes; those belong in the commit message.

Number sequentially (`NNNN-kebab-title.md`), use the MADR v3 shape (Context / Considered Options / Decision Outcome / Consequences), and add a row to [`docs/adrs/README.md`](docs/adrs/README.md). The `@backstage-community/plugin-adr` is deferred (GitHub-only today); ADRs live as files until a GitHub-readable source exists.

## Pointers

- [`README.md`](README.md) — human quickstart, run modes, command table.
- [`docs/adrs/`](docs/adrs/) — decisions (start here to understand *why*).
- [`docs/development/openbao-setup.md`](docs/development/openbao-setup.md) — the live OpenBao → Gitea setup.
- [`docs/development/testing.md`](docs/development/testing.md) — the two test stacks and how to add a test.
