# Leiðangr — the Guild Hall hub (`gildi` plugin) — Design

**Date:** 2026-07-20
**Status:** Draft
**Scope:** The first custom **frontend plugin** for this Backstage instance: `gildi`, which renders the **Guild Hall** — a designed, curated overview page for the practice layer (guilds, their practices and aspects, drives, and sagas), plus entity-page decoration for those kinds. First deliberate departure from vanilla Backstage, done idiomatically on the new frontend system. Presentation quality is a first-class goal.
**Related:** `2026-07-10-guilds-skills-standards-design.md` (the Guildhall model — practices, aspects, guilds, standards, adoption, vísar), ADRs 0007 (`Cycle`), 0008 (`Saga`), 0009/0010 (practice model, aspect-as-module, adoption's two doors), `docs/guildhall-model.md` (entity relationships), `examples/mock-org/` (the Ravenline running example this page is designed against).

---

## 1. What this is, and why now

The Guildhall model shipped as catalog data and docs; nothing yet *renders* it as a designed experience. Browsing the raw catalog — filtered tables of Groups/Components/Templates — is exactly the "drab spreadsheet" this is meant to replace. The `guild-hall` entity (`spec.type: hub`) was seeded as a placeholder anticipating this page. This design turns that anticipation into a real plugin: a **hub page** that introduces the practice layer at a glance, and a **card system** reused on entity pages when you drill in. The bar is *great presentation* — curated, human-readable cards, never a metadata dump — even at the cost of a few days' work.

Two framing decisions set by this design:

- The Guild Hall is **presentation, not a domain noun**. It is a plugin-contributed page, not a catalog entity. The seeded `guild-hall` `type: hub` Component **retires** (it was a placeholder for exactly this). This resolves the long-standing "a hub isn't a Kind" tension: custom Kinds stay reserved for domain nouns (`Cycle`/`Saga`); a hub is a rendered surface.
- The plugin is `gildi`; the page's display name is **"Guild Hall"**; in ordinary prose we say **"guild"**. (Old Norse flavour can skin terms later via the kennings layer.)

## 2. Architecture and housing

**Target the new frontend system.** This repo is on Backstage 1.52 with the new frontend system as default (`@backstage/frontend-defaults`, Blueprints, app modules) — no legacy `App.tsx` route tree. `gildi` is built with `createFrontendPlugin` (from `@backstage/frontend-plugin-api`), default-exported from `src/index.ts`, and composed via extensions from Blueprints:

- **`PageBlueprint`** — the Guild Hall page, mounted at `/guild-hall` (route ref in `src/routes.ts`).
- **`NavItemBlueprint`** — a "Guild Hall" sidebar entry (see §9 on the eventual "Hubs" group).
- **`EntityCardBlueprint`** — the entity-page decoration cards (guild / practice / aspect), mirroring the existing `packages/app/src/modules/cycle/` card as the in-repo pattern.
- **`ApiBlueprint`** (`createApiRef` + `useApi`) — shared read/query logic and the crest generator (§5).

Data comes exclusively through **typed catalog search** — `catalogApiRef.getEntities` with kind/type/annotation filters. This plugin introduces the first frontend catalog-querying in the repo; `@backstage/plugin-catalog-react` is already a dependency.

**Housing: `plugins/gildi`, a real workspace package, extraction-ready.** Root `package.json` already globs `plugins/*`. We build `gildi` as a distributable package from day one — scoped package name `@siliconsaga/plugin-gildi` (introducing the `@siliconsaga` npm scope), plugin id `gildi`, instance `gildiPlugin`; depends only on public plugin APIs; imports no app-private code. leidangr remains the community/hobby *instance* (app shell + config + mock-org seed); when a second consumer appears (e.g. a corporate port) the package lifts into its own plugin-distribution repo — a relocation, not a rewrite. We do **not** create `gildi-common` or `gildi-backend` yet (YAGNI); shared constants (annotation keys, `spec.type` values) live in a single `constants.ts` until a second package needs them.

**`Cycle` and `Saga` stay ecosystem-level kinds.** They live where they are (`packages/backend/src/modules/{cycle,saga}`), not inside `gildi`. Per the Guildhall decomposition, drives/sagas belong to the Chronicle context; the Guild Hall *queries* them (occurrences-queried-not-minted), it does not own them. Coupling them into `gildi` would make the kinds vanish if the hub weren't installed and would force a future Chronicle hub to depend on `gildi`.

## 3. The page: five sections, swappable zones

A single designed overview (not a rearrangeable widget grid), composed of five sections:

1. **Intro** — a short "what the Guild Hall is" header. Room reserved for a derived graphic later.
2. **Active & upcoming drives** — a **bounded band** directly under the intro. Drives are `Cycle`s of a campaign type (default `drive`); they are inherently few (a drive with dozens of members isn't a drive), so this band never grows the page.
3. **Guilds** — the **wide primary column**, the growing list, flowing down the page as guilds are added.
4. **Chronicle** — a **rail** showing the *recent* few sagas as preview cards with a "View all sagas →"; the full, ever-growing chronicle lives on its own screen/tab later.
5. **Actions** — at the top of the rail: curated scaffolder-backed action cards (§10).

**Swappable wide/rail zones.** Guilds and chronicle are the two growing lists; which occupies the *wide* column vs the *rail* is the natural knob. Default ships **guilds-wide** (the priority content). Because sections are config-driven (§9), an instance where the story stream matters more can flip to chronicle-wide with no rebuild. Design the two zones as swappable from the start. (Making the swap end-user-configurable is a further future extension — out of scope now.)

**Fission-ready.** Each section is a future tab (or its own hub) under the meta-principle "a hub earns separate existence when it gains its own audience and its own editor actions." Keep the plugin's internal modules along these seams so sections → tabs → separate hubs is cheap later. Guild docs, if any, ride the entity's normal TechDocs tab — not a bespoke section.

## 4. The card system

Everything on the page and its entity pages shares one visual language so it reads as a single system — the antidote to filtered-catalog drabness. Every card carries: a **type tag**, a **name**, a **one-line description**, and a shared vocabulary of **chips** (practice / aspect), **avatars** (people), **crests** (guilds), progress bars, and tier badges. Whole cards link to their entity page.

**The identity-mark rule (one rule, applied everywhere):** each card leads with an identity mark —

- a **guild crest** when a guild is the card's actor / steward / subject (guild, practice, drive, and a saga that involves a guild all lead with the relevant guild's crest);
- a **person's avatar** when the card is person-led (a personal saga leads with its skald's avatar);
- a **scaffolder glyph** for action cards.

