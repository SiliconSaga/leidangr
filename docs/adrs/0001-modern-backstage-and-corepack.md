# Modern Backstage systems + Corepack toolchain

- Status: accepted
- Date: 2026-06-27
- Deciders: Cervator, Claude (Opus 4.8)

## Context and Problem Statement

A fresh Backstage instance can start on the legacy or the new frontend/backend systems, and Yarn can be installed globally or run via Corepack. We want a modern, upgradeable base that a contributor can build without admin rights.

## Considered Options

- New frontend + new backend systems (the `@backstage/create-app` defaults).
- Legacy/hybrid frontend with a compatibility bridge.
- Global Yarn install vs. Corepack-managed Yarn.

## Decision Outcome

Chosen: scaffold with `@backstage/create-app` on the **new frontend and backend systems**, Yarn 4 pinned via `package.json` `packageManager` and run through **Corepack** (no global install). Node is the current Active LTS (24; `engines: 22 || 24`), pinned via `.nvmrc`.

### Consequences

- Good: modern, well-supported base; smaller upgrade debt; Corepack avoids the `corepack enable` admin write to `C:\Program Files\nodejs` (which fails without elevation) — every Makefile target invokes `corepack yarn`.
- Good: contributors need only Node; Yarn is provisioned on first use.
- Neutral: all envelope commands carry the `corepack yarn` prefix rather than a bare `yarn`.
