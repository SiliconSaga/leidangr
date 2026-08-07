# Gildi component adoption card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decorate the Component entity page with the adoption relationship — which aspects a component adopted, at what version, whether that version is current, and who maintains it — plus a call to action on components that have adopted none.

**Architecture:** Two `EntityCardBlueprint` extensions with complementary predicate filters, both `type: 'info'` so the stock `DefaultEntityContentLayout` routes them to the right rail. No layout is owned. A pure parsing module (`aspects.ts`) is extracted from `useAdopters` and shared by both directions of the relationship; one field-limited catalog query joins enrolled aspect ids to their practice entities.

**Tech Stack:** Backstage new frontend system (`@backstage/frontend-plugin-api` 0.17.2), `@backstage/plugin-catalog-react` 3.1.0 alpha blueprints, Material-UI v4, `react-use` for async state, Jest + `@backstage/frontend-test-utils` + `@testing-library/react` 14.

**Design:** `docs/plans/2026-08-06-gildi-component-adoption-card-design.md`

## Global Constraints

- **Workspace CLI only.** Commit with `ws commit leidangr <bodyfile>` — never raw `git commit`. Test with `ws test leidangr`, lint with `ws lint leidangr`. Never raw `yarn test` / `jest` / `eslint`.
- **Commit bodyfiles** are copied from `templates/commit.md` into `.commits/<name>.md` at the *yggdrasil workspace root*, and the `add:` paths inside are relative to the *component root* (`components/leidangr/`).
- **Change-note style is `terse`** — commit subject does the talking; body only when the diff can't show something (evidence, traps, significance). Never re-narrate the diff.
- **No hard-wrapped prose** in any markdown: one line per paragraph and per bullet.
- **Branch:** `feat/gildi-component-adoption-card`, already created, already carrying the two design commits.
- **Annotation keys are exact** — `siliconsaga.org/aspects`, `siliconsaga.org/aspect-versions`, `siliconsaga.org/adoption-record`, `siliconsaga.org/aspect`, `siliconsaga.org/module-release`. The last one is new in this plan; the practice-side key is `module-release` (scalar), never `aspect-version`.
- **Version comparison is equality only.** `behind` means "differs from current", never "N releases behind". Do not sort, parse, or otherwise order version strings.
- **The badge cell renders nothing.** Task 4 creates the trailing grid column; no tier data exists and none may be invented.
- **Comment style:** existing gildi modules carry a short "why" comment above each exported symbol. Match that density — explain intent, not mechanics.

---

## File Structure

| File | Responsibility |
|---|---|
| `plugins/gildi/src/entity/aspects.ts` | **NEW.** Annotation keys + pure parsing. No React, no API, no `Entity` beyond two small predicates. The one place that knows the annotation encodings. |
| `plugins/gildi/src/entity/aspects.test.ts` | **NEW.** Parsing and status unit tests. |
| `plugins/gildi/src/entity/useAdopters.ts` | **MODIFY.** Consume `aspects.ts` instead of inlining the same parse. |
| `plugins/gildi/src/entity/useComponentAspects.ts` | **NEW.** One catalog query; joins enrolled aspect ids to practice entities. |
| `plugins/gildi/src/entity/ComponentAspectsCard.tsx` | **NEW.** The rail card for enrolled components. |
| `plugins/gildi/src/entity/ComponentAspectsCard.test.tsx` | **NEW.** The five design §7 states plus loading and error. |
| `plugins/gildi/src/entity/AdoptAspectCard.tsx` | **NEW.** The rail card for unenrolled components. |
| `plugins/gildi/src/entity/AdoptAspectCard.test.tsx` | **NEW.** |
| `plugins/gildi/src/entity/index.tsx` | **MODIFY.** Two `EntityCardBlueprint.make()` extensions. |
| `plugins/gildi/src/entity/index.test.ts` | **NEW.** The two filter predicates, tested directly. |
| `plugins/gildi/src/plugin.tsx` | **MODIFY.** Register both extensions. |
| `plugins/gildi/src/plugin.test.tsx` | **MODIFY.** Two registration assertions. |
| `plugins/gildi/README.md` | **MODIFY.** Document the disable knob. |
| `examples/mock-org/repos/security-aspect/catalog-info.yaml` | **MODIFY.** `+1` annotation. |

---

## Task 1: The pure parsing module

Extracting first means every later task consumes tested primitives, and it removes the duplicate parser in `useAdopters` before a second copy can drift from it.

**Files:**
- Create: `plugins/gildi/src/entity/aspects.ts`
- Test: `plugins/gildi/src/entity/aspects.test.ts`
- Modify: `plugins/gildi/src/entity/useAdopters.ts` (lines 6-7 constants, lines 29-35 inline parse)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ASPECTS`, `ASPECT_VERSIONS`, `ADOPTION_RECORD`, `ASPECT`, `MODULE_RELEASE` — `string` constants.
  - `parseList(value?: string): string[]`
  - `parseKeyed(value: string | undefined, separator: string): Map<string, string>`
  - `type AdoptionStatus = 'current' | 'behind' | 'unknown'`
  - `adoptionStatus(adopted?: string, current?: string): AdoptionStatus`
  - `hasAdoptedAspects(entity: Entity): boolean`
  - `guildNameOf(entity: Entity): string | undefined`

- [ ] **Step 1: Write the failing test**

Create `plugins/gildi/src/entity/aspects.test.ts`:

```ts
import { parseList, parseKeyed, adoptionStatus, hasAdoptedAspects, guildNameOf } from './aspects';

