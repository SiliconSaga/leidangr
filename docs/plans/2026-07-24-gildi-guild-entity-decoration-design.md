# Gildi — Guild entity-page decoration (design)

**Date:** 2026-07-24
**Status:** Superseded — the appended-cards *composition* below was replaced by a guild-only layout in [`2026-07-27-gildi-guild-page-layout-design.md`](2026-07-27-gildi-guild-page-layout-design.md); the card *content* defined here shipped in PR #13.
**Arc:** leidangr-guildhall (slice 6 of the guildhall-hub design)
**Predecessors:** `2026-07-20-gildi-guildhall-hub-design.md` (§6 annotation-driven
decoration, §12 slice 6), `2026-07-21-gildi-crest-and-guilds-plan.md`,
`2026-07-21-gildi-full-page-shell-plan.md` (shipped in PR #12).

## 1. Scope

Decorate the **guild** entity page — a `Group` with `spec.type: guild` — with
curated, designed cards, realising the hub design's promise that *"the richer
guild detail lives on the entity page; the hub's guild card is the compact
glimpse that links in"* (§6).

This slice does **one kind, deeply**. Practice, aspect, and component
decoration are deliberately deferred to their own follow-up slices, as are the
tier-ladder and earned-badge visuals (which depend on the aspect/component
slices), referenced-markdown charter previews, and the unrelated post-#12
polish items.

## 2. Composition

Three focused `EntityCardBlueprint` cards attach to the Group Overview, each
gated `kind:Group spec.type:guild`, so they mount only on guild pages and leave
every other `Group` untouched:

```text
Group Overview
┌─ Charter ──────────┐  ┌─ About (Backstage default) ┐
│ [crest]  title     │  │ members, ownership, links   │
│ charter prose      │  └─────────────────────────────┘
│ stewards · links   │
└────────────────────┘
┌─ Roster ───────────┐  ┌─ Chronicle ────────────────┐
│ practices (chips)  │  │ recent sagas (previews)     │
│ aspects (chips)    │  │ + drives                    │
└────────────────────┘  └─────────────────────────────┘
```

Three cards (rather than one composite) keeps each unit single-purpose and
independently testable, matches the shared card-family ethos, and lets the
zones reorder later. Backstage's default Group cards (About, Members,
Ownership) remain — this decoration is additive.

## 3. Where the code lives

All new code sits in `plugins/gildi` — gildi owns its own decoration, keeping
the extraction-ready `@siliconsaga/plugin-gildi` package cohesive. (The `cycle`
card lives in `packages/app` only because `Cycle` is an ecosystem kind gildi
does not own; guilds are gildi's domain.)

```text
plugins/gildi/src/
  entity/
    GuildCharterCard.tsx     # identity: crest, title, charter prose, stewards, links
    GuildRosterCard.tsx      # practices + aspects chips
    GuildChronicleCard.tsx   # recent sagas + drives
    useGuildRoster.ts        # guild-scoped practices + aspects
    index.ts                 # the three EntityCardBlueprint.make(...) extensions
  guilds/
    roster.ts                # NEW: pure helpers extracted from useGuilds
    useGuilds.ts             # MODIFIED: consume roster.ts (no behaviour change)
  chronicle/useSagas.ts      # MODIFIED: optional { guild } scope
  drives/useDrives.ts        # MODIFIED: optional { guild, includeEnded } scope
  plugin.tsx                 # MODIFIED: register the three new extensions
```

Registration:

```ts
extensions: [guildHallPage, guildCharterCard, guildRosterCard, guildChronicleCard]
```

## 4. Data flow

The plugin mints nothing — everything is read from the catalog via typed
search or from the guild entity itself.

**Charter card** — pure `useEntity()`, no query:
- **Crest** — `<Crest seed={metadata.name} .../>`, reusing the crest module
  (already honours the `siliconsaga.org/arms` override in `blazon`).
- **Charter prose** — `siliconsaga.org/charter` annotation if present (a longer
  inline blurb), else `metadata.description`. Inline-only this slice.
- **Stewards** — `siliconsaga.org/stewards` (`aspect:security, …`) parsed to
  aspect chips linking to the aspect entities.
- **Featured links** — native `metadata.links` (`[{ url, title, icon }]`)
  rendered as a titled link list.

**Roster card** — `useGuildRoster(entityRef)`:
- **Practices** — `getEntities({ kind:Component, spec.type:practice,
  spec.owner:<guildRef> })` → chips linking to each practice.
- **Aspects** — the guild's steward aspects ∪ each practice's
  `siliconsaga.org/aspect`, de-duped → chips.

**Chronicle card** — reuses the hub hooks, guild-scoped:
- **Sagas** — `useSagas({ guild })`: keep those whose `spec.touches[]` resolve
  to this guild (client-side, since `touches` is an array), newest-first, cap
  ~5, rendered with the existing `SagaCard`.
- **Drives** — `useDrives({ guild, includeEnded: true })`: `spec.owner` filter
  for this guild, recency-sorted. The guild page shows recent *and* ended
  drives, so `includeEnded` bypasses the hub's active-only default (the hub
  keeps active-only). Rendered with the existing `DriveCard`.

