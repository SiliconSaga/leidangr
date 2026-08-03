# Practice Page + Type Themes Implementation Plan

> Executed inline. Design: `2026-08-01-gildi-practice-page-and-type-themes-design.md`. Theme recipe (exact code): `.superpowers/sdd/research-theme-registration.md`.

**Goal:** Regal-purple page themes for `practice`/`aspect` entity types, and a designed practice entity page (mirroring the guild layout).

## Global Constraints

- Branch `feat/practice-aspect-decoration`. All plugin code in `plugins/gildi/`; theme composition in `packages/app`.
- Allowlist-friendly commands: `git -C components/leidangr …` for read-only git, Grep/Glob tools for search, `ws test`/`ws lint` for gating, `ws commit … .commits/<name>.md` for commits (no semicolons in bodies).
- Reuse the shipped card family + the guild layout pattern (`EntityContentLayoutBlueprint`, hand-composed two-zone grid, stubbed stock cards in tests).

---

### Task 1: Type page themes (gildi exports, app composes)

**Files:** Create `plugins/gildi/src/theme/pageThemes.ts`; modify `plugins/gildi/src/index.ts`, `plugins/gildi/package.json`; create `packages/app/src/modules/theme/index.tsx`; modify `packages/app/src/App.tsx`, `packages/app/package.json`; regenerate `yarn.lock`.

- [ ] **gildi pageThemes** — `pageThemes.ts` exports `guildhallPageThemes: Record<string, PageTheme>` with custom purple hexes (NOT the research's example colorVariants):
  ```ts
  import { genPageTheme, shapes, type PageTheme } from '@backstage/theme';
  export const guildhallPageThemes: Record<string, PageTheme> = {
    practice: genPageTheme({ colors: ['#4527A0', '#5E35B1'], shape: shapes.round }),
    aspect: genPageTheme({ colors: ['#7E57C2', '#9575CD'], shape: shapes.wave2 }),
  };
  ```
  Re-export from `plugins/gildi/src/index.ts`: `export { guildhallPageThemes } from './theme/pageThemes';` (keep the existing default export).
- [ ] **app theme module** — copy `packages/app/src/modules/theme/index.tsx` from the recipe §(b): light+dark `ThemeBlueprint.make({ name: 'light'|'dark' })` (matching built-in names → REPLACES defaults), `createUnifiedTheme({ palette: palettes.light|dark, pageTheme: { ...defaultPageTheme, ...guildhallPageThemes } })`, `Provider` wrapping `UnifiedThemeProvider`.
- [ ] **wire** `themeModule` into `App.tsx` `features`.
- [ ] **deps** — add `"@backstage/theme": "^0.7.3"` to `plugins/gildi/package.json` AND `packages/app/package.json`; `ws exec leidangr corepack yarn install`; confirm `ws exec leidangr make deps`.
- [ ] **test** — `plugins/gildi/src/theme/pageThemes.test.ts`: assert `guildhallPageThemes` has `practice` and `aspect` keys, each a `PageTheme` with a non-empty `backgroundImage` and white-ish `fontColor`.
- [ ] Focused test + commit (`chore/feat(gildi): purple page themes for practice/aspect types`).

### Task 2: Practice entity page

**Files:** Create `plugins/gildi/src/entity/PracticeCard.tsx`, `useAdopters.ts`, `AdoptersCard.tsx`, `PracticeOverviewLayout.tsx` (+ tests); modify `plugins/gildi/src/entity/index.tsx`, `plugins/gildi/src/plugin.tsx`, `plugin.test.tsx`.

- [ ] **PracticeCard** (`useEntity()`) — `InfoCard title="Practice"`: title, description, a **Maintains** chip from `siliconsaga.org/aspect` (outlined label), and a **Run by** line: `Crest` seeded by the owner group name (parse `spec.owner`) + `EntityRefLink` to the guild. safeRef try/catch.
- [ ] **useAdopters(aspectId)** — `getEntities({ filter: { kind: 'Component' } })`, keep items whose `siliconsaga.org/aspects` (comma-split, trimmed) includes `aspectId`; map to `{ name, title, entityRef, version }` where version parses `siliconsaga.org/aspect-versions` for `"<aspectId>@<v>"`. Returns `{ adopters, loading, error }`.
- [ ] **AdoptersCard** — `InfoCard title="Adopters"`: list adopters (EntityRefLink + version chip), heading + empty message in all states, loading/error via `Progress`/`ResponseErrorPanel`. Keys via entityRef.
- [ ] **PracticeOverviewLayout** — `EntityContentLayoutProps`; two-zone grid (flex columns, gap 24, testids `practice-overview-main`/`-rail`): main = PracticeCard → AdoptersCard → `EntityCatalogGraphCard` (height 400, demoted); rail = `EntityAboutCard` (from `@backstage/plugin-catalog` — shown for Components) → `EntityLinksCard`.
- [ ] **register** — `entity/index.tsx`: add `practiceOverviewLayout = EntityContentLayoutBlueprint.make({ name: 'practice-overview', params: { filter: { kind: 'component', 'spec.type': 'practice' }, loader } })`. `plugin.tsx`: add to `extensions`.
- [ ] **tests** — PracticeCard (crest + maintains + run-by), AdoptersCard (adopter + version + empty), PracticeOverviewLayout (zones, stock cards stubbed), plugin.test (assert `entity-content-layout:gildi/practice-overview` via getExtension).
- [ ] Gate `ws test leidangr` + `ws lint leidangr`; commit.

### Task 3: Manual acceptance + PR

- [ ] Human-gated: `make dev`; eyeball the purple `practice`/`aspect` Ownership tiles on the guild page + the practice/aspect page headers; the practice page (Practice card w/ guild crest, Adopters, About/Links rail, demoted graph, Docs tab vísar). Confirm a non-practice Component still uses the stock layout.
- [ ] `ws cr` from a `.crs/` bodyfile.

## Self-Review

Design coverage: theme split (Task 1) ✓; practice page cards + layout (Task 2) ✓; aspect left undecorated (no task) ✓; TechDocs already wired (noted, no work) ✓; testing + acceptance (Task 2/3) ✓. No placeholders — the one deferred verification (EntityAboutCard shows for Components) is confirmed by the earlier research (`entity-card:catalog/about` filter excludes only user/group).
