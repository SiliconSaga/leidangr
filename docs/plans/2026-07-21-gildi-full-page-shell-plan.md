# Guild Hall hub (`gildi`) — Plan 3: Full page shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Flesh out the Guild Hall into its full designed page — add the **Drives band**, the **Chronicle** (recent Sagas), the **Actions** (scaffolder links + a light dogfood), and arrange all five sections into the two-zone layout. Batched onto `feat/gildi-crest-guilds` for one PR.

**Architecture:** Each new section mirrors the proven Guilds pattern exactly — a `useX` hook (`catalogApiRef.getEntities` via `useApi` + `useAsync`) → an `XCard` (`InfoCard`/`EntityRefLink`/`Crest`/`Typography`/`Chip`, per `plugins/gildi/src/guilds/GuildCard.tsx`) → an `XSection` with loading/empty/error (per `GuildsSection.tsx`). A final layout task composes them: Intro → Drives band (full width, bounded) → an MUI `Grid` with a wide **Guilds** column and a **rail** (Actions + Chronicle).

**Tech Stack:** as Plan 2 — new frontend system, `@backstage/plugin-catalog-react` (`catalogApiRef`, `EntityRefLink`), `@backstage/core-components` (`InfoCard`, `Progress`, `ResponseErrorPanel`, `Link`), `@material-ui/core` (`Grid`, `Typography`, `Chip`), the `Crest` from Plan 2.

## Global Constraints

- Node 22||24; verify via `ws test leidangr` (`make test test-app`) + `ws lint leidangr` (`make lint tsc`) — both green. One shell command per Bash call; no raw git commit/push; commit via `ws commit`.
- **Reuse the established pattern** — new hooks/cards/sections should look like their Guilds siblings (`plugins/gildi/src/guilds/*`). Curated cards, theme-aware Typography/Chip, NOT metadata dumps.
- **Identity-mark rule** (design §4): a card leads with the relevant **guild crest** when a guild is its actor/subject; actions lead with a glyph. Drives → the owner guild's crest; Sagas → the guild found in `spec.touches` (if any), else the skald.
- Seed Cycle/Saga shapes (verified in `examples/mock-org/cycles.yaml`): `Cycle` `spec.{type,timeframe:{start,end},of,owner}`; `Saga` `spec.{skald(User ref),timeframe,touches[],owner}` + `siliconsaga.org/saga-doc` annotation + `metadata.description`.
- Design source: `docs/plans/2026-07-20-gildi-guildhall-hub-design.md` §3 (layout), §4 (cards).
- **Deferred (note, do NOT build here):** typed + colored tag chips with consistent casing (wait until tags carry structure); front-matter-fetched Saga previews (use `metadata.description` for now); skald avatars (use a byline for now); owner-ref join test-coverage hardening; the guilds↔chronicle wide/rail swap being user-configurable.

---

### Task 1: Drives band

**Files:** Create `plugins/gildi/src/drives/useDrives.ts`, `DriveCard.tsx`, `DrivesBand.tsx`, `DrivesBand.test.tsx`.

**Interfaces:** Produces `<DrivesBand />` (mounted by Task 4).

- [ ] **Step 1: `useDrives.ts`** — query campaign Cycles (default `spec.type: drive`), shape a `DriveView`:
```ts
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';

export interface DriveView {
  name: string; title: string; description?: string;
  entityRef: string;                 // cycle:default/<name>
  ownerGuildName?: string;           // for the crest, when owner is a guild Group
  start?: string; end?: string;
}

export function useDrives() {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Cycle', 'spec.type': 'drive' } });
    const views = res.items.map(c => {
      const owner = (c.spec?.owner as string) ?? '';
      const ownerName = owner.startsWith('group:') ? owner.split('/').pop() : undefined;
      const tf = (c.spec?.timeframe as { start?: string; end?: string }) ?? {};
      return {
        name: c.metadata.name,
        title: c.metadata.title ?? c.metadata.name,
        description: c.metadata.description,
        entityRef: stringifyEntityRef(c),
        ownerGuildName: ownerName,
        start: tf.start, end: tf.end,
      } as DriveView;
    });
    // active & upcoming only — drop drives whose end date has passed (local date)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return views.filter(d => !d.end || d.end >= today);
  }, [catalog]);
  return { drives: state.value ?? [], loading: state.loading, error: state.error };
}
```

