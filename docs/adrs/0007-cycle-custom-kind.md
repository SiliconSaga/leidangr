# Cycle: a custom catalog kind for bounded groupings

- Status: accepted
- Date: 2026-07-06
- Deciders: Cervator, Claude (Opus 4.8)

## Context and Problem Statement

Backstage's catalog has no built-in concept for a **bounded, dated grouping of occurrences** — a soccer season, a software release, a multi-day event. We need to model the community domain (and, generically, software release/deployment structure) without overloading `Component`.

## Considered Options

- Reuse built-in kinds only (Domain/System/Group/Resource + `spec.type` conventions).
- Introduce a custom kind per domain concept (`CommunityGroup`, `Program`, `Activity`, `ResourceType`, `Facility`, …).
- A single custom **`Cycle`** kind for the whole bounded-grouping family; everything else built-in.

## Decision Outcome

Chosen: a single custom **`Cycle`** kind (`apiVersion: siliconsaga.org/v1alpha1`), discriminated by an **open `spec.type` vocabulary** (`season`, `release`, `series`, `production`, `drive`, `tournament`, …). It is validated and wired by a new-backend-system catalog module (`CycleProcessor` registered via `catalogProcessingExtensionPoint`). The processor **reuses built-in relation types** rather than inventing new ones:

- `spec.of` → `partOf` / `hasPart` (the Cycle is part of its league/app),
- `spec.owner` → `ownedBy` / `ownerOf`,
- `spec.happensAt` → `dependsOn` / `dependencyOf` (the field/resource it uses),

so the catalog graph and relation cards integrate for free. Everything else in the domain uses built-in kinds: a typed `Group` tree (people-org), facilities/fields/environments as `System` + typed `Resource`, and real software as `System` + `Component`.

### Consequences

- Good: one small custom kind covers the bounded-grouping family across community and software domains; built-in relations mean no bespoke frontend wiring to see the graph.
- Occurrences (matches, deployments, single events) are **queried from source, not minted** as catalog entities — minting each would churn the catalog.
- `ResourceType` is dropped (a `Resource` is already typed; revisit as a Phase-4 vocabulary) and `Activity` dissolves into an occurrence or a `Cycle`.
- The narrated **`Saga`** kind and the TeamSnap entity-provider are designed but deferred.
- The custom kind renders on the **default entity page** for now; a curated page is a follow-up.

See the design: [`../plans/2026-07-06-leidangr-phase3-community-domain-design.md`](../plans/2026-07-06-leidangr-phase3-community-domain-design.md).