Card-specific elements ride alongside the identity mark (a drive's progress bar, an aspect's tier ladder) — that variety is welcome; only the *leading mark* is invariant.

**The family:** guild, practice, aspect, component (adopter), drive, saga preview, action. Practice/aspect cards double as the entity-page decoration cards when you drill in. Curated content only — clean display names and a brief description, never raw metadata; an entity search may appear as a styled widget but never as the primary surface.

## 5. Generated heraldic crests

Each guild gets a **generated coat of arms** — GitHub-identicon energy, but a real heraldic device — giving every guild an instant, memorable identity (you recognise a guild by its arms before reading the name), and a brand-new guild has a device the moment it exists.

- **Deterministic from the guild id.** Hash the id → pick a field division (plain / per pale / per fess / per bend / quarterly), two tinctures from the heraldic palette (respecting the rule of tincture — colour-on-metal / metal-on-colour), and a charge (key, chevron, mullet, roundel, cross, lion, …). Render as **inline SVG** — no art assets, no external calls.
- **Deliberately simple.** Recognizability over ornament; over-complex arms lose the at-a-glance identicon quality. Keep charges bold and few.
- **Escape hatches.** An annotation (e.g. `siliconsaga.org/arms`) overrides with a hand-picked blazon or image; a plain **monogram** is the fallback if generation is disabled.
- **Self-contained module.** Isolated enough to be its own small piece so other hubs (a future people hub, etc.) reuse it. Applies to any `Group`, so teams could carry arms too if ever wanted.

