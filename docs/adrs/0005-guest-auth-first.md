# Guest auth first; Keycloak sign-in deferred

- Status: accepted
- Date: 2026-06-27
- Deciders: Cervator, Claude (Opus 4.8)

## Context and Problem Statement

The skeleton's focus is the OpenBao → Gitea catalog loop. Keycloak is already running (it backs OpenBao's OIDC auth). We must decide whether to also wire Keycloak as Backstage's sign-in now.

## Decision Outcome

Chosen: Backstage **sign-in stays `guest`** for the skeleton; wiring Keycloak's generic OIDC provider as Backstage's sign-in is a later slice. This keeps the first slice small and focused.

Important distinction: Keycloak **is** used in this slice — as the OIDC provider for OpenBao's `bao login -method=oidc` in `dev-secrets` (ADR 0003). What is deferred is Keycloak as the *Backstage user sign-in*, which is a separate concern.

### Consequences

- Good: smaller first slice; no auth-resolver/sign-in-page wiring yet.
- Neutral: the distinction between "OpenBao OIDC auth (used)" and "Backstage sign-in (deferred)" must be kept clear in docs so the deferral isn't read as "Keycloak unused."
