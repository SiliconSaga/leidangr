# Zero-secret stub mode is the default

- Status: accepted
- Date: 2026-06-27
- Deciders: Cervator, Claude (Opus 4.8)

## Context and Problem Statement

Developers cloning only this repo, CI, and offline work all need Backstage to boot without secrets or a cluster. We must decide where the dev/stub configuration lives.

## Considered Options

- Treat the base `app-config.yaml` as the stub/dev config.
- Add a separate `app-config.development.yaml` overlay for dev defaults.

## Decision Outcome

Chosen: **the base `app-config.yaml` is the zero-secret stub config** — SQLite (`:memory:`), `guest` auth, the generated example catalog, and the only env ref (`${GITHUB_TOKEN}`) optional. No separate `app-config.development.yaml`: `backstage-cli start` does not auto-load it, so it would be a dead file. Secrets and external integrations are additive overlays (see ADR 0004), never in the base.

### Consequences

- Good: `git clone` → `make dev` boots offline with no secrets; CI and the BDD suite run against this mode.
- Good: one obvious config to reason about; deviates from the original plan's dev-overlay only because that overlay would never load.
- Bad/deferred: the base carries dev-only settings (guest auth, localhost CORS) that a future production deployment must override; production hardening is out of scope for the skeleton.
