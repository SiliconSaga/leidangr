# Guild Entity-Page Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Replace the appended guild cards with a guild-only, two-zone custom overview layout (Charter leads main; entity graph demoted; right rail = Group Profile · Links · Chronicle), scoped to `kind:Group spec.type:guild` so other Groups are unaffected.

**Architecture:** A single `EntityContentLayoutBlueprint` (filtered to guilds) attaches to `entity-content:catalog/overview`'s `layouts` input and renders a hand-composed grid. Our `GuildCharterCard`/`GuildChronicleCard` carry over; stock cards (`EntityGroupProfileCard`, `EntityLinksCard`, `EntityOwnershipCard`, `EntityMembersListCard`, `EntityCatalogGraphCard`) are imported and placed directly. The three `EntityCardBlueprint` registrations and the Roster card are removed.

**Tech Stack:** TypeScript/React, Backstage new frontend system (`@backstage/plugin-catalog-react/alpha`), `@backstage/plugin-org`, `@backstage/plugin-catalog`, `@backstage/plugin-catalog-graph`, MUI v4, Jest + `@backstage/frontend-test-utils`.

## Global Constraints

- All code in `plugins/gildi/`. Branch: `feat/gildi-guild-entity-decoration` (continue on it).
- Guild specificity lives ONLY in the layout's `filter` — do NOT touch global `app.extensions` config for stock cards (that would hit every Group).
- Commit with `ws commit leidangr --co-author-file sdd-impl .commits/<name>.md` (subagents) or `ws commit leidangr .commits/<name>.md` (main agent). No raw `git commit`. No semicolons in commit message/body.
- **Allowlist-friendly commands (avoid permission prompts):** read-only git via `git -C components/leidangr <log|diff|show|status>` (NOT `ws exec … git`); search via the Grep/Glob tools (NOT shell find/grep); gating via `ws test leidangr` / `ws lint leidangr`. `yarn` is not on PATH — use `ws exec leidangr corepack yarn …` for the focused test / install.
- Reference `.superpowers/sdd/research-entity-layout.md` for the exact blueprint/API citations.

---

### Task 1: Add stock-card deps + sync lockfile

**Files:** Modify `plugins/gildi/package.json`, `yarn.lock`.

- [ ] **Step 1:** Add to `plugins/gildi/package.json` `dependencies` (match the versions the app already resolves — read `packages/app/package.json` / root `yarn.lock` for the installed majors; use caret ranges):
  - `"@backstage/plugin-catalog"`, `"@backstage/plugin-catalog-graph"`, `"@backstage/plugin-org"`.
  Determine each version by checking an existing dependant (e.g. `Grep` for `"@backstage/plugin-catalog"` in `packages/app/package.json`). Use the same major/caret as the app.
- [ ] **Step 2:** Regenerate the lockfile: `ws exec leidangr corepack yarn install` (mutable).
- [ ] **Step 3:** Confirm the immutable path is clean: `ws exec leidangr make deps` → expect success (warnings OK, exit 0).
- [ ] **Step 4:** Commit. Bodyfile `.commits/gildi-layout-deps.md`:
```md
---
message: "chore(gildi): add plugin-org/catalog/catalog-graph deps for the guild layout"
add:
  - plugins/gildi/package.json
  - yarn.lock
---

The guild overview layout composes stock entity cards (Group Profile, Links,
Ownership, Members, entity graph), so gildi now depends on plugin-org,
plugin-catalog and plugin-catalog-graph. Lockfile regenerated to match.
```

---

### Task 2: Trim Charter, delete Roster

**Files:** Modify `plugins/gildi/src/entity/GuildCharterCard.tsx`, `GuildCharterCard.test.tsx`. Delete `GuildRosterCard.tsx`, `useGuildRoster.ts`, `GuildRosterCard.test.tsx`.