- [ ] **Step 2: `DriveCard.tsx`** — mirror `GuildCard` (InfoCard + EntityRefLink + Crest + Typography); show title, description, and a timeframe line; lead with the owner guild's crest when present:
```tsx
import { Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import type { DriveView } from './useDrives';

export function DriveCard({ drive }: { drive: DriveView }) {
  return (
    <InfoCard variant="gridItem">
      <EntityRefLink entityRef={drive.entityRef} style={{ display: 'flex', gap: 14, textDecoration: 'none', color: 'inherit' }}>
        {drive.ownerGuildName && <Crest seed={drive.ownerGuildName} size={44} title={`Arms of ${drive.ownerGuildName}`} />}
        <div style={{ minWidth: 0 }}>
          <Typography variant="overline" color="textSecondary">Drive</Typography>
          <Typography variant="h6">{drive.title}</Typography>
          {drive.description && <Typography variant="body2" color="textSecondary" style={{ margin: '4px 0' }}>{drive.description}</Typography>}
          {(drive.start || drive.end) && <Typography variant="caption" color="textSecondary">{drive.start} → {drive.end}</Typography>}
        </div>
      </EntityRefLink>
    </InfoCard>
  );
}
```

- [ ] **Step 3: `DrivesBand.tsx`** — bounded band; a responsive row (MUI `Grid` container), loading/empty/error like `GuildsSection`. Heading "Active &amp; upcoming drives". Empty state: a muted "No active drives." Mirror `GuildsSection.tsx` structure (Progress / ResponseErrorPanel / grid).

- [ ] **Step 4: `DrivesBand.test.tsx`** — mirror `GuildsSection.test.tsx`: `TestApiProvider` mocking `catalogApiRef.getEntities` to return one `drive` Cycle (owner `group:default/security-gildi`, a timeframe, a description); assert the title + description render. Bind `entityRouteRef` via `mountedRoutes` (as the guilds test does, since `EntityRefLink` needs it).

- [ ] **Step 5: Verify** `ws test leidangr` + `ws lint leidangr` green. **Step 6: Commit** `.commits/gildi-drives.md` (`add: plugins/gildi/src/drives`), `feat(gildi): Drives band`.

---

### Task 2: Chronicle (recent Sagas)

**Files:** Create `plugins/gildi/src/chronicle/useSagas.ts`, `SagaCard.tsx`, `ChronicleRail.tsx`, `ChronicleRail.test.tsx`.

**Interfaces:** Produces `<ChronicleRail />` (mounted by Task 4).

- [ ] **Step 1: `useSagas.ts`** — query `kind: Saga`; shape a `SagaView`; pull the involved guild from `spec.touches` (a `group:*` ref, prefer one ending `-gildi`) and the skald ref; sort by `timeframe.end` descending:
```ts
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';

export interface SagaView {
  name: string; title: string; description?: string;
  entityRef: string;                 // saga:default/<name>
  skaldRef?: string;                 // user:default/<name>
  guildName?: string;                // touched guild for the crest
  end?: string;
}

export function useSagas() {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Saga' } });
    const views = res.items.map(s => {
      const touches = (s.spec?.touches as string[]) ?? [];
      const guildRef = touches.find(t => t.startsWith('group:') && (t.split('/').pop() ?? '').endsWith('-gildi')) ?? touches.find(t => t.startsWith('group:'));
      const tf = (s.spec?.timeframe as { end?: string }) ?? {};
      return {
        name: s.metadata.name,
        title: s.metadata.title ?? s.metadata.name,
        description: s.metadata.description,
        entityRef: stringifyEntityRef(s),
        skaldRef: s.spec?.skald as string | undefined,
        guildName: guildRef ? guildRef.split('/').pop() : undefined,
        end: tf.end,
      } as SagaView;
    });
    return views.sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''));
  }, [catalog]);
  return { sagas: state.value ?? [], loading: state.loading, error: state.error };
}
```

