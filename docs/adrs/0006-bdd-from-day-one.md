# BDD from day one over TDD'd tooling

- Status: accepted
- Date: 2026-06-27
- Deciders: Cervator, Claude (Opus 4.8)

## Context and Problem Statement

We want a testing discipline that proves the skeleton's acceptance criteria (the checkpoint "done signals") and keeps the envelope tooling honest, without a heavy harness.

## Considered Options

- BDD acceptance (jest-cucumber) over TDD'd TypeScript tooling.
- TDD only (unit tests, no executable acceptance specs).
- A full `startTestBackend` integration for every catalog scenario.

## Decision Outcome

Chosen: **BDD from day one** — the checkpoint `.feature` files are executable via jest-cucumber — layered over **TDD'd** TypeScript envelope tooling (`doctor`, `dev-secrets`). Both run on a dedicated `jest.envelope.config.cjs` (`@swc/jest`), kept separate from `backstage-cli repo test` (which only discovers `packages/*`/`plugins/*`). Catalog/ingest scenarios use **pragmatic source assertions** (parse the configured source / fixture) where a full `startTestBackend` boot is heavy; the genuine end-to-end is the `@live`-tagged scenario.

### Consequences

- Good: `ws test leidangr` runs the non-`@live` envelope + acceptance suite fast and green; the acceptance specs document the checkpoints as runnable artifacts.
- Good: honest separation of mocked vs. live — the `@live` scenarios are tag-excluded from the default run and exercised against the real cluster in the live checkpoint.
- Follow-up: replacing the pragmatic catalog assertions with a real `startTestBackend` boot is queued as hardening.