- [ ] **Step 1:** In `GuildCharterCard.tsx`, remove the featured-links block (the `links`/`metadata.links` mapping and its container) and the now-unused `Link` import. Keep crest, title, charter prose, and the steward-aspect chips (the "Stewards" highlight). The card body becomes crest + title + prose + steward chips only.
- [ ] **Step 2:** In `GuildCharterCard.test.tsx`, delete the link assertion (`getByRole('link', { name: /Charter doc/ })`) and the `links` field from the fixture. Keep the charter-prose and steward-chip assertions.
- [ ] **Step 3:** Delete the three Roster files listed above (`git -C components/leidangr rm` is fine, or delete on disk and let the bodyfile record the removals).
- [ ] **Step 4:** Focused test: `ws exec leidangr corepack yarn --cwd plugins/gildi test src/entity/GuildCharterCard.test.tsx --watchAll=false` → PASS.
- [ ] **Step 5:** Commit. Bodyfile `.commits/gildi-trim-charter-drop-roster.md`:
```md
---
message: "refactor(gildi): drop Roster card, move links off Charter"
add:
  - plugins/gildi/src/entity/GuildCharterCard.tsx
  - plugins/gildi/src/entity/GuildCharterCard.test.tsx
remove:
  - plugins/gildi/src/entity/GuildRosterCard.tsx
  - plugins/gildi/src/entity/useGuildRoster.ts
  - plugins/gildi/src/entity/GuildRosterCard.test.tsx
---

The guild page will show owned practices + the aspect Template via the stock
Ownership card, so the Roster card is redundant and removed. Charter drops its
links block — links render in the stock Links card in the right rail. Charter
keeps crest, prose and the steward-aspect highlight.
```

---

### Task 3: Build the guild overview layout + rewire the plugin

**Files:** Create `plugins/gildi/src/entity/GuildOverviewLayout.tsx`. Modify `plugins/gildi/src/entity/index.tsx`, `plugins/gildi/src/plugin.tsx`, `plugins/gildi/src/plugin.test.tsx`. Create `plugins/gildi/src/entity/GuildOverviewLayout.test.tsx`.

**Interfaces / imports (verify names/props against the package `.d.ts` and the research report — these stock cards render within the entity context the layout already provides; if one needs an explicit prop or a different export name, adjust and note it):**
- `EntityContentLayoutBlueprint`, `EntityContentLayoutProps` from `@backstage/plugin-catalog-react/alpha`
- `EntityGroupProfileCard`, `EntityMembersListCard`, `EntityOwnershipCard` from `@backstage/plugin-org`
- `EntityLinksCard` from `@backstage/plugin-catalog`
- `EntityCatalogGraphCard` from `@backstage/plugin-catalog-graph`

- [ ] **Step 1: Write the layout component**

```tsx
// plugins/gildi/src/entity/GuildOverviewLayout.tsx
import { Grid } from '@material-ui/core';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { EntityGroupProfileCard, EntityMembersListCard, EntityOwnershipCard } from '@backstage/plugin-org';
import { EntityLinksCard } from '@backstage/plugin-catalog';
import { EntityCatalogGraphCard } from '@backstage/plugin-catalog-graph';
import { GuildCharterCard } from './GuildCharterCard';
import { GuildChronicleCard } from './GuildChronicleCard';

// A guild-only overview layout: main column leads with the human-readable
// Charter, then stock Ownership + Members, with the entity graph demoted to the
// bottom; the right rail keeps the familiar Group Profile + Links, then our
// Chronicle. We ignore props.cards and compose explicitly for deterministic
// placement (the generic array has no stable per-card identity).
export function GuildOverviewLayout(_props: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Grid container spacing={3} direction="column">
          <Grid item><GuildCharterCard /></Grid>
          <Grid item><EntityOwnershipCard variant="gridItem" /></Grid>
          <Grid item><EntityMembersListCard /></Grid>
          <Grid item><EntityCatalogGraphCard variant="gridItem" height={400} /></Grid>
        </Grid>
      </Grid>
      <Grid item xs={12} md={4}>
        <Grid container spacing={3} direction="column">
          <Grid item><EntityGroupProfileCard variant="gridItem" /></Grid>
          <Grid item><EntityLinksCard variant="gridItem" /></Grid>
          <Grid item><GuildChronicleCard /></Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}
```
If tsc rejects a prop (e.g. `variant`/`height` not on a card, or a card needs `entity`), consult the card's `.d.ts` and the research report and adjust minimally — do not leave a type error. Report any variant you changed.

- [ ] **Step 2: Replace the extensions in `entity/index.tsx`**

Remove the three `EntityCardBlueprint` exports; replace with:
```tsx
// plugins/gildi/src/entity/index.tsx
import { EntityContentLayoutBlueprint } from '@backstage/plugin-catalog-react/alpha';

export const guildOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'guild-overview',
  params: {
    filter: { kind: 'group', 'spec.type': 'guild' },
    loader: async () => {
      const { GuildOverviewLayout } = await import('./GuildOverviewLayout');
      return props => <GuildOverviewLayout {...props} />;
    },
  },
});
```

