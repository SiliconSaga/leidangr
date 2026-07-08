# Testing

This component has two test stacks, by design.

## 1. Envelope + acceptance (`make test`)

The DevEx tooling and the BDD acceptance specs run on a dedicated jest config, `jest.envelope.config.cjs`, using `@swc/jest` to transpile TypeScript.

- **Unit (TDD)** — pure logic under `scripts/lib/` (e.g. `doctor.ts`, `dev-secrets.ts`), each with a `*.test.ts`. These are written test-first and have no IO (dependencies are injected), so they run instantly.
- **Acceptance (BDD)** — `tests/acceptance/*.feature` (Gherkin) with matching `*.steps.ts` (jest-cucumber). The feature files mirror the design's "checkpoints".

Run it: `make test` (or `ws test leidangr` in the GDD workspace).

### Why a separate config?

Backstage's own runner (`backstage-cli repo test`, exposed as `make test-app`) only discovers tests inside the `packages/*` / `plugins/*` workspaces. The envelope tooling lives in `scripts/` and the acceptance specs in `tests/`, which that runner ignores — hence the dedicated `jest.envelope.config.cjs`.

## 2. App / backend (`make test-app`)

The tests generated with the Backstage app (e.g. `packages/app/src/App.test.tsx`) plus in-repo backend module units — including the custom `Cycle`/`Saga` kind processors (`packages/backend/src/modules/{cycle,saga}/*Processor.test.ts`) — run by `backstage-cli repo test`.

## The `ci` gate (`make ci`)

`make ci` runs the full gate: `config-check`, `lint`, `tsc` (typecheck), `test` (envelope BDD), and `test-app` (app/backend + the `Cycle`/`Saga` processor units).

## Real catalog-ingestion smoke (`make smoke-catalog`)

`make smoke-catalog` is the committed, end-to-end proof for the custom kinds: it boots the backend headlessly in **stub mode** (no cluster, no secrets), waits for the MTL seed to process, and asserts via the catalog API that the `Cycle` and `Saga` entities ingested **with their emitted relations** (partOf/ownedBy/dependsOn). It tears the backend down on exit and is safe to run anywhere, including CI. This is the real-ingestion counterpart to the source-assertion BDD scenarios below — the stub-mode cousin of the `@live` `make smoke-gitea`.

## `@live` scenarios

Some acceptance scenarios are tagged `@live` (e.g. the real OpenBao → Gitea ingest). They need a live cluster + an unsealed OpenBao and are **excluded from the default run** (the steps file loads features with `tagFilter: 'not @live'`). Run them by hand against a real environment per [`openbao-setup.md`](openbao-setup.md).

The BDD catalog scenarios assert against the seed source (a pragmatic stand-in). The real end-to-end ingestion proof is `make smoke-catalog` (above), which boots the backend and checks the catalog API.

## Adding a test

- **New pure logic?** Add `scripts/lib/<name>.ts` + `<name>.test.ts`. Write the test first, watch it fail, then implement. `make test` picks it up automatically.
- **New acceptance behavior?** Add or extend a `tests/acceptance/*.feature` and its `*.steps.ts`. Keep step text identical between the two.
- **App or plugin code?** Co-locate a test in the workspace; it runs under `make test-app`.
