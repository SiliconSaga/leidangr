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

## As-built (homelab, 2026-06-30)

The skeleton shipped with a token-proof shortcut; the real `bao login -method=oidc` flow is now wired and verified end-to-end on homelab. Setup runbook: `docs/development/openbao-setup.md`.

- **IdP:** Keycloak `siliconsaga` realm, issuer `http://keycloak.localhost/realms/siliconsaga` (dynamic-hostname mode). Confidential client `openbao-cli`, Standard flow, redirect URIs `http://localhost:8250/oidc/callback` + the `127.0.0.1` variant (the `bao` CLI callback).
- **OpenBao:** `oidc` auth method; `default_role=leidangr-dev` (load-bearing — `dev-secrets` logs in with no explicit role); role `leidangr-dev` is role-only (`user_claim=sub`, no group binding yet); policy `leidangr-dev-read` grants `read` on `secret/data/leidangr/dev` + `secret/metadata/leidangr/dev`. `token_ttl=1h`.
- **The non-obvious dependency:** OpenBao does the token exchange server-side from its pod, so it must resolve the same `keycloak.localhost` issuer the browser uses. A homelab CoreDNS rewrite provides that — `components/nordri/docs/keycloak-localhost-coredns.md`. Without it the browser login succeeds but the exchange fails.
- **Verified:** `bao login -method=oidc` (no role) → token with `leidangr-dev-read` → `make secrets` renders `.env.local` → `make smoke-gitea` PASS (`leidangr-portal` + `gear-swap` ingested).

**Follow-ups (not blocking):** the Keycloak client + dev user and the OpenBao auth/policy/role were created imperatively — fold them into the `siliconsaga` realm import and OpenBao IaC respectively for clean rebuilds. Group-gating (a `leidangr-dev` group + `bound_claims`) is the least-privilege hardening step beyond role-only.