- [ ] **Step 3: Rewire `plugin.tsx`**

Replace the three card imports/registrations with the layout:
```tsx
import { guildOverviewLayout } from './entity';
// ...
export const gildiPlugin = createFrontendPlugin({
  pluginId: 'gildi',
  extensions: [guildHallPage, guildOverviewLayout],
  routes: { root: rootRouteRef },
});
```

- [ ] **Step 4: Update `plugin.test.tsx`** — replace the three `guild-charter`/`guild-roster`/`guild-chronicle` id assertions with a single assertion that `guild-overview` (an `entity-content-layout`) registers. Follow the file's existing `createExtensionTester(...).snapshot().id` pattern; the expected id is the `entity-content-layout:gildi/guild-overview` form (verify the exact prefix via the snapshot, adjust the matcher to what it emits).

- [ ] **Step 5: Layout unit test**

```tsx
// plugins/gildi/src/entity/GuildOverviewLayout.test.tsx
import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { GuildOverviewLayout } from './GuildOverviewLayout';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: { name: 'security-gildi', title: 'Security guild', description: 'Keeps things safe.', annotations: { 'siliconsaga.org/stewards': 'aspect:security' } },
  spec: { type: 'guild' },
} as any;

const catalogApi = { getEntities: async () => ({ items: [] }), getEntityByRef: async () => guild } as any;

describe('GuildOverviewLayout', () => {
  it('renders our Charter and Chronicle content', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={guild}>
          <GuildOverviewLayout cards={[]} />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Charter')).toBeInTheDocument();
    expect(await screen.findByText('Chronicle')).toBeInTheDocument();
  });
});
```
The stock cards may require additional APIs to render fully in jsdom. If they throw and cannot be cleanly satisfied with a small mock, it is acceptable to (a) mock the minimum needed, or (b) narrow the assertion to our own composition and report the stock-card render limitation as a concern — the composed page's real proof is the manual acceptance in Task 4. Do NOT weaken the test to assert nothing. Report what you did.

- [ ] **Step 6: Gate.** `ws test leidangr` → PASS. `ws lint leidangr` → PASS (tsc clean).

- [ ] **Step 7: Commit.** Bodyfile `.commits/gildi-guild-overview-layout.md`:
```md
---
message: "feat(gildi): guild-only two-zone overview layout"
add:
  - plugins/gildi/src/entity/GuildOverviewLayout.tsx
  - plugins/gildi/src/entity/GuildOverviewLayout.test.tsx
  - plugins/gildi/src/entity/index.tsx
  - plugins/gildi/src/plugin.tsx
  - plugins/gildi/src/plugin.test.tsx
---

A guild-only overview via EntityContentLayoutBlueprint (filter kind:group
spec.type:guild) replaces the three appended card extensions. Main column leads
with Charter, then Ownership and Members, with the entity graph demoted to the
bottom; the right rail keeps Group Profile and Links, then Chronicle. Other
Groups fall through to the stock layout untouched.
```

---

### Task 4: Manual acceptance + PR

- [ ] **Step 1: Human-gated manual acceptance.** Pause. Ask the human to `make dev` and reload `http://localhost:3000/catalog/default/group/security-gildi`, confirming: two-zone layout; Charter leads the main column; Ownership + Members below; entity graph at the bottom; right rail = Group Profile · Links · Chronicle; and a non-guild Group still shows the default layout. Do not self-certify.
- [ ] **Step 2: PR.** After acceptance, open the CR with `ws cr` from a `.crs/` bodyfile: guild entity-page decoration + guild-only two-zone layout (slice 6 + layout), noting the `.gitattributes` LF fix and yarn.lock sync that ride along.

## Self-Review

- Spec coverage: layout mechanism (Task 3) ✓; card model consolidation — Roster deleted (Task 2), Charter trimmed (Task 2), stock cards composed (Task 3) ✓; deps (Task 1) ✓; testing + manual acceptance (Task 3/4) ✓; guild-scoping via filter, no global config (Task 3, Global Constraints) ✓.
- Placeholders: none — the one contingency (stock-card prop/name verification) gives the exact resolution method, not a vague TODO.
- Type consistency: `guildOverviewLayout` produced in Task 3 index, consumed in Task 3 plugin.tsx; `GuildOverviewLayout` component created then imported by the blueprint loader; Charter/Chronicle components reused unchanged (bar Charter's link removal in Task 2).