const enrolled = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
  metadata: { name: 'carrier-gateway', annotations: { 'siliconsaga.org/aspects': 'security' } },
  spec: { type: 'service' },
} as any;

describe('parseList', () => {
  it('splits, trims, drops blanks, and dedupes', () => {
    expect(parseList('security, operational-readiness ,, security')).toEqual([
      'security', 'operational-readiness',
    ]);
  });
  it('returns an empty list for undefined or blank input', () => {
    expect(parseList(undefined)).toEqual([]);
    expect(parseList('  ,  ')).toEqual([]);
  });
});

describe('parseKeyed', () => {
  it('parses id@version pairs', () => {
    const m = parseKeyed('security@1.4, operational-readiness@2.0', '@');
    expect(m.get('security')).toBe('1.4');
    expect(m.get('operational-readiness')).toBe('2.0');
  });
  it('keeps a URL value intact by splitting on the FIRST separator only', () => {
    const m = parseKeyed('security: https://git.example/x/pull/412', ':');
    expect(m.get('security')).toBe('https://git.example/x/pull/412');
  });
  it('drops entries with no separator, an empty id, or an empty value', () => {
    const m = parseKeyed('security, @1.4, ops@', '@');
    expect(m.size).toBe(0);
  });
  it('keeps the first entry when an id repeats', () => {
    expect(parseKeyed('security@1.4, security@9.9', '@').get('security')).toBe('1.4');
  });
});

describe('adoptionStatus', () => {
  it('is current when the versions match', () => {
    expect(adoptionStatus('1.4', '1.4')).toBe('current');
  });
  it('is behind when they differ, in either direction', () => {
    expect(adoptionStatus('1.2', '1.4')).toBe('behind');
    expect(adoptionStatus('9.9', '1.4')).toBe('behind');
  });
  it('is unknown when either side is missing', () => {
    expect(adoptionStatus(undefined, '1.4')).toBe('unknown');
    expect(adoptionStatus('1.2', undefined)).toBe('unknown');
  });
});

describe('hasAdoptedAspects', () => {
  it('is true for a component with a non-empty aspects annotation', () => {
    expect(hasAdoptedAspects(enrolled)).toBe(true);
  });
  it('is false for a missing, blank, or comma-only annotation', () => {
    expect(hasAdoptedAspects({ metadata: {} } as any)).toBe(false);
    expect(hasAdoptedAspects({ metadata: { annotations: { 'siliconsaga.org/aspects': ' ' } } } as any)).toBe(false);
    expect(hasAdoptedAspects({ metadata: { annotations: { 'siliconsaga.org/aspects': ' , ' } } } as any)).toBe(false);
  });
});

