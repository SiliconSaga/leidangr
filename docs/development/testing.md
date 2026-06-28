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

The tests generated with the Backstage app (e.g. `packages/app/src/App.test.tsx`), run by `backstage-cli repo test`.

## `@live` scenarios

Some acceptance scenarios are tagged `@live` (e.g. the real OpenBao → Gitea ingest). They need a live cluster + an unsealed OpenBao and are **excluded from the default run** (the steps file loads features with `tagFilter: 'not @live'`). Run them by hand against a real environment per [`openbao-setup.md`](openbao-setup.md).

Where a full backend boot would be heavy, a few catalog scenarios assert against the configured source/fixture instead (a pragmatic stand-in); the `@live` variant is the real proof. Replacing those with a real `startTestBackend` boot is queued as hardening.

## Adding a test

- **New pure logic?** Add `scripts/lib/<name>.ts` + `<name>.test.ts`. Write the test first, watch it fail, then implement. `make test` picks it up automatically.
- **New acceptance behavior?** Add or extend a `tests/acceptance/*.feature` and its `*.steps.ts`. Keep step text identical between the two.
- **App or plugin code?** Co-locate a test in the workspace; it runs under `make test-app`.
