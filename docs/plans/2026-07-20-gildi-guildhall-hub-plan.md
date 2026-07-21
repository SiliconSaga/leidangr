# Guild Hall hub (`gildi`) — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `gildi` plugin as a mounted, sidebar-linked (empty) Guild Hall page on the new frontend system, get Mermaid rendering in TechDocs, and rename the guild **group type** `gildi` → `guild` — the prerequisites every later slice builds on.

**Architecture:** A new workspace package `plugins/gildi` exposes a `createFrontendPlugin` default export with a `PageBlueprint` (route `/guild-hall`, whose `title`/`icon` also provide the sidebar entry — the standalone `NavItemBlueprint` was removed in frontend-plugin-api 0.17.0); the app registers it in `packages/app/src/App.tsx` `features`. Mermaid is wired via the TechDocs Addons framework. The seed's guild Groups switch `spec.type: gildi` → `guild`. No catalog querying or cards yet — that is Plan 2+.

**Tech Stack:** Backstage 1.52 (new frontend system), `@backstage/frontend-plugin-api@^0.17.2`, `@backstage/plugin-catalog-react@^3.1.0`, `@backstage/frontend-test-utils@^0.6.1`, TypeScript ~5.8, React 18, Yarn 4.13 (Corepack).

## Global Constraints

- Node **22 || 24**; Yarn **4.13** via Corepack (`corepack yarn …`). Never raw `npm`.
- **New frontend system only** — `createFrontendPlugin` + Blueprints; no legacy `createApp`/`FlatRoutes`/`EntityPage`.
- Package scope **`@siliconsaga`**; plugin id **`gildi`**; instance **`gildiPlugin`**; sidebar display **"Guild Hall"**; license field **UNLICENSED**.
- Guild Groups use **`spec.type: guild`** (never `gildi`); "gildi" survives only as the plugin/package name. Group *names* (`security-gildi`, `release-captains-gildi`) are unchanged in this plan.
- Run builds/tests through `ws`: `ws test leidangr` (= `make ci`), `ws exec leidangr make smoke-catalog`, `ws exec leidangr corepack yarn tsc`. Commit via `ws commit leidangr <bodyfile>`.
- Design source of truth: `docs/plans/2026-07-20-gildi-guildhall-hub-design.md`.
- Before writing Blueprint code, cross-check current signatures against the installed `@backstage/frontend-plugin-api@0.17.2` and the Backstage "Building Frontend Plugins" docs — the `tsc`/build gates below catch any drift.

---

### Task A: Rename guild group type `gildi` → `guild`