describe('guildNameOf', () => {
  it('reads the owning group name from spec.owner', () => {
    expect(guildNameOf({ metadata: {}, spec: { owner: 'group:default/security-gildi' } } as any))
      .toBe('security-gildi');
  });
  it('defaults a bare owner ref to a Group', () => {
    expect(guildNameOf({ metadata: {}, spec: { owner: 'security-gildi' } } as any)).toBe('security-gildi');
  });
  it('is undefined for a non-group owner, a malformed ref, or no owner', () => {
    expect(guildNameOf({ metadata: {}, spec: { owner: 'user:default/astrid' } } as any)).toBeUndefined();
    expect(guildNameOf({ metadata: {}, spec: { owner: '::://' } } as any)).toBeUndefined();
    expect(guildNameOf({ metadata: {}, spec: {} } as any)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `ws test leidangr`
Expected: FAIL — `Cannot find module './aspects'`.

- [ ] **Step 3: Write the implementation**

Create `plugins/gildi/src/entity/aspects.ts`:

```ts
import { parseEntityRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';

// The guildhall adoption annotations. Component-side keys are MAPS keyed by
// aspect id; the practice-side key is a SCALAR — a practice maintains exactly
// one aspect, so its release can never become keyed. That shape difference is
// why the practice key is `module-release` and not `aspect-version`.
export const ASPECTS = 'siliconsaga.org/aspects';
export const ASPECT_VERSIONS = 'siliconsaga.org/aspect-versions';
export const ADOPTION_RECORD = 'siliconsaga.org/adoption-record';
export const ASPECT = 'siliconsaga.org/aspect';
export const MODULE_RELEASE = 'siliconsaga.org/module-release';

// 'a, b ,, a' -> ['a','b']. Deduped so callers get stable React keys.
export function parseList(value?: string): string[] {
  return [...new Set((value ?? '').split(',').map(s => s.trim()).filter(Boolean))];
}

// Comma-separated '<id><sep><value>' entries -> Map. Splits on the FIRST
// separator so a URL value keeps its own colons. Entries missing the
// separator, the id, or the value are dropped rather than half-guessed; a
// repeated id keeps its first entry.
export function parseKeyed(value: string | undefined, separator: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of (value ?? '').split(',')) {
    const at = entry.indexOf(separator);
    if (at < 0) continue;
    const id = entry.slice(0, at).trim();
    const v = entry.slice(at + separator.length).trim();
    if (id && v && !out.has(id)) out.set(id, v);
  }
  return out;
}

export type AdoptionStatus = 'current' | 'behind' | 'unknown';

// Equality, never ordering: these are opaque module release tags and the
// registry has never committed to a versioning scheme, so 'behind' means
// 'differs from current' and the card must not claim how far.
export function adoptionStatus(adopted?: string, current?: string): AdoptionStatus {
  if (!adopted || !current) return 'unknown';
  return adopted === current ? 'current' : 'behind';
}

// The enrollment test behind the card filters — a blank or comma-only
// annotation counts as unenrolled, not as an empty enrollment.
export function hasAdoptedAspects(entity: Entity): boolean {
  return parseList(entity.metadata.annotations?.[ASPECTS]).length > 0;
}

// The stewarding guild's name, for seeding its crest. Undefined for a
// non-group or malformed owner rather than throwing — a bad ref should cost
// one crest, not the whole card.
export function guildNameOf(entity: Entity): string | undefined {
  const owner = (entity.spec?.owner as string) ?? '';
  if (!owner) return undefined;
  try {
    const ref = parseEntityRef(owner, { defaultKind: 'Group', defaultNamespace: 'default' });
    return ref.kind.toLowerCase() === 'group' ? ref.name : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `ws test leidangr`
Expected: PASS — all of `aspects.test.ts`.

- [ ] **Step 5: Refactor `useAdopters` onto the shared module**

In `plugins/gildi/src/entity/useAdopters.ts`, delete the two local constants (lines 6-7) and replace the inline parse. The whole file becomes:

```ts
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { ASPECTS, ASPECT_VERSIONS, parseKeyed, parseList } from './aspects';

export interface AdopterView {
  name: string;
  title: string;
  entityRef: string;
  version?: string;
}

// Components that adopted a given aspect: those whose siliconsaga.org/aspects
// annotation includes it, with the adopted version from the aspect-versions
// map. Parsing is shared with the component-side card via ./aspects.
export function useAdopters(aspectId?: string) {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    if (!aspectId) return [];
    const res = await catalog.getEntities({
      filter: { kind: 'Component' },
      // only the fields the reducer reads — avoid pulling full Component bodies
      fields: ['kind', 'metadata.name', 'metadata.title', 'metadata.namespace', 'metadata.annotations'],
    });
    return res.items.reduce<AdopterView[]>((acc, c) => {
      if (!parseList(c.metadata.annotations?.[ASPECTS]).includes(aspectId)) return acc;
      acc.push({
        name: c.metadata.name,
        title: c.metadata.title ?? c.metadata.name,
        entityRef: stringifyEntityRef(c),
        version: parseKeyed(c.metadata.annotations?.[ASPECT_VERSIONS], '@').get(aspectId),
      });
      return acc;
    }, []);
  }, [catalog, aspectId]);
  return { adopters: state.value ?? [], loading: state.loading, error: state.error };
}
```

- [ ] **Step 6: Run the full suite to verify the refactor is behaviour-preserving**

Run: `ws test leidangr`
Expected: PASS — `aspects.test.ts` and the pre-existing `AdoptersCard.test.tsx` both green. `AdoptersCard.test.tsx` is unmodified, so its passing is the regression evidence that the extraction changed nothing.

- [ ] **Step 7: Lint**

Run: `ws lint leidangr`
Expected: clean.

- [ ] **Step 8: Commit**

Copy `templates/commit.md` to `.commits/gildi-aspects-module.md`, then set its frontmatter and body:

```yaml
---
message: "refactor(gildi): extract shared aspect annotation parsing"
add:
  - plugins/gildi/src/entity/aspects.ts
  - plugins/gildi/src/entity/aspects.test.ts
  - plugins/gildi/src/entity/useAdopters.ts
---

AdoptersCard's unchanged tests are the evidence the extraction is behaviour-preserving.
parseKeyed splits on the first separator only, so an adoption-record URL keeps its own colons.
```

Run: `ws commit leidangr .commits/gildi-aspects-module.md`

---

## Task 2: The join hook

**Files:**
- Create: `plugins/gildi/src/entity/useComponentAspects.ts`

**Interfaces:**
- Consumes: from Task 1 — `ASPECT`, `ASPECTS`, `ASPECT_VERSIONS`, `ADOPTION_RECORD`, `MODULE_RELEASE`, `parseList`, `parseKeyed`, `adoptionStatus`, `guildNameOf`, `AdoptionStatus`.
- Produces:
  - `interface AspectAdoptionView { aspectId: string; adoptedVersion?: string; currentRelease?: string; status: AdoptionStatus; practiceRef?: string; practiceTitle?: string; guildName?: string; recordUrl?: string }`
  - `useComponentAspects(entity: Entity): { aspects: AspectAdoptionView[]; loading: boolean; error?: Error }`

This task has no test of its own — the hook is exercised end-to-end through `ComponentAspectsCard.test.tsx` in Task 4, which is where its output is observable. Writing a separate hook test would mean rendering a probe component to assert the same joins the card test already asserts.

- [ ] **Step 1: Write the implementation**

Create `plugins/gildi/src/entity/useComponentAspects.ts`:

```ts
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';
import {
  ADOPTION_RECORD, ASPECT, ASPECTS, ASPECT_VERSIONS, MODULE_RELEASE,
  adoptionStatus, guildNameOf, parseKeyed, parseList, type AdoptionStatus,
} from './aspects';

export interface AspectAdoptionView {
  aspectId: string;
  adoptedVersion?: string;
  currentRelease?: string;
  status: AdoptionStatus;
  practiceRef?: string;
  practiceTitle?: string;
  guildName?: string;
  recordUrl?: string;
}

// One row per aspect this component adopted, joined to the practice that
// maintains it. An aspect can exist before a guild forms a practice around it
// (design §3.2), so practiceRef and currentRelease resolve INDEPENDENTLY —
// having an aspect id never implies there is a practice to link to.
export function useComponentAspects(entity: Entity) {
  const catalog = useApi(catalogApiRef);
  // Depend on the raw annotation strings, not the annotations object: a new
  // object identity per render would re-run the query every time.
  const aspectsRaw = entity.metadata.annotations?.[ASPECTS];
  const versionsRaw = entity.metadata.annotations?.[ASPECT_VERSIONS];
  const recordsRaw = entity.metadata.annotations?.[ADOPTION_RECORD];

  const state = useAsync(async () => {
    const ids = parseList(aspectsRaw);
    if (ids.length === 0) return [];

    const res = await catalog.getEntities({
      filter: { kind: 'Component', 'spec.type': 'practice' },
      fields: [
        'kind', 'metadata.name', 'metadata.title', 'metadata.namespace',
        'metadata.annotations', 'spec.owner',
      ],
    });
    const byAspect = new Map<string, Entity>();
    for (const p of res.items) {
      const id = p.metadata.annotations?.[ASPECT];
      if (id && !byAspect.has(id)) byAspect.set(id, p);
    }

    const versions = parseKeyed(versionsRaw, '@');
    const records = parseKeyed(recordsRaw, ':');

    return ids.map<AspectAdoptionView>(aspectId => {
      const practice = byAspect.get(aspectId);
      const adoptedVersion = versions.get(aspectId);
      const currentRelease = practice?.metadata.annotations?.[MODULE_RELEASE];
      return {
        aspectId,
        adoptedVersion,
        currentRelease,
        status: adoptionStatus(adoptedVersion, currentRelease),
        practiceRef: practice ? stringifyEntityRef(practice) : undefined,
        practiceTitle: practice ? practice.metadata.title ?? practice.metadata.name : undefined,
        guildName: practice ? guildNameOf(practice) : undefined,
        recordUrl: records.get(aspectId),
      };
    });
  }, [catalog, aspectsRaw, versionsRaw, recordsRaw]);

  return { aspects: state.value ?? [], loading: state.loading, error: state.error };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `ws lint leidangr`
Expected: clean (the lint adapter runs `tsc`, so this is the type gate).

- [ ] **Step 3: Commit**

Copy `templates/commit.md` to `.commits/gildi-component-aspects-hook.md`:

```yaml
---
message: "feat(gildi): join a component's adopted aspects to their practices"
add:
  - plugins/gildi/src/entity/useComponentAspects.ts
---

Depends on the raw annotation strings rather than the annotations object, which would re-query on every render.
practiceRef and currentRelease resolve independently — an aspect can exist before a practice forms around it.
```

Run: `ws commit leidangr .commits/gildi-component-aspects-hook.md`

---

## Task 3: The enrolled-component card

**Files:**
- Create: `plugins/gildi/src/entity/ComponentAspectsCard.tsx`
- Test: `plugins/gildi/src/entity/ComponentAspectsCard.test.tsx`

**Interfaces:**
- Consumes: from Task 2 — `useComponentAspects`, `AspectAdoptionView`. From the existing crest module — `Crest` (`{ seed: string; size?: number; title?: string }`, renders `null` on an empty seed).
- Produces: `ComponentAspectsCard(): JSX.Element` — a default export is *not* used; import it by name.

- [ ] **Step 1: Write the failing test**

Create `plugins/gildi/src/entity/ComponentAspectsCard.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { ComponentAspectsCard } from './ComponentAspectsCard';

const practices = {
  getEntities: async () => ({
    items: [
      {
        apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
        metadata: {
          name: 'security-practice', title: 'Security practice',
          annotations: {
            'siliconsaga.org/aspect': 'security',
            'siliconsaga.org/module-release': '1.4',
          },
        },
        spec: { type: 'practice', owner: 'group:default/security-gildi' },
      },
    ],
  }),
} as any;

const component = (annotations: Record<string, string>) => ({
  apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
  metadata: { name: 'a-component', annotations },
  spec: { type: 'service' },
}) as any;

const render = async (entity: any, catalogApi: any = practices) =>
  renderInTestApp(
    <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
      <EntityProvider entity={entity}>
        <ComponentAspectsCard />
      </EntityProvider>
    </TestApiProvider>,
    { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
  );

describe('ComponentAspectsCard', () => {
  it('marks an adoption at the current release as current, and links its record', async () => {
    await render(component({
      'siliconsaga.org/aspects': 'security',
      'siliconsaga.org/aspect-versions': 'security@1.4',
      'siliconsaga.org/adoption-record': 'security: https://git.example/x/pull/412',
    }));
    expect(await screen.findByText('security')).toBeInTheDocument();
    expect(screen.getByText('v1.4')).toBeInTheDocument();
    expect(screen.getByText('current')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'record' })).toHaveAttribute(
      'href', 'https://git.example/x/pull/412',
    );
  });

  it('reports a differing version as behind and names the current release, without claiming a distance', async () => {
    await render(component({
      'siliconsaga.org/aspects': 'security',
      'siliconsaga.org/aspect-versions': 'security@1.2',
    }));
    expect(await screen.findByText('v1.2')).toBeInTheDocument();
    expect(screen.getByText('behind · current 1.4')).toBeInTheDocument();
    expect(screen.queryByText(/release behind/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'record' })).not.toBeInTheDocument();
  });

  it('links the maintaining practice and shows its guild crest', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }));
    expect(await screen.findByText('Security practice')).toBeInTheDocument();
    expect(screen.getByLabelText('Arms of security-gildi')).toBeInTheDocument();
  });

  it('renders an aspect with no practice as enrolled only — no link, no verdict', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'operational-readiness' }));
    expect(await screen.findByText('operational-readiness')).toBeInTheDocument();
    expect(screen.getByText('enrolled')).toBeInTheDocument();
    expect(screen.queryByText(/current/)).not.toBeInTheDocument();
    expect(screen.queryByText(/behind/)).not.toBeInTheDocument();
  });

  it('renders one row per aspect, resolving each independently', async () => {
    await render(component({
      'siliconsaga.org/aspects': 'security, operational-readiness',
      'siliconsaga.org/aspect-versions': 'security@1.4',
    }));
    expect(await screen.findByText('security')).toBeInTheDocument();
    expect(screen.getByText('operational-readiness')).toBeInTheDocument();
    expect(screen.getByText('current')).toBeInTheDocument();
    expect(screen.getByText('enrolled')).toBeInTheDocument();
  });

  it('reserves the badge cell on every row without rendering anything in it', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }));
    const badge = await screen.findByTestId('aspect-badge-security');
    expect(badge).toBeInTheDocument();
    expect(badge).toBeEmptyDOMElement();
  });

  it('shows a spinner while the practices load', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }), {
      getEntities: () => new Promise(() => {}),
    } as any);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows an error panel when the catalog query fails', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }), {
      getEntities: async () => { throw new Error('catalog boom'); },
    } as any);
    expect((await screen.findAllByText(/catalog boom/)).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `ws test leidangr`
Expected: FAIL — `Cannot find module './ComponentAspectsCard'`.

- [ ] **Step 3: Write the implementation**

Create `plugins/gildi/src/entity/ComponentAspectsCard.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { Chip, Divider, Link, Typography } from '@material-ui/core';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import { useComponentAspects, type AspectAdoptionView } from './useComponentAspects';

// Three columns: [identity] [body] [badge]. The identity column keeps its
// width when no crest resolves so rows stay aligned down the card, and the
// trailing column is the reserved home for the earned tier badge (hub design
// §8 — the badge belongs to the component, not the aspect).
const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px 1fr auto',
  gap: 8,
  alignItems: 'start',
  padding: '8px 0',
};

// The verdict line. 'enrolled' rather than a guess whenever either version is
// missing, and never a distance — see ./aspects adoptionStatus.
function verdict(a: AspectAdoptionView): string {
  if (a.status === 'current') return 'current';
  if (a.status === 'behind') return `behind · current ${a.currentRelease}`;
  return 'enrolled';
}

function AspectRow({ aspect }: { aspect: AspectAdoptionView }) {
  return (
    <div style={row}>
      <div>
        {aspect.guildName && (
          <Crest seed={aspect.guildName} size={24} title={`Arms of ${aspect.guildName}`} />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography variant="body2">{aspect.aspectId}</Typography>
          {aspect.adoptedVersion && (
            <Chip label={`v${aspect.adoptedVersion}`} size="small" variant="outlined" />
          )}
        </div>
        <Typography variant="caption" color="textSecondary">{verdict(aspect)}</Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {aspect.practiceRef && (
            <EntityRefLink entityRef={aspect.practiceRef}>{aspect.practiceTitle}</EntityRefLink>
          )}
          {aspect.recordUrl && (
            <Link href={aspect.recordUrl} target="_blank" rel="noopener noreferrer">record</Link>
          )}
        </div>
      </div>
      {/* Reserved for the earned tier badge. Empty today: no tier data exists,
          and a visible placeholder on every row reads as a broken card. */}
      <div data-testid={`aspect-badge-${aspect.aspectId}`} />
    </div>
  );
}

// The adoption story read from the component's end: which aspects it adopted,
// at which version, and whether that is the practice's current release.
export function ComponentAspectsCard() {
  const { entity } = useEntity();
  const { aspects, loading, error } = useComponentAspects(entity);

  let body;
  if (loading) {
    body = <Progress />;
  } else if (error) {
    body = <ResponseErrorPanel error={error} />;
  } else {
    body = aspects.map((a, i) => (
      <div key={a.aspectId}>
        {i > 0 && <Divider />}
        <AspectRow aspect={a} />
      </div>
    ));
  }

  return <InfoCard title="Aspects">{body}</InfoCard>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `ws test leidangr`
Expected: PASS — all eight `ComponentAspectsCard` cases.

- [ ] **Step 5: Lint**

Run: `ws lint leidangr`
Expected: clean.

- [ ] **Step 6: Commit**

Copy `templates/commit.md` to `.commits/gildi-component-aspects-card.md`:

```yaml
---
message: "feat(gildi): Aspects card on adopting component pages"
add:
  - plugins/gildi/src/entity/ComponentAspectsCard.tsx
  - plugins/gildi/src/entity/ComponentAspectsCard.test.tsx
---

Rows are a three-column grid whose trailing cell is the reserved, deliberately empty home for the future tier badge — adding it later is a change inside the row, not a re-layout.
An aspect with no practice renders 'enrolled' with no link and no verdict; the test asserts the absence of a distance claim.
```

Run: `ws commit leidangr .commits/gildi-component-aspects-card.md`

---

## Task 4: The call-to-action card

**Files:**
- Create: `plugins/gildi/src/entity/AdoptAspectCard.tsx`
- Test: `plugins/gildi/src/entity/AdoptAspectCard.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks — this card reads no annotations, because its filter has already established there are none.
- Produces: `AdoptAspectCard(): JSX.Element`

**Verify before implementing:** the design leaves the Create-page filter query-parameter form unpinned. Check the running app or `@backstage/plugin-scaffolder` docs for how the Create page reads type filters from the URL. If a filter form cannot be confirmed, use plain `/create` — a working link to an unfiltered Create page beats a filtered link that 404s or silently ignores the parameter. Record which you chose in the commit body.

- [ ] **Step 1: Write the failing test**

Create `plugins/gildi/src/entity/AdoptAspectCard.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { AdoptAspectCard } from './AdoptAspectCard';

describe('AdoptAspectCard', () => {
  it('invites adoption and routes to the Create page without a full page reload', async () => {
    await renderInTestApp(<AdoptAspectCard />);
    expect(await screen.findByText('Not enrolled in any aspect.')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /adopt an aspect/i });
    // A react-router Link renders a relative href; an <a href> to an absolute
    // URL would mean a full page reload — the pattern the 2026-07-22 review flagged.
    expect(cta.getAttribute('href')).toMatch(/^\/create/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `ws test leidangr`
Expected: FAIL — `Cannot find module './AdoptAspectCard'`.

- [ ] **Step 3: Write the implementation**

Create `plugins/gildi/src/entity/AdoptAspectCard.tsx`. If Step 0's check confirmed a filter form, append it to the `to` prop; otherwise leave it as `/create`.

```tsx
import { Button, Typography } from '@material-ui/core';
import { Link as RouterLink } from 'react-router-dom';
import { InfoCard } from '@backstage/core-components';

// The unenrolled half of the adoption decoration: a component that has adopted
// no aspect gets the Create-page door rather than an empty card. Gated by
// extension config (see the plugin README) so an organisation that finds this
// naggy can switch it off without code.
export function AdoptAspectCard() {
  return (
    <InfoCard title="Aspects">
      <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
        Not enrolled in any aspect.
      </Typography>
      {/* Router Link, not <a href> — an anchor would full-page-reload the app. */}
      <Button component={RouterLink} to="/create" variant="outlined" size="small">
        Adopt an aspect
      </Button>
    </InfoCard>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `ws test leidangr`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `ws lint leidangr`
Expected: clean.

- [ ] **Step 6: Commit**

Copy `templates/commit.md` to `.commits/gildi-adopt-aspect-card.md`:

```yaml
---
message: "feat(gildi): call-to-action card on unenrolled components"
add:
  - plugins/gildi/src/entity/AdoptAspectCard.tsx
  - plugins/gildi/src/entity/AdoptAspectCard.test.tsx
---

Router Link rather than an anchor, so the Create-page door does not full-page-reload the app the way the Actions panel does.
```

Add one line to that body recording whether the Create-page link is filtered or plain, and why.

Run: `ws commit leidangr .commits/gildi-adopt-aspect-card.md`

---

## Task 5: Extensions, registration, and the config knob

**Files:**
- Modify: `plugins/gildi/src/entity/index.tsx`
- Test: `plugins/gildi/src/entity/index.test.ts` (create)
- Modify: `plugins/gildi/src/plugin.tsx:21`
- Modify: `plugins/gildi/src/plugin.test.tsx` (append a describe block)
- Modify: `plugins/gildi/README.md`

**Interfaces:**
- Consumes: from Task 1 — `hasAdoptedAspects`. From Tasks 3-4 — `ComponentAspectsCard`, `AdoptAspectCard`.
- Produces: `componentAspectsCard`, `componentAdoptCard` extensions, and the exported predicates `isAdoptingComponent` / `isUnenrolledComponent` for direct testing.

- [ ] **Step 1: Write the failing test**

Create `plugins/gildi/src/entity/index.test.ts`:

```ts
import { isAdoptingComponent, isUnenrolledComponent } from './index';

const entity = (kind: string, annotations: Record<string, string> = {}) => ({
  apiVersion: 'backstage.io/v1alpha1', kind,
  metadata: { name: 'x', annotations },
  spec: { type: 'service' },
}) as any;

const ENROLLED = { 'siliconsaga.org/aspects': 'security' };

describe('component card filters', () => {
  it('are complements on Components — exactly one matches any given component', () => {
    for (const e of [entity('Component', ENROLLED), entity('Component')]) {
      expect(isAdoptingComponent(e)).toBe(!isUnenrolledComponent(e));
    }
  });

  it('match an enrolled component only for the aspects card', () => {
    const e = entity('Component', ENROLLED);
    expect(isAdoptingComponent(e)).toBe(true);
    expect(isUnenrolledComponent(e)).toBe(false);
  });

  it('match an unenrolled component only for the adopt card', () => {
    const e = entity('Component');
    expect(isAdoptingComponent(e)).toBe(false);
    expect(isUnenrolledComponent(e)).toBe(true);
  });

  it('treat a blank annotation as unenrolled', () => {
    const e = entity('Component', { 'siliconsaga.org/aspects': ' , ' });
    expect(isAdoptingComponent(e)).toBe(false);
    expect(isUnenrolledComponent(e)).toBe(true);
  });

  it('match NEITHER for a non-Component kind, however annotated', () => {
    for (const kind of ['Group', 'Template', 'API', 'Resource']) {
      expect(isAdoptingComponent(entity(kind, ENROLLED))).toBe(false);
      expect(isUnenrolledComponent(entity(kind))).toBe(false);
    }
  });
});
```

Append to `plugins/gildi/src/plugin.test.tsx`, inside the existing `describe('gildi entity overview layouts')` block's file (a new top-level describe):

```tsx
describe('gildi component adoption cards', () => {
  const getExtension = (id: string) =>
    (gildiPlugin as unknown as { getExtension(id: string): unknown }).getExtension(id);

  it('registers the enrolled-component aspects card', () => {
    expect(getExtension('entity-card:gildi/component-aspects')).toBeDefined();
  });

  it('registers the unenrolled-component adopt card', () => {
    expect(getExtension('entity-card:gildi/component-adopt')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `ws test leidangr`
Expected: FAIL — `isAdoptingComponent is not a function`, and both `getExtension` lookups throw for unwired ids.

- [ ] **Step 3: Write the implementation**

Append to `plugins/gildi/src/entity/index.tsx`:

```tsx
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';
import { hasAdoptedAspects } from './aspects';

// Complementary predicates over Components. Exported so the gating is tested
// directly rather than only through a rendered app — the filters are the whole
// reason these cards do not appear on every entity in the catalog.
export const isAdoptingComponent = (entity: Entity) =>
  entity.kind.toLowerCase() === 'component' && hasAdoptedAspects(entity);

export const isUnenrolledComponent = (entity: Entity) =>
  entity.kind.toLowerCase() === 'component' && !hasAdoptedAspects(entity);

// Both are `info` cards, which is what puts them in the stock right rail:
// DefaultEntityContentLayout partitions cards into an info area (1fr) and a
// content area (2fr). That is how we get deliberate placement WITHOUT owning
// the Component overview layout — see design §2.
export const componentAspectsCard = EntityCardBlueprint.make({
  name: 'component-aspects',
  params: {
    type: 'info',
    filter: isAdoptingComponent,
    loader: async () => {
      const { ComponentAspectsCard } = await import('./ComponentAspectsCard');
      return <ComponentAspectsCard />;
    },
  },
});

// Disable in app-config to switch off the call to action:
//   app.extensions: [ 'entity-card:gildi/component-adopt': false ]
export const componentAdoptCard = EntityCardBlueprint.make({
  name: 'component-adopt',
  params: {
    type: 'info',
    filter: isUnenrolledComponent,
    loader: async () => {
      const { AdoptAspectCard } = await import('./AdoptAspectCard');
      return <AdoptAspectCard />;
    },
  },
});
```

In `plugins/gildi/src/plugin.tsx`, extend the import on line 4 and the `extensions` array on line 21:

```tsx
import {
  guildOverviewLayout, practiceOverviewLayout,
  componentAspectsCard, componentAdoptCard,
} from './entity';
```

```tsx
  extensions: [
    guildHallPage, guildOverviewLayout, practiceOverviewLayout,
    componentAspectsCard, componentAdoptCard,
  ],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `ws test leidangr`
Expected: PASS — `index.test.ts` and both new `plugin.test.tsx` assertions.

- [ ] **Step 5: Document the knob**

In `plugins/gildi/README.md`, add a `## Configuration` section after `## Install`:

```markdown
## Configuration

Components that have adopted no aspect show an "Adopt an aspect" call to action pointing at the Create page. Switch it off in `app-config.yaml` — the card then never mounts:

    app:
      extensions:
        - entity-card:gildi/component-adopt: false

The Aspects card on components that *have* adopted one is not gated; it only renders where there is something to show.
```

- [ ] **Step 6: Lint**

Run: `ws lint leidangr`
Expected: clean.

- [ ] **Step 7: Commit**

Copy `templates/commit.md` to `.commits/gildi-adoption-card-extensions.md`:

```yaml
---
message: "feat(gildi): register the component adoption cards as rail extensions"
add:
  - plugins/gildi/src/entity/index.tsx
  - plugins/gildi/src/entity/index.test.ts
  - plugins/gildi/src/plugin.tsx
  - plugins/gildi/src/plugin.test.tsx
  - plugins/gildi/README.md
---

Two complementary filters instead of one card branching internally, so the call to action is disabled through the native app.extensions surface and never mounts — no custom config schema.
The predicates are exported and tested directly; they are the only thing keeping these cards off every entity in the catalog.
```

Run: `ws commit leidangr .commits/gildi-adoption-card-extensions.md`

---

## Task 6: Seed the current release, then the full gate

**Files:**
- Modify: `examples/mock-org/repos/security-aspect/catalog-info.yaml:12`

**Interfaces:**
- Consumes: `MODULE_RELEASE` from Task 1 — the key must match exactly.
- Produces: the seed data that makes every design §7 state reachable in the running app.

- [ ] **Step 1: Add the annotation**

In `examples/mock-org/repos/security-aspect/catalog-info.yaml`, after the `siliconsaga.org/aspect` line, add:

```yaml
    # The module's current release — the practice is the catalog face of the
    # aspect module, so the release number is a fact about the practice. Mirrors
    # `version` in guildhall/aspects.yaml, which the frontend cannot read (that
    # registry is a raw file, not a catalog entity). Components record what they
    # adopted in siliconsaga.org/aspect-versions; the gap is what a drive closes.
    siliconsaga.org/module-release: '1.4'
```

- [ ] **Step 2: Run the full gate**

Run: `ws test leidangr`
Expected: PASS — the whole suite including the pre-existing smoke tests.

Run: `ws lint leidangr`
Expected: clean.

- [ ] **Step 3: Commit**

Copy `templates/commit.md` to `.commits/gildi-seed-module-release.md`:

```yaml
---
message: "feat(seed): record the security module's current release on the practice"
add:
  - examples/mock-org/repos/security-aspect/catalog-info.yaml
---

Makes currency computable in the frontend: aspects.yaml knows the release but is a raw file, not a catalog entity.
Turns carrier-gateway (1.2) and intake-scanner (1.3) into live 'behind' states against shipping-orchestrator's current 1.4.
```

Run: `ws commit leidangr .commits/gildi-seed-module-release.md`

- [ ] **Step 4: Human visual acceptance — STOP HERE**

This step is the human's, not the agent's. Do not mark it done on your own behalf, and do not open the CR before it passes.

Start the app per `docs/development/local-dev.md` and check each entity page:

| Entity page | Expected |
|---|---|
| `shipping-orchestrator` | Aspects card **in the right rail**; `security` `v1.4`, "current", crest, practice link, and a "record" link |
| `carrier-gateway` | `security` `v1.2`, "behind · current 1.4", no record link |
| `intake-scanner` | `security` `v1.3`, "behind · current 1.4" |
| `tracking-api` | two rows; `security` current, `operational-readiness` "enrolled" with **no** crest, no link, no verdict — and the two rows still align |
| `label-service` | the "Adopt an aspect" card; the button navigates without a full page reload |
| `security-practice` | unchanged — the practice page still renders its own layout, not these cards |
| any `Group` or the `security` `Template` | neither card appears |

Report back what the rail actually looks like — spacing, crest size against the text, and whether the verdict wording reads right in place.

---

## Task 7: Open the CR

Only after Task 6 Step 4 passes.

- [ ] **Step 1: Push**

Run: `ws push leidangr`

- [ ] **Step 2: Draft the CR body**

Copy `templates/change.md` to `.crs/gildi-component-adoption-card.md` and fill it from the design doc — never write the body from memory, the template evolves.

- [ ] **Step 3: Open the CR**

Run: `ws cr leidangr "feat(gildi): component adoption decoration" .crs/gildi-component-adoption-card.md`

- [ ] **Step 4: Triage review**

Run: `ws review leidangr <cr#>` and work the findings. Expect several bot rounds; budget more than one. Do not reply on CodeRabbit threads when simply addressing a finding — it self-resolves on push.

---

## Self-Review

**Spec coverage.** Design §2 (appended rail cards, `type: 'info'`) → Task 5. §3 (two extensions, native gate, README) → Task 5. §4 (`module-release`, equality-only comparison) → Tasks 1 and 6. §5 (file layout, `aspects.ts` extraction) → Task 1. §6 (data flow, independent resolution) → Task 2. §7 (all five states + loading + error) → Task 3 tests and Task 6 Step 4. §8 (three-column grid, crest, empty badge cell, router Link) → Tasks 3 and 4. §9 (testing) → every task. §10 out-of-scope items are absent from the plan, as intended.

**Placeholder scan.** One deliberate open question survives, in Task 4: the Create-page filter query-parameter form. It is not a placeholder — it carries a stated verification step, a concrete fallback (`/create`), and a rule for choosing. Pinning a guessed query parameter in the plan would be worse than naming the uncertainty.

**Type consistency.** `AdoptionStatus` and `adoptionStatus` are defined in Task 1 and consumed under those names in Tasks 2 and 3. `AspectAdoptionView` field names (`aspectId`, `adoptedVersion`, `currentRelease`, `status`, `practiceRef`, `practiceTitle`, `guildName`, `recordUrl`) are defined in Task 2 and used unchanged in Task 3's `AspectRow` and `verdict`. `hasAdoptedAspects` is defined in Task 1 and consumed in Task 5. `Crest`'s props match its existing signature. `currentRelease` is used consistently — the design's earlier `currentVersion` does not appear anywhere in this plan.
