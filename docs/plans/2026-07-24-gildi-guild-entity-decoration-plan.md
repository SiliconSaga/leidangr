# Guild Entity-Page Decoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decorate the guild (`Group` with `spec.type: guild`) entity page with three curated cards — Charter, Roster, Chronicle — owned by the `gildi` plugin.

**Architecture:** Three `EntityCardBlueprint` extensions registered by the gildi plugin attach to the catalog Group Overview, gated `kind:Group spec.type:guild`. Charter reads the guild entity directly (`useEntity`); Roster and Chronicle read the catalog via typed search, reusing the shipped hub query logic (extracted to shared helpers and additive optional hook params, so the hub is unaffected). Reuses the existing crest module and `SagaCard`/`DriveCard` components.

**Tech Stack:** TypeScript, React, Backstage new frontend system (`@backstage/frontend-plugin-api`, `@backstage/plugin-catalog-react/alpha`), Material-UI v4 (`@material-ui/core`), Jest + `@testing-library/react` + `@backstage/frontend-test-utils`.

## Global Constraints

- All new code lives in `plugins/gildi/src/` (the extraction-ready `@siliconsaga/plugin-gildi` package owns its own decoration).
- Reuse the shipped card family: `InfoCard`, `Crest`, `Chip` (outlined), `EntityRefLink`, `SagaCard`, `DriveCard`. No new visual primitives.
- Every card renders a **section heading in all states**, with a gentle empty message rather than a blank card (PR #12 round-2 review lesson).
- React keys derive from entity refs, never display names (same review lesson).
- Malformed entity refs must never break a render — wrap `parseEntityRef` in try/catch and fall back (the repo's `safeRef` convention, see `packages/app/src/modules/cycle/CycleCard.tsx`).
- Charter prose is **inline-only** this slice (annotation or `metadata.description`) — no markdown fetch/render.
- Commit every task with `ws commit leidangr .commits/<name>.md` (bodyfile-driven; frontmatter `message:` + `add:`). Never raw `git commit`. Avoid semicolons in commit message/body (hook constraint).
- Gate before PR: `ws test leidangr` and `ws lint leidangr` green; guild-page visual smoke is human-gated.

---

### Task 1: Extract shared roster helpers from `useGuilds`

Behaviour-preserving refactor: pull the practices-by-owner indexing and steward-aspect parsing out of `useGuilds` into pure, unit-testable helpers that Task 3 also consumes.

**Files:**
- Create: `plugins/gildi/src/guilds/roster.ts`
- Create (test): `plugins/gildi/src/guilds/roster.test.ts`
- Modify: `plugins/gildi/src/guilds/useGuilds.ts`

**Interfaces:**
- Produces:
  - `stewardAspectsOf(guild: Entity): string[]` — parses `siliconsaga.org/stewards` (comma-separated `aspect:<id>` tokens) to a list of bare aspect ids.
  - `indexPracticesByOwner(practices: Entity[]): Map<string, Entity[]>` — keys are `stringifyEntityRef` of each practice's parsed `spec.owner` (default kind Group, namespace default); practices with a missing or malformed owner are skipped.
  - `practiceView(p: Entity): { name: string; title: string; aspect?: string }` — maps a practice entity to the compact view (title falls back to name, aspect from `siliconsaga.org/aspect`).

- [ ] **Step 1: Write the failing test**

```ts
// plugins/gildi/src/guilds/roster.test.ts
import { stewardAspectsOf, indexPracticesByOwner, practiceView } from './roster';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: { name: 'security-gildi', annotations: { 'siliconsaga.org/stewards': 'aspect:security, aspect:appsec' } },
  spec: { type: 'guild' },
} as any;

const practice = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
  metadata: { name: 'security-practice', title: 'Security practice', annotations: { 'siliconsaga.org/aspect': 'security' } },
  spec: { type: 'practice', owner: 'group:default/security-gildi' },
} as any;

describe('roster helpers', () => {
  it('parses steward aspect ids', () => {
    expect(stewardAspectsOf(guild)).toEqual(['security', 'appsec']);
  });
  it('indexes practices by normalized owner ref', () => {
    const idx = indexPracticesByOwner([practice]);
    expect(idx.get('group:default/security-gildi')).toHaveLength(1);
  });
  it('skips a practice with a malformed owner', () => {
    const bad = { ...practice, spec: { ...practice.spec, owner: '::://' } } as any;
    expect(indexPracticesByOwner([bad]).size).toBe(0);
  });
  it('maps a practice to a compact view', () => {
    expect(practiceView(practice)).toEqual({ name: 'security-practice', title: 'Security practice', aspect: 'security' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/guilds/roster.test.ts`
Expected: FAIL — cannot find module `./roster`.

- [ ] **Step 3: Write the helpers**

```ts
// plugins/gildi/src/guilds/roster.ts
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';

const STEWARDS = 'siliconsaga.org/stewards';
const ASPECT = 'siliconsaga.org/aspect';

export function stewardAspectsOf(guild: Entity): string[] {
  return (guild.metadata.annotations?.[STEWARDS] ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .filter(s => s.startsWith('aspect:')).map(s => s.slice('aspect:'.length));
}

export function indexPracticesByOwner(practices: Entity[]): Map<string, Entity[]> {
  const byOwner = new Map<string, Entity[]>();
  for (const p of practices) {
    const owner = (p.spec?.owner as string) ?? '';
    if (!owner) continue;
    let key: string;
    try {
      key = stringifyEntityRef(parseEntityRef(owner, { defaultKind: 'Group', defaultNamespace: 'default' }));
    } catch {
      continue; // skip a malformed owner rather than failing the whole section
    }
    byOwner.set(key, [...(byOwner.get(key) ?? []), p]);
  }
  return byOwner;
}

export function practiceView(p: Entity): { name: string; title: string; aspect?: string } {
  return {
    name: p.metadata.name,
    title: p.metadata.title ?? p.metadata.name,
    aspect: p.metadata.annotations?.[ASPECT],
  };
}
```

- [ ] **Step 4: Refactor `useGuilds` to consume the helpers**

Replace the inlined logic in `plugins/gildi/src/guilds/useGuilds.ts` (the `STEWARDS`/`ASPECT` constants, the `practicesByOwner` build loop, the steward split, and the practice mapping) with calls to the helpers. The resulting body:

```ts
// plugins/gildi/src/guilds/useGuilds.ts (mapping section only — imports add the three helpers)
import { stewardAspectsOf, indexPracticesByOwner, practiceView } from './roster';
// ...inside useAsync, after the two getEntities calls:
    const practicesByOwner = indexPracticesByOwner(practicesRes.items);
    const guilds: GuildView[] = guildsRes.items.map(g => {
      const ref = stringifyEntityRef(g);
      const stewardAspects = stewardAspectsOf(g);
      const practices = (practicesByOwner.get(ref) ?? []).map(practiceView);
      return {
        name: g.metadata.name,
        title: g.metadata.title ?? g.metadata.name,
        description: g.metadata.description,
        entityRef: ref,
        stewardAspects,
        practices,
      };
    });
    return guilds;
```

Remove the now-unused inline `STEWARDS`/`ASPECT` constants from `useGuilds.ts` (they live in `roster.ts` now). Keep `stringifyEntityRef` imported (still used for `ref`).

- [ ] **Step 5: Run the roster + hub tests to verify all pass**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/guilds`
Expected: PASS — `roster.test.ts` green AND the existing `GuildsSection.test.tsx` still green (behaviour preserved).

- [ ] **Step 6: Commit**

Bodyfile `.commits/roster-helpers.md`:
```md
---
message: "refactor(gildi): extract shared guild roster helpers"
add:
  - plugins/gildi/src/guilds/roster.ts
  - plugins/gildi/src/guilds/roster.test.ts
  - plugins/gildi/src/guilds/useGuilds.ts
---

Pull the practices-by-owner indexing and steward-aspect parsing out of useGuilds
into pure, unit-tested helpers in roster.ts. Behaviour-preserving — the hub
GuildsSection is unchanged. The guild entity-page Roster card (slice 6) reuses
these instead of duplicating the query logic.
```
Run: `ws commit leidangr .commits/roster-helpers.md`

---

### Task 2: Charter card

The guild identity card — crest, title, charter prose, steward-aspect chips, featured links. Pure `useEntity()`, no catalog query.

**Files:**
- Create: `plugins/gildi/src/entity/GuildCharterCard.tsx`
- Create (test): `plugins/gildi/src/entity/GuildCharterCard.test.tsx`

**Interfaces:**
- Consumes: `Crest` from `../crest`; `stewardAspectsOf` from `../guilds/roster`.
- Produces: `GuildCharterCard` (default-less named export, no props — reads context).

- [ ] **Step 1: Write the failing test**

```tsx
// plugins/gildi/src/entity/GuildCharterCard.test.tsx
import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { GuildCharterCard } from './GuildCharterCard';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: {
    name: 'security-gildi', title: 'Security guild',
    description: 'Keeps things safe.',
    annotations: { 'siliconsaga.org/stewards': 'aspect:security' },
    links: [{ url: 'https://example.test/charter', title: 'Charter doc' }],
  },
  spec: { type: 'guild' },
} as any;

describe('GuildCharterCard', () => {
  it('renders charter prose, a steward aspect chip and a featured link', async () => {
    await renderInTestApp(
      <EntityProvider entity={guild}>
        <GuildCharterCard />
      </EntityProvider>,
    );
    expect(await screen.findByText('Keeps things safe.')).toBeInTheDocument();
    expect(screen.getByText('security aspect')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Charter doc' })).toHaveAttribute('href', 'https://example.test/charter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/entity/GuildCharterCard.test.tsx`
Expected: FAIL — cannot find module `./GuildCharterCard`.

- [ ] **Step 3: Write the card**

```tsx
// plugins/gildi/src/entity/GuildCharterCard.tsx
import { Chip, Typography } from '@material-ui/core';
import { InfoCard, Link } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import { stewardAspectsOf } from '../guilds/roster';

const CHARTER = 'siliconsaga.org/charter';

export function GuildCharterCard() {
  const { entity } = useEntity();
  const title = entity.metadata.title ?? entity.metadata.name;
  const charter = entity.metadata.annotations?.[CHARTER] ?? entity.metadata.description;
  const aspects = stewardAspectsOf(entity);
  const links = entity.metadata.links ?? [];

  return (
    <InfoCard title="Charter">
      <div style={{ display: 'flex', gap: 14 }}>
        <Crest seed={entity.metadata.name} size={52} title={`Arms of ${title}`} />
        <div style={{ minWidth: 0 }}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="textSecondary" style={{ margin: '4px 0 8px' }}>
            {charter ?? 'No charter recorded yet.'}
          </Typography>
          {aspects.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {aspects.map(a => (
                <Chip key={a} label={`${a} aspect`} size="small" variant="outlined" />
              ))}
            </div>
          )}
          {links.length > 0 && (
            <div>
              {links.map(l => (
                <div key={l.url}>
                  <Link to={l.url}>{l.title ?? l.url}</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </InfoCard>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/entity/GuildCharterCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Bodyfile `.commits/charter-card.md`:
```md
---
message: "feat(gildi): guild Charter card (crest, prose, stewards, links)"
add:
  - plugins/gildi/src/entity/GuildCharterCard.tsx
  - plugins/gildi/src/entity/GuildCharterCard.test.tsx
---

The guild identity card for the entity page — reads the guild entity directly
(crest, title, inline charter prose from siliconsaga.org/charter or the
description, steward-aspect chips, and native metadata.links). No catalog query.
Steward aspects render as labels for now (consistent with the hub GuildCard)
until the aspect slice supplies entity refs.
```
Run: `ws commit leidangr .commits/charter-card.md`

---

### Task 3: Roster card + guild-scoped roster hook

Practices (linked to their Component entity) and aspects (labels) for one guild.

**Files:**
- Create: `plugins/gildi/src/entity/useGuildRoster.ts`
- Create: `plugins/gildi/src/entity/GuildRosterCard.tsx`
- Create (test): `plugins/gildi/src/entity/GuildRosterCard.test.tsx`

**Interfaces:**
- Consumes: `indexPracticesByOwner`, `practiceView`, `stewardAspectsOf` from `../guilds/roster`; `catalogApiRef`.
- Produces:
  - `useGuildRoster(guild: Entity): { practices: {name:string;title:string;aspect?:string}[]; aspects: string[]; loading: boolean; error?: Error }`
  - `GuildRosterCard` (no props — reads entity context).

- [ ] **Step 1: Write the failing test**

```tsx
// plugins/gildi/src/entity/GuildRosterCard.test.tsx
import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { GuildRosterCard } from './GuildRosterCard';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: { name: 'security-gildi', title: 'Security guild', annotations: { 'siliconsaga.org/stewards': 'aspect:security' } },
  spec: { type: 'guild' },
} as any;

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter['spec.type'] === 'practice') {
      return { items: [{
        apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
        metadata: { name: 'security-practice', title: 'Security practice', annotations: { 'siliconsaga.org/aspect': 'security' } },
        spec: { type: 'practice', owner: 'group:default/security-gildi' },
      }] };
    }
    return { items: [] };
  },
};

describe('GuildRosterCard', () => {
  it('lists a linked practice and an aspect chip', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={guild}>
          <GuildRosterCard />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Security practice')).toBeInTheDocument();
    expect(screen.getByText('security aspect')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/entity/GuildRosterCard.test.tsx`
Expected: FAIL — cannot find module `./GuildRosterCard`.

- [ ] **Step 3: Write the hook**

```ts
// plugins/gildi/src/entity/useGuildRoster.ts
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';
import { indexPracticesByOwner, practiceView, stewardAspectsOf } from '../guilds/roster';

export function useGuildRoster(guild: Entity) {
  const catalog = useApi(catalogApiRef);
  const ref = stringifyEntityRef(guild);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Component', 'spec.type': 'practice' } });
    const practices = (indexPracticesByOwner(res.items).get(ref) ?? []).map(practiceView);
    const aspects = Array.from(new Set([
      ...stewardAspectsOf(guild),
      ...practices.map(p => p.aspect).filter(Boolean) as string[],
    ]));
    return { practices, aspects };
  }, [catalog, ref]);
  return {
    practices: state.value?.practices ?? [],
    aspects: state.value?.aspects ?? [],
    loading: state.loading,
    error: state.error,
  };
}
```

- [ ] **Step 4: Write the card**

```tsx
// plugins/gildi/src/entity/GuildRosterCard.tsx
import { Chip, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { useGuildRoster } from './useGuildRoster';

export function GuildRosterCard() {
  const { entity } = useEntity();
  const { practices, aspects } = useGuildRoster(entity);

  return (
    <InfoCard title="Roster">
      <Typography variant="subtitle2" gutterBottom>Practices</Typography>
      {practices.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {practices.map(p => (
            <Chip
              key={p.name}
              label={<EntityRefLink entityRef={`component:default/${p.name}`}>{p.title}</EntityRefLink>}
              size="small"
              variant="outlined"
            />
          ))}
        </div>
      ) : (
        <Typography variant="body2" color="textSecondary" gutterBottom>No practices yet.</Typography>
      )}
      <Typography variant="subtitle2" gutterBottom>Aspects</Typography>
      {aspects.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {aspects.map(a => (
            <Chip key={a} label={`${a} aspect`} size="small" variant="outlined" />
          ))}
        </div>
      ) : (
        <Typography variant="body2" color="textSecondary">No aspects yet.</Typography>
      )}
    </InfoCard>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/entity/GuildRosterCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

Bodyfile `.commits/roster-card.md`:
```md
---
message: "feat(gildi): guild Roster card (practices + aspects)"
add:
  - plugins/gildi/src/entity/useGuildRoster.ts
  - plugins/gildi/src/entity/GuildRosterCard.tsx
  - plugins/gildi/src/entity/GuildRosterCard.test.tsx
---

Roster card for the guild entity page — a guild-scoped hook reuses the shared
roster helpers to list the guild's practices (linked to their Component entity)
and the aspects it stewards or its practices reference (labels). Headings show
in the empty state rather than a blank card.
```
Run: `ws commit leidangr .commits/roster-card.md`

---

### Task 4: Chronicle card + guild-scoped saga/drive hooks

Recent sagas touching the guild and drives it owns. Extends the shipped hub hooks additively.

**Files:**
- Modify: `plugins/gildi/src/chronicle/useSagas.ts`
- Modify: `plugins/gildi/src/drives/useDrives.ts`
- Create: `plugins/gildi/src/entity/GuildChronicleCard.tsx`
- Create (test): `plugins/gildi/src/entity/GuildChronicleCard.test.tsx`

**Interfaces:**
- Consumes: `useSagas`, `SagaCard`; `useDrives`, `DriveCard`.
- Produces:
  - `useSagas(opts?: { guild?: string })` — when `guild` is set, keep only sagas whose `touches` resolve to that guild name.
  - `useDrives(opts?: { guild?: string; includeEnded?: boolean })` — when `guild` is set, keep only drives owned by that guild; when `includeEnded` is true, do not drop past drives.
  - `GuildChronicleCard` (no props — reads entity context).

- [ ] **Step 1: Write the failing test**

```tsx
// plugins/gildi/src/entity/GuildChronicleCard.test.tsx
import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { GuildChronicleCard } from './GuildChronicleCard';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: { name: 'security-gildi', title: 'Security guild' },
  spec: { type: 'guild' },
} as any;

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter.kind === 'Saga') {
      return { items: [{
        apiVersion: 'backstage.io/v1alpha1', kind: 'Saga',
        metadata: { name: 'dep-scan-drive', title: 'Dependency scanning drive' },
        spec: { touches: ['group:default/security-gildi'], timeframe: { end: '2026-06-01' } },
      }] };
    }
    if (filter.kind === 'Cycle' && filter['spec.type'] === 'drive') {
      return { items: [{
        apiVersion: 'backstage.io/v1alpha1', kind: 'Cycle',
        metadata: { name: 'q2-hardening', title: 'Q2 hardening drive' },
        spec: { type: 'drive', owner: 'group:default/security-gildi', timeframe: { start: '2026-04-01', end: '2026-06-30' } },
      }] };
    }
    return { items: [] };
  },
};

describe('GuildChronicleCard', () => {
  it('lists a saga touching the guild and a drive it owns', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={guild}>
          <GuildChronicleCard />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Dependency scanning drive')).toBeInTheDocument();
    expect(screen.getByText('Q2 hardening drive')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/entity/GuildChronicleCard.test.tsx`
Expected: FAIL — cannot find module `./GuildChronicleCard`.

- [ ] **Step 3: Extend `useSagas` with an optional guild filter**

In `plugins/gildi/src/chronicle/useSagas.ts`, change the signature to accept `opts` and filter the mapped views by guild before sorting:

```ts
export function useSagas(opts?: { guild?: string }) {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Saga' } });
    const views = res.items.map(s => {
      // ...unchanged mapping producing SagaView (guildName already derived from touches)...
    });
    const scoped = opts?.guild ? views.filter(v => v.guildName === opts.guild) : views;
    return scoped.sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''));
  }, [catalog, opts?.guild]);
  return { sagas: state.value ?? [], loading: state.loading, error: state.error };
}
```

(Keep the existing mapping body verbatim — only add the `opts` param, the `scoped` filter line, and `opts?.guild` in the deps array. The hub `ChronicleRail` calls `useSagas()` with no args, so `opts` is undefined and behaviour is unchanged.)

- [ ] **Step 4: Extend `useDrives` with guild + includeEnded**

In `plugins/gildi/src/drives/useDrives.ts`, add `opts` and make the active-only filter conditional:

```ts
export function useDrives(opts?: { guild?: string; includeEnded?: boolean }) {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Cycle', 'spec.type': 'drive' } });
    const views = res.items.map(c => {
      // ...unchanged mapping producing DriveView (ownerGuildName derived from spec.owner)...
    });
    const scoped = opts?.guild ? views.filter(d => d.ownerGuildName === opts.guild) : views;
    if (opts?.includeEnded) {
      return scoped.sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''));
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return scoped.filter(d => !d.end || d.end >= today);
  }, [catalog, opts?.guild, opts?.includeEnded]);
  return { drives: state.value ?? [], loading: state.loading, error: state.error };
}
```

(Keep the existing mapping body verbatim. The hub `DrivesBand` calls `useDrives()` with no args → active-only default preserved.)

- [ ] **Step 5: Write the card**

```tsx
// plugins/gildi/src/entity/GuildChronicleCard.tsx
import { Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useSagas } from '../chronicle/useSagas';
import { SagaCard } from '../chronicle/SagaCard';
import { useDrives } from '../drives/useDrives';
import { DriveCard } from '../drives/DriveCard';

const MAX = 5;

export function GuildChronicleCard() {
  const { entity } = useEntity();
  const guild = entity.metadata.name;
  const { sagas } = useSagas({ guild });
  const { drives } = useDrives({ guild, includeEnded: true });

  return (
    <InfoCard title="Chronicle">
      <Typography variant="subtitle2" gutterBottom>Recent sagas</Typography>
      {sagas.length > 0 ? (
        sagas.slice(0, MAX).map(s => <SagaCard key={s.entityRef} saga={s} />)
      ) : (
        <Typography variant="body2" color="textSecondary" gutterBottom>No sagas yet.</Typography>
      )}
      <Typography variant="subtitle2" gutterBottom style={{ marginTop: 12 }}>Drives</Typography>
      {drives.length > 0 ? (
        drives.slice(0, MAX).map(d => <DriveCard key={d.entityRef} drive={d} />)
      ) : (
        <Typography variant="body2" color="textSecondary">No drives yet.</Typography>
      )}
    </InfoCard>
  );
}
```

- [ ] **Step 6: Run the entity + hub chronicle/drives tests to verify all pass**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/entity/GuildChronicleCard.test.tsx src/chronicle src/drives`
Expected: PASS — new card green AND existing `ChronicleRail.test.tsx` / `DrivesBand.test.tsx` still green.

- [ ] **Step 7: Commit**

Bodyfile `.commits/chronicle-card.md`:
```md
---
message: "feat(gildi): guild Chronicle card (recent sagas + drives)"
add:
  - plugins/gildi/src/chronicle/useSagas.ts
  - plugins/gildi/src/drives/useDrives.ts
  - plugins/gildi/src/entity/GuildChronicleCard.tsx
  - plugins/gildi/src/entity/GuildChronicleCard.test.tsx
---

Chronicle card for the guild entity page — recent sagas touching the guild and
drives it owns. useSagas and useDrives gain optional guild-scope params
(useDrives also an includeEnded toggle so the guild page shows past drives while
the hub keeps active-only). Additive — the hub call sites pass no args and are
unchanged. Reuses SagaCard and DriveCard. Headings show in the empty state.
```
Run: `ws commit leidangr .commits/chronicle-card.md`

---

### Task 5: Register the extensions + enrich the seed

Wire the three cards as `EntityCardBlueprint` extensions gated to guild pages, and enrich one seed guild so the page fills for the visual smoke.

**Files:**
- Create: `plugins/gildi/src/entity/index.ts`
- Modify: `plugins/gildi/src/plugin.tsx`
- Modify: `plugins/gildi/src/plugin.test.tsx`
- Modify: `examples/mock-org/org.yaml`

**Interfaces:**
- Consumes: `EntityCardBlueprint` from `@backstage/plugin-catalog-react/alpha`; the three card components.
- Produces: `guildCharterCard`, `guildRosterCard`, `guildChronicleCard` extensions; the gildi plugin `extensions` array now includes them.

- [ ] **Step 1: Write the extension index**

```ts
// plugins/gildi/src/entity/index.ts
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

const guildFilter = { kind: 'Group', 'spec.type': 'guild' };

export const guildCharterCard = EntityCardBlueprint.make({
  name: 'guild-charter',
  params: {
    filter: guildFilter,
    loader: () => import('./GuildCharterCard').then(m => <m.GuildCharterCard />),
  },
});

export const guildRosterCard = EntityCardBlueprint.make({
  name: 'guild-roster',
  params: {
    filter: guildFilter,
    loader: () => import('./GuildRosterCard').then(m => <m.GuildRosterCard />),
  },
});

export const guildChronicleCard = EntityCardBlueprint.make({
  name: 'guild-chronicle',
  params: {
    filter: guildFilter,
    loader: () => import('./GuildChronicleCard').then(m => <m.GuildChronicleCard />),
  },
});
```

Note: `EntityCardBlueprint` filter uses the same object-filter shape proven by `packages/app/src/modules/cycle/index.tsx` (`{ kind: 'cycle' }`); the added `'spec.type': 'guild'` key is standard Backstage entity-filter syntax (the same shape `useGuilds` passes to `getEntities`). If tsc rejects the object form for this blueprint, switch each `filter` to a predicate: `(entity) => entity.kind === 'Group' && (entity.spec as any)?.type === 'guild'`.

- [ ] **Step 2: Register in the plugin**

In `plugins/gildi/src/plugin.tsx`, import the three extensions and add them to the array:

```ts
import { guildCharterCard, guildRosterCard, guildChronicleCard } from './entity';
// ...
export const gildiPlugin = createFrontendPlugin({
  pluginId: 'gildi',
  extensions: [guildHallPage, guildCharterCard, guildRosterCard, guildChronicleCard],
  routes: { root: rootRouteRef },
});
```

- [ ] **Step 3: Update the plugin test to assert the extensions register**

Read the current `plugins/gildi/src/plugin.test.tsx` first to match its assertion style. Add an assertion that the plugin exposes the three new extension ids. Example (adapt to the file's existing structure):

```tsx
it('registers the guild entity-decoration cards', () => {
  const ids = gildiPlugin.extensions.map((e: any) => e.id ?? e.name);
  expect(ids.join(' ')).toMatch(/guild-charter/);
  expect(ids.join(' ')).toMatch(/guild-roster/);
  expect(ids.join(' ')).toMatch(/guild-chronicle/);
});
```

- [ ] **Step 4: Run test to verify it fails, then passes**

Run: `ws exec leidangr yarn --cwd plugins/gildi test src/plugin.test.tsx`
Expected: FAIL first if written before Step 2 wiring is complete; PASS once the extensions are registered. (If you wrote Step 2 before Step 3, expect PASS directly.)

- [ ] **Step 5: Enrich the seed guild**

In `examples/mock-org/org.yaml`, on the `security-gildi` Group, add a `siliconsaga.org/charter` annotation and `metadata.links`, and confirm it already carries `siliconsaga.org/stewards` (add if absent). Exact YAML (merge into the existing entity, do not duplicate keys):

```yaml
  metadata:
    name: security-gildi
    title: Security guild
    description: Keeps the org's software safe and its incidents short.
    annotations:
      siliconsaga.org/stewards: 'aspect:security'
      siliconsaga.org/charter: >-
        The Security guild stewards the security aspect across the org — setting
        the standard, paving the road, and shepherding components up the tiers.
    links:
      - url: https://example.test/security-guild/charter
        title: Guild charter
      - url: https://example.test/security-guild/oncall
        title: On-call rota
```

Confirm a `Saga` in `examples/mock-org/sagas/` touches `security-gildi` and a `drive` Cycle in `examples/mock-org/cycles.yaml` is owned by it (the hub seed already includes `dependency-scanning-drive`). If none touch the guild, add a `touches: ['group:default/security-gildi']` to one existing saga.

- [ ] **Step 6: Run the full plugin suite + typecheck**

Run: `ws test leidangr`
Expected: PASS (all gildi unit tests + app/backend units).
Run: `ws lint leidangr`
Expected: PASS (lint + tsc clean).

- [ ] **Step 7: Commit**

Bodyfile `.commits/register-and-seed.md`:
```md
---
message: "feat(gildi): register guild entity cards + enrich seed guild"
add:
  - plugins/gildi/src/entity/index.ts
  - plugins/gildi/src/plugin.tsx
  - plugins/gildi/src/plugin.test.tsx
  - examples/mock-org/org.yaml
---

Register the Charter, Roster and Chronicle cards as EntityCardBlueprint
extensions gated to kind:Group spec.type:guild, so they mount only on guild
pages. Enrich the security-gildi seed with a charter annotation and featured
links so the decorated page fills for the visual smoke.
```
Run: `ws commit leidangr .commits/register-and-seed.md`

---

### Task 6: Visual smoke + PR

**Files:** none (verification + PR).

- [ ] **Step 1: Human-gated visual smoke**

Pause and ask the human to run the app locally (per the repo's dev docs) and load the `security-gildi` guild page. Confirm the three cards render: Charter (crest + prose + steward chip + links), Roster (practice link + aspect chip), Chronicle (saga + drive). Do not self-certify the visual — wait for the human's confirmation.

- [ ] **Step 2: Open the PR**

Once tests, lint, and the visual smoke are all green, open the CR with `ws cr` using a bodyfile from the change template (`.crs/<name>.md`). Summarize: guild entity-page decoration (slice 6) — three cards, guild-scoped hooks reusing hub query logic, seed enrichment, plus the repo-wide `.gitattributes` LF normalization that rides on this branch.

---

## Self-Review

**Spec coverage:**
- §2 three cards → Tasks 2, 3, 4. ✓
- §3 code lives in gildi + registration → Tasks 2–5, `plugin.tsx` in Task 5. ✓
- §4 Charter (useEntity, crest, charter prose, stewards, links) → Task 2. ✓ Roster (useGuildRoster, practices/aspects) → Task 3. ✓ Chronicle (guild-scoped useSagas/useDrives, SagaCard/DriveCard) → Task 4. ✓ Shared helpers not duplicated → Task 1. ✓
- §5 heading-in-all-states, ref keys, safeRef → empty-state branches in Tasks 3/4, `key={ref}` throughout, try/catch in `roster.ts`. ✓
- §6 seed enrichment → Task 5 Step 5. ✓
- §7 unit test per card + gate → Tasks 2–4 tests, Task 5 Step 6, Task 6 visual smoke. ✓
- §8 deferrals honored — no referenced-markdown, no practice/aspect/component pages, no tier ladder. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows real code. The one conditional ("if tsc rejects the object filter, use a predicate") gives the exact fallback code, not a vague instruction.

**Type consistency:** `stewardAspectsOf`/`indexPracticesByOwner`/`practiceView` defined in Task 1, consumed with matching signatures in Tasks 2–3. `useGuildRoster(entity)` returns `{practices, aspects, loading, error}` — consumed in Task 3 card. `useSagas({guild})` / `useDrives({guild, includeEnded})` param shapes match between Task 4 definition and card use. `SagaView.entityRef` / `DriveView.entityRef` used as React keys exist on the shipped view types.