## 6. Annotation-driven decoration (cross-kind)

A general mechanism, not guild-only: sections/cards populate their content from **catalog annotations**, so authors enrich pages by editing catalog YAML — the same pattern Cervator used on a team home page previously. Applies across kinds (guild, practice, aspect, saga, cycle).

- **Prose, two grades (start inline, grow to referenced):** a short blurb lives in `metadata.description` (or a custom annotation); a richer body is a **referenced markdown doc** the card fetches and renders — reusing the existing `siliconsaga.org/saga-doc` convention. Ships inline-first; referenced markdown lands as conventions mature.
- **Front-matter preview cards.** A referenced markdown (a saga, a guild charter) carries front-matter (title, summary, author/skald, date, optional hero); the card renders a **preview** from the front-matter and links out to the full experience (TechDocs, or an external blog). This "preview card" shape is reused for sagas and for charter/mission bodies.
- **Guild entity-page decoration.** The guild's own page gets decorated from its catalog file: charter/mission prose, stewards (`siliconsaga.org/stewards`), featured links (native `metadata.links`), its practices + aspects (from relations/queries), and highlighted recent sagas/drives. The *richer* guild detail lives here, on the entity page — the hub's guild card is the compact glimpse that links in.

## 7. Data-model touchpoints and the guild-type rename

The plugin reads existing shapes via typed search — it mints nothing:

- **Guilds** = `Group` with **`spec.type: guild`** (queried `kind:group, spec.type:guild`). *Preliminary data change:* the seed currently types guild Groups as `gildi`; rename the **group type** `gildi` → `guild` across the seed (`org.yaml`), the smoke assertions, and doc references (a small sweep, sibling to the graft→adoption rename). "gildi" survives only as the plugin/package name; Old Norse group-type flavour can return later via kennings.
- **Practices** = `Component` `spec.type: practice` (owned by the stewarding guild).
- **Aspects** = **adoption** `Template`s (`spec.type: aspect`), which are ingested and queryable.
- **Drives** = `Cycle`s of a campaign type (default `drive`; the set is config-driven, §9).
- **Sagas** = `Saga` entities (front-matter body via `siliconsaga.org/saga-doc`).
- **Adopters/badges** = `Component`s carrying enrollment annotations (`siliconsaga.org/aspects`, `…/aspect-versions`, `…/adoption-record`).

## 8. The aspect ladder and the component badge

A modeling truth the card system must reflect: an **aspect does not have a badge**. It holds a **standard** with a **tier ladder** (bronze / silver / gold) — the rungs to climb. A **component** that adopts the aspect **earns** a tier by passing the standard's trials; the badge lives on the *component*, not the aspect. Aspect cards therefore show the *ladder*; component cards (and component entity pages) show the *earned badge*.

**Deferred — differentiating the ladder (noted, not needed for a while).** A bare bronze→silver→gold ladder looks identical on every aspect. When the data exists, distinguish aspects on their aspect card by either (or both): (a) the **count of trials/checks** required for each tier — available once trial evaluation is implemented; or (b) **adoption stats** — how many components have enrolled in the aspect and how many reached each tier. A knock-on: a guild card could roll up "its components at bronze/silver/gold" as a maturity glance. All of this is post-MVP; trial evaluation and adoption stats are not implemented today (bronze/silver in the seed is demo narrative).

## 9. Customization via extension config

The hub page's customization surface is **extension config** in `app-config.yaml` (the new frontend system's native per-extension config; the app already uses one to remount the catalog at `/`). Admins reconfigure structure with zero code:

- intro heading/blurb;
- which sections show and in what order (including the guilds↔chronicle wide/rail swap);
- which `Cycle` types count as "drives";
- how many chronicle previews and which tag sources actions.