**Shared, not duplicated.** The practices-by-owner indexing and steward-aspect
parsing currently inlined in `useGuilds` move into pure helpers in
`guilds/roster.ts`, consumed by both the hub `GuildsSection` (all guilds) and
`useGuildRoster` (one guild). Query logic stays single-sourced. The
`useSagas`/`useDrives` changes are additive optional parameters — the hub call
sites are unaffected.

## 5. Presentation

Reuse the shipped card family verbatim: `InfoCard` per card, `Crest`, `Chip`
(outlined), `EntityRefLink`, and the existing `SagaCard`/`DriveCard`. Every
card renders a **section heading in all states** with a gentle empty message
("No practices yet", etc.) rather than a blank card — the lesson from the PR
#12 round-2 review. React keys derive from entity refs, not display names (the
same review lesson). Malformed refs fall back to a placeholder via the repo's
`safeRef` try/catch convention, never breaking a card render.

## 6. Seed

Enrich one guild — `security-gildi` in `examples/mock-org/org.yaml` — so the
page demonstrably fills: add a `siliconsaga.org/charter` blurb and
`metadata.links`, and confirm it already carries `siliconsaga.org/stewards`, an
owned practice, a touching saga, and an owned drive (the hub seed largely
covers these). This keeps the human visual smoke meaningful.

## 7. Testing

- **Unit test per card** — `TestApiProvider` + a mocked `catalogApi` +
  `EntityProvider` with a seed guild, mirroring `GuildsSection.test.tsx`:
  - Charter: crest present, charter prose shown, steward chips, featured links.
  - Roster: practice + aspect chips resolve; empty state shows the heading.
  - Chronicle: sagas and drives list; empty state shows the heading.
- **Gate** — `ws test leidangr` (`make test test-app`) and `ws lint leidangr`
  (`make lint tsc`) green before PR.
- **Visual smoke** — human-gated: load a guild page and eyeball the three
  cards. The session pauses for this rather than self-certifying.

## 8. Out of scope / deferred

- Referenced-markdown charter and front-matter preview cards (next slice, once
  the inline surface is proven).
- Practice, aspect, and component entity-page decoration (own slices).
- Tier-ladder and earned-badge rendering (depend on the aspect/component
  slices and on trial/adoption data that does not exist yet).
- The unrelated post-#12 polish backlog (tag-chip colours, skald avatars,
  crest metal-field divisions), tracked separately.

## 9. Risks

- **Client-side saga filtering** re-queries all sagas per guild page. Fine at
  seed scale and consistent with how the hub already queries; revisit only if
  the catalog grows large.
- **`includeEnded` drift** — the guild chronicle and the hub drives band now
  select drives differently. The shared query stays one function with an
  explicit option, so the divergence is visible, not hidden.
