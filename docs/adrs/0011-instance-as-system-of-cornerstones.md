# The instance is a System of cornerstones; the hub type retires

- Status: accepted
- Date: 2026-08-10
- Deciders: Cervator, Claude (Opus 5)

## Context and Problem Statement

The seed carried one entity for the instance itself: `guild-hall`, a `Component` with `spec.type: hub`, added as a placeholder for a then-unbuilt "hub page" concept. Once the Guild Hall shipped as a real plugin page, that entity was actively wrong — a hub is a *rendered surface*, and giving it a catalog entity made presentation masquerade as a domain noun, the exact confusion custom kinds were being kept scarce to avoid.

Retiring it was not as simple as deletion, and the reason is structural: **TechDocs resolves `backstage.io/techdocs-ref: dir:.` against the entity descriptor's own file**, and only a repo-root entity can anchor repo-root docs. A plugin page can never be a docs target. Deleting `guild-hall` would have orphaned the model overview, the grand tour and every ADR — including this one.

## Considered Options

- **Delete the entity, rehome its docs onto the Guild Hall page** (the 2026-07-20 plan's recorded intent). Fails outright: a page cannot anchor TechDocs, so the docs had nowhere to land.
- **Rename and retype it as a flat Component** for the instance. Works, keeps the docs, but says the instance is one indivisible unit — false the moment a second plugin exists.
- **Model the instance as the System of parts it is.** Chosen.

## Decision Outcome

Chosen: **Domain `siliconsaga` → System `leidangr` → Component `gildi`**, replacing the single `hub` Component. The System carries the root TechDocs; each cornerstone is a Component of `spec.type: plugin` declaring itself in **its own package directory** (`plugins/gildi/catalog-info.yaml`), the live-topology shape `tracking-api` and `security-practice` already use — so the descriptor travels with the package if it extracts to its own repo. Siblings join the System as they appear.

What retired is the **`hub` type**, not the entity. The entity earned its place by anchoring docs; only its shape was wrong.

Two constraints fell out of implementing this and are load-bearing for anyone extending it:

- **A page theme key is a `spec.type`, never a kind.** `EntityLayout` resolves `entity?.spec?.type?.toString() ?? 'home'` and never consults the kind, so a theme registered as `system` or `domain` is dead config that looks correct. `Domain` and `System` both accept an optional `spec.type`; ours carry `community` and `instance` for exactly this reason.
- **Ownership stays with a team, not a guild.** Guilds steward practices and aspects; teams own software. Handing a Component to a guild would contradict the split ADR 0009 and 0010 exist to draw.

### Consequences

- Good: the hierarchy generalizes. Any Backstage instance adopting this model is a System of cornerstones and repeats the shape with its own — `instance` is a reusable noun, not a local label.
- Good: the real software now sits beside the Ravenline fiction rather than inside it. `leidangr` left the fictional `rl-platform` System, so the demo seed and the instance cataloguing itself stop being tangled.
- The root `catalog-info.yaml` location must allow `Domain` and `System`. Catalog **locations** hot-reload in dev but the **rules enforcer is built once at startup**, so a rule change needs a backend restart or entities are rejected as "not of an allowed kind".
- Adds two `spec.type` values (`instance`, `community`) and one for cornerstones (`plugin`) to an already open vocabulary. `business-unit` was added for Ravenline and deliberately left unthemed.
- Does **not** resolve the eventual plugin-package question: when cornerstones extract to a shared package, that package becomes the System and these Components move with it. The village name for it stays parked.

See the resolution note in [`../plans/2026-07-20-gildi-guildhall-hub-plan.md`](../plans/2026-07-20-gildi-guildhall-hub-plan.md), and ADR [0012](0012-entity-page-composition.md) for how these entities are rendered.