**Deferred:** making the intro *content* author-editable from the catalog (rather than admin config) via a referenced markdown — added later once decoration conventions are proven on guild pages; not a reason to keep a hub entity. The sidebar's eventual **"Hubs" item group** (with "Guild Hall" the first entry) is anticipated but, until a second hub exists, "Guild Hall" can sit as a top-level nav item.

## 10. Actions — scaffolder links, tag-sourced

The Actions section is **links to Scaffolder Templates** (the idiomatic Backstage "Create" surface), not bespoke buttons — so "establish a new guild", "charter a practice", "start a drive" ride the same adoption/two-door machinery rather than being special-cased. The hub surfaces Templates **by a convention tag** (e.g. `guildhall`) — least coupling, composes with owner-based discovery later. Dogfooding falls out cleanly: **running a guild hall is itself a practice**, so the guild hall's operational scaffolders are the adoption templates of the guild hall's own practice. For v1 these are the existing mock adoption Templates plus a couple of new mock ones; a light `guildhall` practice + aspect can model the dogfood as a small flourish (not a blocker).

## 11. Mermaid via the TechDocs Addons framework

Adopt the community TechDocs **Addons** mermaid addon (`backstage-plugin-techdocs-addon-mermaid`) so existing ```` ```mermaid ```` fences (in root `docs/guildhall-model.md` and elsewhere) render client-side inside TechDocs' shadow DOM — the path already flagged in `mkdocs.yml` and the demo retro. This replaces the intentionally-removed `mkdocs-mermaid2` plugin (absent from the Docker generator image, shadow-DOM-blocked). Verify currency of the addon against the installed TechDocs version before wiring. This is small and self-contained; it can ride in the same effort or land as its own step.

## 12. Scope and phasing

Multi-day is acceptable; presentation is the priority. Rough order (each a shippable slice):

1. **Scaffold `plugins/gildi`** (new-frontend-system plugin, page route + sidebar item, empty page) + retire the `guild-hall` Component + the `gildi`→`guild` group-type seed rename.
2. **Crest module** (generated heraldic SVG from group id) — the visual keystone; unit-tested for determinism + tincture rules.
3. **Guilds section** — typed catalog query + the guild card (crest, description, stewards, practice/aspect chips), the wide growing column.
4. **Drives band + Chronicle rail** — drive cards (progress) and saga preview cards (front-matter), swappable zones.
5. **Actions** — tag-sourced scaffolder-link cards.
6. **Entity-page decoration** — guild page (annotation-driven charter/links/roster), practice & aspect cards (aspect shows the tier ladder; component shows the earned badge).
7. **Mermaid TechDocs addon** (independent; any time).

## 13. Out of scope / deferred / fast-follows

- **App home page** (`@backstage/plugin-home`) — moving the catalog off `/` to a real welcome/starred/toolkit home is a **separate sibling fast-follow**, not part of `gildi`; the hub shares its "gentle landing" ethos but is a distinct designed page.
- User-configurable wide/rail swap; `gildi-common`/`gildi-backend` packages; catalog-backed hub content; extraction to a standalone plugin repo (and the future naming of that workspace — *not* committing to "kaupang"); ladder differentiation (§8); trial evaluation / adoption execution (designed-not-implemented upstream).

## 14. Testing

- **Crest generator:** unit tests for determinism (same id → same arms) and rule-of-tincture adherence.
- **Cards/page:** `renderInTestApp` / `createExtensionTester` (from `@backstage/frontend-test-utils`, already a dev dep) with a mocked `catalogApi` returning seed-shaped entities; assert curated content renders (names, chips, identity marks) and empty states are graceful.
- **Seed:** extend `make smoke-catalog` for the `guild`-typed Group assertion (replacing the `gildi` type check); the full `make ci` gate (config-check + lint + tsc + tests) covers the plugin build.

## 15. Open questions

- Exact heraldic charge set and palette (kept small); whether teams (non-guild Groups) also get arms in v1 or later.
- The `guildhall` action tag's final spelling and whether the dogfood `guildhall` practice/aspect ships in v1 or is deferred.
- Whether the Mermaid addon rides this plugin's first PR or lands separately.