- [ ] **Step 2: `SagaCard.tsx`** — compact preview: crest (touched guild) or nothing; title; a one-line description; a byline "by <skald>" via `EntityRefLink` to the skald User; a "Read →" `EntityRefLink` to the Saga entity. Mirror `DriveCard` styling; keep it compact (it lives in the rail).

- [ ] **Step 3: `ChronicleRail.tsx`** — heading "Recent chronicle"; render the (already-sorted) sagas as a vertical stack of `SagaCard`s; loading/empty/error. Optionally cap at a prop `max` (default 4) with a note if more exist. Mirror `GuildsSection` states.

- [ ] **Step 4: `ChronicleRail.test.tsx`** — mock two Sagas (different `timeframe.end`); assert both titles render and the newer sorts first; skald byline present. `mountedRoutes` for the entity refs.

- [ ] **Step 5: Verify green. Step 6: Commit** `.commits/gildi-chronicle.md` (`add: plugins/gildi/src/chronicle`), `feat(gildi): Chronicle rail — recent sagas`.

---

### Task 3: Actions + a light `guildhall` dogfood

**Files:** Create `plugins/gildi/src/actions/useActions.ts`, `ActionCard.tsx`, `ActionsPanel.tsx`, `ActionsPanel.test.tsx`; seed `examples/mock-org/guildhall/actions/charter-practice.template.yaml` (+ register in `app-config.yaml`).

**Interfaces:** Produces `<ActionsPanel />` (mounted by Task 4).

- [ ] **Step 1: Seed a dogfood scaffolder Template** (`examples/mock-org/guildhall/actions/charter-practice.template.yaml`) — a mock Template tagged `guild-hall` whose steps only `debug:log` (no real scaffolding), mirroring the existing `repos/security-aspect/template.yaml` shape:
```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: charter-a-practice
  title: Charter a practice
  description: Stand up a new practice and its guild — the Guild Hall dogfooding its own model.
  tags: [guild-hall]
spec:
  type: guildhall-action
  owner: group:default/team-devex
  parameters:
    - title: New practice
      properties:
        practice: { title: Practice name, type: string }
  steps:
    - id: log
      name: Plan
      action: debug:log
      input:
        message: 'Would charter the ${{ parameters.practice }} practice and stand up its guild.'
```
Register it in `app-config.yaml` `catalog.locations` (allow `[Template]`), alongside the existing security-aspect template entry.

- [ ] **Step 2: `useActions.ts`** — query `kind: Template` filtered by the convention tag `guild-hall` (`filter: { kind: 'Template', 'metadata.tags': 'guild-hall' }` — verify the tag-filter key against the installed catalog client; fall back to fetching all Templates and filtering `metadata.tags?.includes('guild-hall')` in JS if the filter key differs). Shape `ActionView { name, title, description?, createHref }` where `createHref = /create/templates/default/<name>`.

- [ ] **Step 3: `ActionCard.tsx`** — lead with a scaffolder glyph (a MUI icon, e.g. `AddCircleOutline`), title, one-line description, and a `Link` (from `@backstage/core-components`) to `createHref` labeled "Open in Create →". Compact, mirrors the card styling.

- [ ] **Step 4: `ActionsPanel.tsx`** — heading "Actions"; stack of `ActionCard`s; loading/empty/error; empty state "No actions yet." Mirror `GuildsSection` states.

