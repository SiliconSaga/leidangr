# Saga: a Git-backed catalog kind for narrated effort records

- Status: accepted
- Date: 2026-07-06
- Deciders: Cervator, Claude (Opus 4.8)

## Context and Problem Statement

The two-family model (ADR 0007) pairs the structured/ingestable `Cycle` with a narrated/authored counterpart: an After-Action-Report a human *writes* about an effort — a season, a talent show, a fundraiser. Backstage has no home for such narrative, and cramming append-only history into a refreshable catalog node fights the catalog.

## Considered Options

- No kind — keep narratives as loose docs / TechDocs only.
- A `Saga` kind whose narrative body lives in the Backstage DB.
- A `Saga` kind that is a thin index entity, with the narrative body in Git.

## Decision Outcome

Chosen: a custom **`Saga`** kind (`apiVersion: siliconsaga.org/v1alpha1`) that is a **thin, Git-backed index entity**. The narrative body is a markdown file in the org's repo, referenced by the required `siliconsaga.org/saga-doc` annotation; the entity carries `spec.skald` (the authoring User — flair for "author"), `spec.timeframe`, `spec.touches` (entity refs the Saga narrates), and optional `spec.owner`. A `SagaProcessor` (new-backend-system catalog module) validates these and emits **built-in** relations: `spec.skald`/`spec.owner` → `ownedBy`/`ownerOf`, and `spec.touches[]` → `dependsOn`/`dependencyOf`.

### Consequences

- Good: nothing unique lives only in Backstage's DB — both the prose and the entity descriptor are Git files; the DB is a rebuildable cache.
- Good: reuses built-in relation types, so the catalog graph shows what a Saga touched with no bespoke wiring.
- A `Saga` is distinct from a `Cycle`: a season always exists as a `Cycle`; it becomes a `Saga` only if a Skald writes one (zero, one, or many per effort).
- **Deferred:** the authoring UX (catalog-backed `EntityPicker`s for `touches`) and blog/TechDocs-style rendering of `saga.md`. This ADR covers the catalog kind, not the reader/authoring surface — the `Saga` renders on the default entity page for now.

See ADR [0007](0007-cycle-custom-kind.md) (Cycle / two-family model) and the design doc §5.
