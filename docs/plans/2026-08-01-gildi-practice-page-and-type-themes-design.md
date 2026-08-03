# Gildi — Practice entity page + practice/aspect page themes (design)

**Date:** 2026-08-01
**Status:** Design approved (in-session), plan pending
**Arc:** leidangr-guildhall (follows the guild entity-page layout, PR #13)
**Predecessors:** `2026-07-27-gildi-guild-page-layout-design.md` (the layout pattern this reuses).

## 1. Scope

Two related pieces, one branch:

1. **Type page themes** — give the `practice` and `aspect` entity types their own
   colours (a regal-purple family) instead of both falling back to the default
   green Ownership tile / page header.
2. **Practice entity page** — a designed, guild-style overview for the
   `Component`/`spec.type: practice` entity (the visible "institution" home).

The **aspect** is deliberately left undecorated: it is not a rich catalog entity
(the module lives in a repo), its only catalog face is the adoption `Template`
(`spec.type: aspect`) whose entity page is rarely visited — its job is the card
on the Create page and the scaffolding flow. It keeps its general relationship
metadata and gets the purple header from the theme, nothing more.

## 2. Type page themes (part 1)

**Constraint (research-confirmed):** in the new frontend system a "theme" is a
whole `AppTheme`, and `ThemeBlueprint` is limited to the **app plugin** — a
plugin cannot ship a theme or inject page themes. Page themes only exist inside
a complete theme. So the plugin cannot own the theme, only the *definitions*.

**Split — plugin defines, app composes:**

- **gildi exports the definitions.** `plugins/gildi/src/theme/pageThemes.ts`
  exports `guildhallPageThemes: Record<string, PageTheme>` built with
  `genPageTheme` — `practice` (deep regal purple) and `aspect` (lighter violet),
  differing in **lightness** (not just hue) for at-a-glance and colour-vision
  distinction, white tile/heading text on both. The purple preference thus ships
  with the extraction-ready package.
- **The app composes them.** `packages/app` registers a custom light + dark
  theme (the only place that legally can) that reproduces the default palettes
  and sets `pageTheme: { ...defaultPageTheme, ...guildhallPageThemes }`. The
  custom themes **replace** the built-in light/dark, so the user still sees just
  "Light"/"Dark" — only the `practice`/`aspect` colours change.

`theme.getPageTheme({ themeId })` keys on `spec.type`, so this also tints the
practice and aspect **entity-page headers** purple (a bonus — reinforces the
domain), and colours the practice/aspect **Ownership tiles** on the guild page.

Exact shades and the shape/gradient are finalised at implementation and eyeballed
by the human. Starting point: practice `#4527A0 → #5E35B1`, aspect
`#7E57C2 → #9575CD`, distinct burst shapes.

## 3. Practice entity page (part 2)

The `security-practice` Component already carries everything the page needs
(no seed change required): `spec.type: practice`, `spec.owner: security-gildi`,
`siliconsaga.org/aspect: 'security'`, `backstage.io/techdocs-ref: dir:.`
(TechDocs — the vísar — already render in the **Docs tab** automatically), and
rich curated `links` (standard, paved-road pipelines, both adoption doors).

A custom overview layout via `EntityContentLayoutBlueprint`, filtered to
`{ kind: 'component', 'spec.type': 'practice' }` — same mechanism and hand-composed
two-zone grid as the guild layout, so only practice pages are affected and every
other Component falls through to the stock layout.

```text
Practice overview  (kind:Component spec.type:practice)
┌── main column (2fr) ───────────────┐   ┌── right rail (1fr) ────┐
│ Practice  (ours)                   │   │ About  (stock)         │
│   title · description              │   ├────────────────────────┤
│   Maintains: [security aspect]     │   │ Links  (standard ·     │
│   Run by: [crest] Security guild → │   │   paved road · doors)  │
├────────────────────────────────────┤   └────────────────────────┘
│ Adopters  (ours)                   │
│   components enrolled in the aspect │
│   + version (security@1.4 …)        │
├────────────────────────────────────┤
│ Entity graph  (demoted)            │
└────────────────────────────────────┘
   Docs tab → vísar (TechDocs, automatic via techdocs-ref)
```

### Cards

- **Practice card** (ours) — `useEntity()`: title, description, a
  **"Maintains: <aspect>"** chip (from `siliconsaga.org/aspect`, a label like the
  guild steward chips — the clickable adoption door is in the Links card), and a
  **"Run by: <gildi>"** line rendering the gildi's **crest** (reuse `Crest`
  seeded by `spec.owner`'s group name) linked to the guild — visually tying the
  practice to the guild that runs it.
- **Adopters card** (ours) — `useAdopters(aspectId)`: query
  `getEntities({ kind: 'Component' })` and keep those whose
  `siliconsaga.org/aspects` (comma-separated) includes the practice's aspect id,
  each shown with its `siliconsaga.org/aspect-versions` (parse `security@1.4`).
  Headings + empty state in all states. The one genuinely new query.
- **Stock**: `EntityAboutCard`? No — About is excluded for Groups but present for
  Components; use the stock about/links via the same imports as the guild layout
  (`EntityLinksCard`, and the Component's about card / relations), plus
  `EntityCatalogGraphCard` demoted. Confirm the Component about card export at
  implementation.

## 4. Where the code lives

- `plugins/gildi/src/theme/pageThemes.ts` — `guildhallPageThemes` export (+ `@backstage/theme` dep on gildi).
- `packages/app/src/modules/theme/index.tsx` — the custom light+dark theme module composing the page themes, registered via the app's `ThemeBlueprint` module (wired into `App.tsx` `features`).
- `plugins/gildi/src/entity/PracticeCard.tsx`, `AdoptersCard.tsx`, `useAdopters.ts`, `PracticeOverviewLayout.tsx` — the practice page.
- `plugins/gildi/src/entity/index.tsx` — add the `practiceOverviewLayout` `EntityContentLayoutBlueprint` extension alongside `guildOverviewLayout`.
- `plugins/gildi/src/plugin.tsx` — register it.

## 5. Testing

- Unit tests: `PracticeCard` (crest + maintains chip + run-by), `AdoptersCard`
  (enrolled components + versions, empty state), `PracticeOverviewLayout`
  (composition + zones, stock cards stubbed) — mirroring the guild card/layout
  tests. Theme: a small test that `guildhallPageThemes` has `practice`/`aspect`
  entries, and that the composed app theme returns them from `getPageTheme`.
- Gate: `ws test leidangr` + `ws lint leidangr`; `make deps` clean.
- Human visual acceptance: the purple practice/aspect Ownership tiles + page
  headers, and the practice page (cards, crest, adopters, Docs tab vísar).

## 6. Out of scope / notes

- Aspect Template entity-page decoration (intentionally none — see §1).
- Trial/tier badges on adopters (bronze/silver/gold is demo narrative, not
  implemented) — the Adopters card shows enrolled components + version only.
- Component entity-page adoption decoration (an "aspects adopted" card on the
  component) — a possible future slice, deferred.