**Files:**
- Modify: `examples/mock-org/org.yaml` (the two guild Groups' `spec.type`)
- Modify: `scripts/smoke-catalog.sh` (the type assertion)
- Modify (label/type references only): `docs/guildhall-model.md`, `docs/demo-visir.md`, `examples/mock-org/README.md`, `docs/plans/2026-07-10-guilds-skills-standards-design.md`, `docs/adrs/0009-guildhall-practice-model.md`
- Test: `scripts/smoke-catalog.sh` (existing runtime proof)

**Interfaces:**
- Produces: guild Groups queryable as `kind:group, spec.type:guild` — the filter Plan 2's Guilds section relies on.

- [ ] **Step 1: Find every occurrence of the type, separating type-value from concept/name.**

Run: `rg -n "gildi" .` (via the Grep tool, from the repo root). Classify each hit: **rename** only where it is the *type value* (`spec.type: gildi`, "type `gildi`", "`spec.type:gildi`", "gildi-typed"); **leave** group *names* (`security-gildi`, `release-captains-gildi`), the plugin/concept word "gildi", and the `-gildi` suffixes in refs.

- [ ] **Step 2: Change the two Groups' type in the seed.**

In `examples/mock-org/org.yaml`, both guild Groups: `spec: { type: gildi, … }` → `spec: { type: guild, … }` (only the `type:` field; `parent`, `children`, `name`, the `siliconsaga.org/stewards` annotation are unchanged).

- [ ] **Step 3: Update the smoke assertion to expect `guild`.**

In `scripts/smoke-catalog.sh`, the gildi check currently asserts `'"type":"gildi"'`. Change its label and value to `guild`:
```sh
check     "Guild Group ingested (type guild)"        "$GILDI"   '"type":"guild"'                          || pass=0
```
(The `GILDI` shell variable name may stay or be renamed to `GUILD` for clarity — if renamed, update its three uses: the init line, the `byname group/default/security-gildi` capture, and the readiness `grep`.)

- [ ] **Step 4: Sweep type-value references in docs (not names/concept).**

Update only the type-citing phrases, e.g. in `docs/guildhall-model.md` the Mermaid node `Group spec.type:gildi` → `Group spec.type:guild`; in `docs/demo-visir.md` "two `gildi`-typed Groups" → "two `guild`-typed Groups" and "(`spec.type: gildi`)" → "(`spec.type: guild`)"; in `examples/mock-org/README.md` "gildi Groups (`spec.type: gildi`)" → "guild Groups (`spec.type: guild`)"; in the 2026-07-10 design §5 mapping row "`Group` with `spec.type: gildi`" → "`spec.type: guild`". Leave the institution word "gildi", the ADR/kenning discussions, and group names intact.

- [ ] **Step 5: Run the smoke test — it must still pass, now on `guild`.**

Run: `ws exec leidangr make smoke-catalog`
Expected: `smoke-catalog PASS`, including `PASS Guild Group ingested (type guild)`.

- [ ] **Step 6: Commit.**

Write `.commits/gildi-guild-type-rename.md` (frontmatter `add:` the five modified files) and run:
```bash
ws commit leidangr .commits/gildi-guild-type-rename.md
```
Message: `refactor(seed): rename guild group type gildi → guild`.

---

### Task B: Scaffold the `gildi` plugin — mounted page + sidebar item

**Files:**
- Create: `plugins/gildi/package.json`
- Create: `plugins/gildi/tsconfig.json`
- Create: `plugins/gildi/src/routes.ts`
- Create: `plugins/gildi/src/plugin.tsx`
- Create: `plugins/gildi/src/components/GuildHallPage.tsx`
- Create: `plugins/gildi/src/index.ts`
- Create: `plugins/gildi/src/plugin.test.tsx`
- Modify: `packages/app/src/App.tsx` (register `gildiPlugin`)
- Modify: `packages/app/src/modules/nav/Sidebar.tsx` (surface the nav item in the Menu group)

**Interfaces:**
- Produces: default export `gildiPlugin` (a `FrontendPlugin`); a route ref `rootRouteRef` at `/guild-hall`; component `GuildHallPage`. Plan 2 attaches sections inside `GuildHallPage` and adds `EntityCardBlueprint` extensions to `gildiPlugin`.

- [ ] **Step 1: Create the package manifest** (`plugins/gildi/package.json`) — mirror the app package's Backstage role/scripts, scope `@siliconsaga`, role `frontend-plugin`:
```json
{
  "name": "@siliconsaga/plugin-gildi",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "license": "UNLICENSED",
  "private": true,
  "publishConfig": { "access": "public", "main": "dist/index.esm.js", "types": "dist/index.d.ts" },
  "backstage": { "role": "frontend-plugin", "pluginId": "gildi", "pluginPackages": ["@siliconsaga/plugin-gildi"] },
  "sideEffects": false,
  "scripts": {
    "start": "backstage-cli package start",
    "build": "backstage-cli package build",
    "lint": "backstage-cli package lint",
    "test": "backstage-cli package test",
    "clean": "backstage-cli package clean"
  },
  "dependencies": {
    "@backstage/core-components": "^0.18.11",
    "@backstage/frontend-plugin-api": "^0.17.2",
    "@backstage/plugin-catalog-react": "^3.1.0",
    "@backstage/ui": "^0.16.0",
    "@material-ui/icons": "^4.9.1",
    "react-router-dom": "^6.30.2"
  },
  "peerDependencies": { "react": "^17 || ^18", "react-dom": "^17 || ^18" },
  "devDependencies": {
    "@backstage/cli": "^0.36.3",
    "@backstage/frontend-test-utils": "^0.6.1",
    "@testing-library/react": "^14.0.0"
  },
  "files": ["dist"]
}
```

- [ ] **Step 2: Add the package tsconfig** (`plugins/gildi/tsconfig.json`):
```json
{ "extends": "@backstage/cli/config/tsconfig.json", "include": ["src", "dev", "migrations"], "exclude": ["node_modules"], "compilerOptions": { "outDir": "dist", "rootDir": "." } }
```

- [ ] **Step 3: Define the route ref** (`plugins/gildi/src/routes.ts`):
```ts
import { createRouteRef } from '@backstage/frontend-plugin-api';

export const rootRouteRef = createRouteRef();
```

- [ ] **Step 4: Write the placeholder page component** (`plugins/gildi/src/components/GuildHallPage.tsx`) — real headers now, sections land in Plan 2:
```tsx
import { Content, Header, Page } from '@backstage/core-components';

export function GuildHallPage() {
  return (
    <Page themeId="home">
      <Header title="Guild Hall" subtitle="The practice layer — guilds, their practices and aspects, drives, and sagas" />
      <Content>
        <p>The Guild Hall is taking shape. Guilds, drives, chronicle, and actions arrive next.</p>
      </Content>
    </Page>
  );
}
```

- [ ] **Step 5: Write the plugin with its page extension** (`plugins/gildi/src/plugin.tsx`). As-built: `NavItemBlueprint` was removed in `@backstage/frontend-plugin-api@0.17.0`, so the sidebar entry is discovered from the `PageBlueprint`'s own `title`/`icon` — one blueprint, no separate nav item:
```tsx
import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import ShieldIcon from '@material-ui/icons/Security';
import { rootRouteRef } from './routes';

const guildHallPage = PageBlueprint.make({
  params: {
    path: '/guild-hall',
    title: 'Guild Hall',
    icon: <ShieldIcon fontSize="inherit" />,
    routeRef: rootRouteRef,
    loader: () => import('./components/GuildHallPage').then(m => <m.GuildHallPage />),
  },
});

export const gildiPlugin = createFrontendPlugin({
  pluginId: 'gildi',
  extensions: [guildHallPage],
  routes: { root: rootRouteRef },
});
```
(Historical note: this was originally drafted with a separate `NavItemBlueprint` + `defaultPath`; the 0.17.x API folds nav into `PageBlueprint` via `path`/`title`/`icon`. The Step 8 build is the gate that caught it.)

- [ ] **Step 6: Export the plugin as the default** (`plugins/gildi/src/index.ts`):
```ts
export { gildiPlugin as default } from './plugin';
```

- [ ] **Step 7: Write the failing render test** (`plugins/gildi/src/plugin.test.tsx`):
```tsx
import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { GuildHallPage } from './components/GuildHallPage';

describe('GuildHallPage', () => {
  it('renders the Guild Hall header', async () => {
    await renderInTestApp(<GuildHallPage />);
    expect(await screen.findByText('Guild Hall')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Install + build + test the package in isolation.**

Run: `ws exec leidangr corepack yarn install`
Then: `ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi tsc`
Then: `ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi test`
Expected: install picks up the new workspace; `tsc` clean; the render test PASSES. Fix import/param drift against the installed API until green.

- [ ] **Step 9: Register the plugin in the app** (`packages/app/src/App.tsx`):
```tsx
import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import gildiPlugin from '@siliconsaga/plugin-gildi';
import { navModule } from './modules/nav';
import { cycleModule } from './modules/cycle';

export default createApp({
  features: [catalogPlugin, gildiPlugin, navModule, cycleModule],
});
```
Add `"@siliconsaga/plugin-gildi": "^0.1.0"` to `packages/app/package.json` dependencies, then re-run `ws exec leidangr corepack yarn install`.

- [ ] **Step 10: Ensure the sidebar shows "Guild Hall".** The nav renders `nav.rest({ sortBy: 'title' })` inside the Menu group (`Sidebar.tsx:38-40`), so the `PageBlueprint`'s `title`/`icon` surface as a sidebar item automatically — no edit needed. (If you ever want it pinned above `nav.rest`, `nav.take(<the page's nav id>)` after `nav.take('page:scaffolder')`, confirming the id with the app-visualizer.)

- [ ] **Step 11: Verify the whole app builds and the page mounts.**

Run: `ws test leidangr` (full `make ci`: config-check + lint + tsc + tests)
Expected: PASS.
Then boot for a visual check: `ws exec leidangr make dev`, open `http://localhost:3000`, confirm **"Guild Hall"** appears in the sidebar and routes to the page at `/guild-hall`. (Human-gated visual confirmation.)

- [ ] **Step 12: Commit.**

`.commits/gildi-scaffold.md` staging `plugins/gildi/`, `packages/app/src/App.tsx`, `packages/app/package.json` (and `Sidebar.tsx` if edited). Run `ws commit leidangr .commits/gildi-scaffold.md`.
Message: `feat(gildi): scaffold the Guild Hall plugin — mounted page + sidebar item`.

---

### Task C: Render Mermaid in TechDocs (Addons framework)

**Files:**
- Modify: `packages/app/package.json` (add the mermaid addon dependency)
- Create/Modify: a small techdocs-addons app module (new frontend system) — exact wiring determined by Step 1
- Test: manual TechDocs render of `docs/guildhall-model.md`

**Interfaces:**
- Produces: ```` ```mermaid ```` fences in any TechDocs site render as diagrams (unblocks the root guildhall-model.md concept maps).

- [ ] **Step 1: Confirm addon + new-frontend-system compatibility (spike, timeboxed).**

Check the current `backstage-plugin-techdocs-addon-mermaid` (or the equivalent maintained addon) for **new frontend system support** and its registration shape. The app already depends on `@backstage/plugin-techdocs-module-addons-contrib`, which is the addon-wiring seam. Read the addon's README + the Backstage TechDocs Addons docs. Record the exact package name/version and whether it exposes a new-frontend-system extension or needs the legacy `TechDocsAddons` compat wrapper. **If it has no new-frontend-system path yet, stop and report** — we choose between the legacy-compat wrapper and deferring (fences keep degrading to code blocks; not a blocker for the rest of the plugin).

- [ ] **Step 2: Add the dependency.**

Add the confirmed addon package+version to `packages/app/package.json`, then `ws exec leidangr corepack yarn install`.

- [ ] **Step 3: Wire the addon per Step 1's finding** (exact code from the addon's new-frontend-system docs — a techdocs addon extension registered in an app module or the plugin's features).

- [ ] **Step 4: Render-verify against the root concept map.**

Run: `ws exec leidangr make dev` with local TechDocs (`app-config.local.yaml` → `techdocs.generator.runIn: local`, `pip install mkdocs-techdocs-core`). Open the Guild Hall / root TechDocs site and confirm the `guildhall-model.md` Mermaid diagrams render as diagrams, not code blocks. (Human-gated visual confirmation.)

- [ ] **Step 5: Commit.**

`.commits/gildi-mermaid-addon.md`. Message: `feat(techdocs): render mermaid via the TechDocs Addons framework`.

---

### Decision (made 2026-07-20) — retire the `guild-hall` Component by re-homing its docs (Option 1)

Cervator's pick: **re-home, not demote.** The `guild-hall` `type: hub` Component is retired and its root TechDocs re-homed. That entity currently anchors `docs/guildhall-model.md` + root `mkdocs.yml` via `backstage.io/techdocs-ref: dir:.` (a `dir:.` ref can only anchor an entity whose file sits at the repo root — and `catalog-info.yaml` is the only root entity), carries `siliconsaga.org/visir: docs/demo-visir.md`, and is referenced by `docs/demo-visir.md`, `examples/mock-org/README.md`, and the app-config location at `app-config.yaml:132-135`.

The retirement is **its own later plan** (it must run *after* the Guild Hall page is real, so the docs have somewhere to land). That plan will:
1. **Re-home the model docs onto the Guild Hall experience** — surface the `guildhall-model.md` concept map on the plugin's page (mermaid-in-app, leaning on the Task C addon or an in-page mermaid render) and/or move the root `mkdocs.yml` docs to plugin-scoped docs, so the model overview lives with the hub it describes rather than a placeholder entity. Re-home the vísir link too.
2. **Delete the `guild-hall` entity** — remove root `catalog-info.yaml`, its `app-config.yaml` catalog location (lines 130-135), and sweep the `guild-hall` references in `demo-visir.md` / `examples/mock-org/README.md`.
3. **Verify** — update `make smoke-catalog` so it no longer expects the hub entity; confirm the concept map still renders (now in-app) and no TechDocs 404s.

Not part of Plan 1 (Plan 1's page is the prerequisite). Captured here so the sequencing is unambiguous.

---

## Self-Review

- **Spec coverage (Plan 1 scope):** new-frontend-system scaffold (design §2) → Task B; guild-type rename (§7) → Task A; Mermaid addon (§11) → Task C; `guild-hall` retirement (§1/§12) → surfaced as a Decision (blocked on a choice, correctly not fabricated). Crest module, catalog-querying cards, drives/chronicle/actions, entity decoration, dogfood (§4–§10) are **out of Plan 1 scope** — they are Plan 2+.
- **Placeholder scan:** Task C Steps 2–3 depend on Step 1's spike output (the addon's exact package + wiring can't be pinned without checking its new-frontend-system support) — this is a genuine investigation gate, flagged as such, not a lazy placeholder. Everything in Tasks A and B is exact.
- **Type consistency:** `gildiPlugin` (default export), `rootRouteRef`, `GuildHallPage` used consistently across plugin.tsx / index.ts / App.tsx / test.
- **Blueprint-API caveat:** `PageBlueprint`/`NavItemBlueprint` param shapes are per the documented new-frontend-system API; the Step-8 `tsc`/build gate is the safety net for version drift, with an explicit adjust-if-different note.
