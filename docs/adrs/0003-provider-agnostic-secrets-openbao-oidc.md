# Provider-agnostic secrets via dev-secrets (OpenBao OIDC)

- Status: accepted
- Date: 2026-06-27
- Deciders: Cervator, Claude (Opus 4.8)

## Context and Problem Statement

The local app needs a real secret (a Gitea token) from a central, multi-consumer OpenBao that may run on local k3s or on GKE. The app must not be coupled to the secret store; the zero-secret stub boot works without OpenBao, but `dev-secrets` still requires one reachable OpenBao (direct `BAO_ADDR` or a port-forward) to retrieve the secret.

## Considered Options

- A `dev-secrets` script renders a gitignored `.env.local`; the app reads only `${ENV}`.
- External Secrets Operator projects a Kubernetes Secret that the app reads.
- The app reads OpenBao directly at runtime.

## Decision Outcome

Chosen: a single supported path, **`scripts/dev-secrets`**. It resolves the OpenBao target itself — a direct `BAO_ADDR` URL when set (the contributor path), else a `kubectl` port-forward (the cluster-owner path) — runs `bao login -method=oidc` (browser → the existing Keycloak), and renders the gitignored `.env.local`. The app consumes only environment variables and never learns which OpenBao backs it. The resolution/validation/render logic is pure and TDD'd; the orchestrator is thin IO glue. The ESO-projected-Secret approach is the future *deployed* path, not local dev; runtime-direct reads were rejected (couples the app to the store).

### Consequences

- Good: the same Backstage runs against homelab or GKE (stub mode covers the no-OpenBao case); reproduces the "run one command, log in via browser, get a local secrets file" UX using infrastructure already run. No Consul — Backstage `$env`/`$file` replace runtime templating.
- Good: secrets only ever land in gitignored `.env.local`; key presence is logged, values never are.
- Note: the contributor (no-port-forward) path requires OpenBao itself reachable at a URL, so the live/GKE phase must expose OpenBao (TLS via the shipped wildcard, a Keycloak-group → read-only policy, short tokens, or Tailscale-only) — recorded for that phase, out of skeleton scope.