- [ ] **Step 5: `ActionsPanel.test.tsx`** — mock `getEntities` returning the `charter-a-practice` Template; assert its title renders and the Create link points at `/create/templates/default/charter-a-practice`.

- [ ] **Step 6: Verify** `ws test leidangr` + `ws lint leidangr` **and** `ws exec leidangr make smoke-catalog` (the new Template must ingest) green. **Step 7: Commit** `.commits/gildi-actions.md` (`add: plugins/gildi/src/actions`, `examples/mock-org/guildhall/actions/charter-practice.template.yaml`, `app-config.yaml`), `feat(gildi): Actions panel + charter-a-practice dogfood template`.

---

### Task 4: Compose the two-zone layout

**Files:** Modify `plugins/gildi/src/components/GuildHallPage.tsx`; update `plugins/gildi/src/plugin.test.tsx` if the page's mocked APIs change.

- [ ] **Step 1: Restructure `GuildHallPage.tsx`** into the designed layout — Intro header → Drives band (full width, bounded) → an MUI `Grid` split: wide **Guilds** column + a **rail** (Actions above Chronicle):
```tsx
import { Grid } from '@material-ui/core';
import { Content, Header, Page } from '@backstage/core-components';
import { DrivesBand } from '../drives/DrivesBand';
import { GuildsSection } from '../guilds/GuildsSection';
import { ActionsPanel } from '../actions/ActionsPanel';
import { ChronicleRail } from '../chronicle/ChronicleRail';

export function GuildHallPage() {
  return (
    <Page themeId="home">
      <Header title="Guild Hall" subtitle="The practice layer — guilds, their practices and aspects, drives, and sagas" />
      <Content>
        <DrivesBand />
        <Grid container spacing={3} style={{ marginTop: 8 }}>
          <Grid item xs={12} md={8}>
            <h2 style={{ marginTop: 0 }}>Guilds</h2>
            <GuildsSection />
          </Grid>
          <Grid item xs={12} md={4}>
            <ActionsPanel />
            <ChronicleRail />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
```
(Keep the `Guilds` heading inside its column; `DrivesBand`/`ActionsPanel`/`ChronicleRail` render their own headings.)

- [ ] **Step 2: Fix `plugin.test.tsx`** — `GuildHallPage` now calls `getEntities` for guilds, practices, drives, sagas, and templates. Extend the mocked `catalogApiRef` so the smoke render test still passes (return `{ items: [] }` for the kinds it doesn't assert on, or minimal fixtures). Assert the page still renders the "Guild Hall" header.

- [ ] **Step 3: Verify** `ws test leidangr` + `ws lint leidangr` green. **Step 4 (human-gated — do NOT boot):** visual — the full page shows the drives band up top, guilds in the wide column, actions + chronicle in the rail; note PENDING. **Step 5: Commit** `.commits/gildi-layout.md` (`add: plugins/gildi/src/components/GuildHallPage.tsx`, `plugins/gildi/src/plugin.test.tsx`), `feat(gildi): compose the two-zone Guild Hall layout`.

---

## Self-Review

- **Spec coverage:** Drives (§3/§4) → Task 1; Chronicle → Task 2; Actions + dogfood → Task 3; two-zone layout → Task 4. Deferred items explicitly listed in Global Constraints.
- **Placeholder scan:** each task carries concrete hook/card code + a test; the two verify-against-installed points (the Template tag-filter key; `useApi`/`TestApiProvider` sources — already resolved in Plan 2) have fallback notes.
- **Type consistency:** `DriveView`/`SagaView`/`ActionView` and their `useX`/`XCard`/`XSection` trios mirror the guilds trio; Task 4 mounts `<DrivesBand/>`, `<GuildsSection/>`, `<ActionsPanel/>`, `<ChronicleRail/>` by those exact names.
- **Pattern reuse:** every card is `InfoCard` + `Typography`/`Chip` + `EntityRefLink` + (crest where a guild leads), matching the reviewed `GuildCard`.
