# Gildi — Guild entity-page layout (design)

**Date:** 2026-07-27
**Status:** Design approved (in-session), plan pending
**Arc:** leidangr-guildhall (revises slice 6)
**Supersedes the composition choice of:** `2026-07-24-gildi-guild-entity-decoration-design.md`
(the cards it shipped are reused; only how they are placed changes).
**Research backing:** `.superpowers/sdd/research-entity-layout.md` (cited APIs).

## 1. Why

Slice 6 attached the guild cards to the *default* Group overview as
`EntityCardBlueprint` extensions. Manual acceptance (2026-07-26) showed the
result reads as "default page + appended cards": the entity graph leads, Charter
lands after members/ownership, and there is no right rail. The new frontend
system has **no per-card `order` field** and per-card config is **global to all
Groups**, so the ordering cannot be fixed by tweaking the appended cards. The
idiomatic fix is a **guild-only custom overview layout** that we hand-compose.

## 2. Mechanism (research-confirmed)

`entity-content:catalog/overview` exposes a `layouts` extension input consumed by
`EntityContentLayoutBlueprint`. At render it picks the first layout whose entity
`filter` matches, else falls back to the stock `DefaultEntityContentLayout`. So
a layout filtered to `{ kind: 'group', 'spec.type': 'guild' }` applies **only** to
guilds; every other Group (and every other kind) is untouched. The blueprint's
`attachTo` is baked in — no manual wiring.

Inside the layout component, the generic `props.cards` array carries no stable
per-card identity, so for deterministic placement we **import the stock card
components directly** (all public, non-alpha exports) and compose the grid
ourselves.

## 3. The card model (consolidated)

Three cards → two of ours, plus stock cards doing their normal jobs. **The Roster
card is deleted**: practices and the aspect Template are `spec.owner: <guild>`, so
the stock **Ownership** card already enumerates them (verified in the seed:
`apply-security-aspect` is `type: aspect`, `owner: group:default/security-gildi`).

- **Charter** (ours) — the human-readable identity: crest · title · charter prose
  · a "Stewards: <aspect>" highlight chip. **Its links section is removed** —
  links move to the stock Links card in the rail (see §4).
- **Chronicle** (ours) — recent sagas + drives. Unchanged.
- **Group Profile** (`GroupProfileCard`, `@backstage/plugin-org`) — the familiar
  "Security guild" entity-data card. Kept on the right, where it already sits.
- **Links** (`EntityLinksCard`, `@backstage/plugin-catalog`) — the curated
  `metadata.links` (security standard, adoption, charter, on-call). Right rail.
- **Ownership** / **Members** (`OwnershipCard` / `MembersListCard`,
  `@backstage/plugin-org`) — stock, main column.
- **Entity graph** (`EntityCatalogGraphCard`, `@backstage/plugin-catalog-graph`)
  — kept but demoted to the bottom of the main column.

*Charter vs Group Profile is not real duplication:* Group Profile is structured
entity data; Charter is human-friendly prose. Both earn their place.

## 4. Layout

```text
Guild overview  (ONLY kind:Group spec.type:guild — other Groups keep the default)
┌── main column (2fr) ────────────┐   ┌── right rail (1fr, sticky) ─┐
│ Charter        (ours)           │   │ Group Profile  "Security …" │
│   crest · title · prose         │   │   (GroupProfileCard)        │
│   Stewards: [security aspect]   │   ├─────────────────────────────┤
├─────────────────────────────────┤   │ Links  (EntityLinksCard)    │
│ Ownership      (OwnershipCard)  │   │   standard · adoption · …    │
├─────────────────────────────────┤   ├─────────────────────────────┤
│ Members        (MembersListCard)│   │ Chronicle       (ours)      │
├─────────────────────────────────┤   │   recent sagas · drives     │
│ Entity graph   (demoted)        │   └─────────────────────────────┘
└─────────────────────────────────┘
```

CSS grid: `main` 2fr / `rail` 1fr on `md+`, single column stacked below `md`
(rail after main), mirroring the stock layout's responsive behaviour.

## 5. Code shape (all in `plugins/gildi`)

- **New** `entity/GuildOverviewLayout.tsx` — the layout component (imports the
  stock cards + our Charter/Chronicle; renders the two-zone grid).
- **New** the `EntityContentLayoutBlueprint.make({ filter, loader })` extension
  (in `entity/index.tsx`), replacing the three `EntityCardBlueprint` extensions.
- **Edit** `GuildCharterCard.tsx` — drop the links block (keep crest/prose/stewards).
- **Edit** `plugin.tsx` — register `guildOverviewLayout` instead of the 3 cards.
- **Edit** `plugin.test.tsx` — assert the layout extension registers.
- **Delete** `GuildRosterCard.tsx`, `useGuildRoster.ts`, `GuildRosterCard.test.tsx`.
- **Edit** `plugins/gildi/package.json` — add deps `@backstage/plugin-org`,
  `@backstage/plugin-catalog`, `@backstage/plugin-catalog-graph`; regenerate
  `yarn.lock`.

The multi-guild saga fix, crest module, `useSagas`/`useDrives`, and the seed are
unchanged. `GuildChronicleCard` and `GuildCharterCard` (minus links) carry over.

## 6. Testing

- Keep the Charter and Chronicle card unit tests (Charter test drops the link
  assertion).
- New unit test for `GuildOverviewLayout`: render it inside a guild
  `EntityProvider` + `TestApiProvider` (mocked `catalogApi`) and assert our
  Charter and Chronicle content appears and the stock cards mount without error.
  (The stock cards' own internals are Backstage's to test; we assert composition,
  not their content.)
- Gate: `ws test leidangr` + `ws lint leidangr` green; `make deps` clean.
- **Manual acceptance** (human-gated): reload the guild page, confirm the two-zone
  layout, Charter-leads, graph-demoted, rail = Group Profile · Links · Chronicle;
  confirm a non-guild Group still shows the default layout.

## 7. Risks / notes

- **Coupling:** gildi now depends on `plugin-org` / `plugin-catalog` /
  `plugin-catalog-graph`. Acceptable — a composed page needs the stock cards; the
  app already installs them (`packages: all`).
- **Third-party cards:** hand-composing means a future third-party plugin's
  guild-relevant overview card would NOT auto-appear (we only render what we
  import). Acceptable for a bespoke page; revisit if it matters.
- **No global config touched:** we do not `disabled`/reorder any stock
  `entity-card:*` via `app.extensions` — that would hit every Group. All guild
  specificity lives in the filtered layout.
