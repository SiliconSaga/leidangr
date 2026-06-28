# Gitea as the catalog source (overlay; GitHub deferred)

- Status: accepted
- Date: 2026-06-27
- Deciders: Cervator, Claude (Opus 4.8)

## Context and Problem Statement

The skeleton needs a real catalog source that is authenticated by the OpenBao-sourced token, runs locally, and does not compromise the zero-secret stub boot (ADR 0002).

## Considered Options

- In-cluster Gitea as the source (token-authenticated), in an overlay.
- GitHub catalog discovery as the source.
- Put the Gitea location in the base config.

## Decision Outcome

Chosen: **in-cluster Gitea**, configured in `app-config.gitea.yaml` and loaded only in local-secrets mode (`make dev-gitea`). The Gitea integration authenticates with `username` + `password` (a Gitea access token is the password — the integration has no `token` field), from `${GITEA_USER}` / `${GITEA_TOKEN}`. The overlay is kept **out of the base** so the stub boot never tries to reach Gitea. GitHub integration is deferred to a later slice.

### Consequences

- Good: local-first; the OpenBao secret is naturally a Gitea credential; stub mode is unaffected.
- Bad: the Backstage ADR plugin is GitHub-only today, so it cannot render these ADRs while Gitea is the only source (see docs/adrs/README.md) — the ADRs stay as files until a GitHub source exists.
