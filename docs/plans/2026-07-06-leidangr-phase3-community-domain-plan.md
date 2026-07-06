# Leiðangr Phase 3 — Community Domain Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom `Cycle` catalog kind (spec validation + relation emission via a catalog backend module) and a hand-authored MTL catalog seed to the `leidangr` Backstage app, with test coverage, so the admin surface shows a real community hierarchy.

**Architecture:** A new catalog backend module (`pluginId: 'catalog'`) registers a `CycleProcessor` that (a) validates `Cycle` entities in `validateEntityKind` and (b) emits **built-in** relation types (`ownedBy`/`ownerOf`, `partOf`/`hasPart`, `dependsOn`/`dependencyOf`) in `postProcessEntity`. A hand-authored `examples/mtl.yaml` seed (Group tree + Domain/System/Resource/Component + one `Cycle`) is registered as a catalog location. Occurrences are not modeled (queried later). Saga and TeamSnap ingestion are out of scope (deferred per the design).

**Tech Stack:** Backstage 1.52.0 (new frontend + backend systems), TypeScript 5.8, `@backstage/plugin-catalog-node` 2.2.2, `@backstage/backend-plugin-api` 1.9.2, `@backstage/catalog-model` 1.9.0; tests via `backstage-cli repo test` (units) and jest-cucumber + `@swc/jest` (envelope BDD); Corepack `yarn@4.13.0`, Node 22||24.

**Design:** `./2026-07-06-leidangr-phase3-community-domain-design.md` (co-located in this repo). Implementation happens here in the `leidangr` component repo.

## Global Constraints

- **Backstage version:** 1.52.0. New backend system (`createBackend()` + `backend.add(import(...))`) and new frontend system — no `EntityPage.tsx` switch, no legacy `CatalogBuilder`.
- **Custom kind envelope:** `apiVersion: siliconsaga.org/v1alpha1`, `kind: Cycle`. Required spec fields: `type` (non-empty string), `of` (entity ref string), `timeframe.start` + `timeframe.end` (strings). Optional: `owner` (ref), `happensAt` (array of Resource refs).
- **Relation vocabulary:** reuse built-in relation type constants from `@backstage/catalog-model` (`RELATION_OWNED_BY`/`RELATION_OWNER_OF`, `RELATION_PART_OF`/`RELATION_HAS_PART`, `RELATION_DEPENDS_ON`/`RELATION_DEPENDENCY_OF`). Do NOT invent `cycleOf`/`happensAt` relation strings.
- **Package manager:** all JS commands run via `corepack yarn ...`; run them from the component root `components/leidangr/`.
- **Commits:** use `bash scripts/ws commit leidangr .commits/<slug>.md` from the yggdrasil root (never raw `git commit`). This plan is executed on the `feat/phase3-cycle-kind-and-seed` branch (already created). `ws test leidangr` runs `make test` (the envelope BDD suite); processor units run via `make test-app`.
- **Scope:** `Cycle` kind + built-in seed + tests only. No `Saga`, no TeamSnap provider, no curated entity page (the default entity page is accepted for this phase).

---

## Before You Start

- [ ] **Confirm you are on the implementation branch** (created during doc relocation):

```bash
git -C components/leidangr branch --show-current   # expect: feat/phase3-cycle-kind-and-seed
```

- [ ] **Confirm the session commit identity is set** (needed by `ws commit`):

```bash
bash scripts/ws whoami   # if it errors: bash scripts/ws whoami --set "Cervator" cervator@gmail.com
```

---

## Task 1: `CycleProcessor` — kind validation

**Files:**
- Modify: `components/leidangr/packages/backend/package.json` (add deps)
- Create: `components/leidangr/packages/backend/src/modules/cycle/CycleProcessor.ts`
- Test: `components/leidangr/packages/backend/src/modules/cycle/CycleProcessor.test.ts`

**Interfaces:**
- Consumes: `CatalogProcessor`, `CatalogProcessorEmit`, `processingResult` from `@backstage/plugin-catalog-node`; `Entity`, ref/relation helpers from `@backstage/catalog-model`.
- Produces: `class CycleProcessor implements CatalogProcessor` with `getProcessorName(): string`, `validateEntityKind(entity): Promise<boolean>`, `postProcessEntity(entity, location, emit): Promise<Entity>`. Task 2 extends `postProcessEntity`; Task 3 imports `CycleProcessor`.

- [ ] **Step 1: Add explicit backend dependencies**

These are currently only transitive. Add to `components/leidangr/packages/backend/package.json` `dependencies` (versions matching the installed set), then install:

```jsonc
"@backstage/backend-plugin-api": "^1.9.2",
"@backstage/catalog-model": "^1.9.0",
"@backstage/plugin-catalog-node": "^2.2.2",
```

Run:
```bash
cd components/leidangr && corepack yarn install
```
Expected: install completes, lockfile updates, no peer-dep errors.

- [ ] **Step 2: Write the failing validation test**

Create `components/leidangr/packages/backend/src/modules/cycle/CycleProcessor.test.ts`:

```ts
import { Entity } from '@backstage/catalog-model';
import { CycleProcessor } from './CycleProcessor';

const cycle = (spec: unknown): Entity => ({
  apiVersion: 'siliconsaga.org/v1alpha1',
  kind: 'Cycle',
  metadata: { name: 'soccer-2026-spring' },
  spec: spec as Entity['spec'],
});

const validSpec = {
  type: 'season',
  of: 'group:default/mtl-soccer',
  owner: 'group:default/mtl-soccer',
  timeframe: { start: '2026-03-01', end: '2026-06-15' },
};

describe('CycleProcessor.validateEntityKind', () => {
  const p = new CycleProcessor();

  it('accepts a valid Cycle', async () => {
    await expect(p.validateEntityKind(cycle(validSpec))).resolves.toBe(true);
  });

  it('ignores non-Cycle kinds', async () => {
    const c: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'x' },
    };
    await expect(p.validateEntityKind(c)).resolves.toBe(false);
  });

  it('rejects a Cycle missing spec.type', async () => {
    const { type: _drop, ...noType } = validSpec;
    await expect(p.validateEntityKind(cycle(noType))).rejects.toThrow(
      /spec\.type is required/,
    );
  });

  it('rejects a Cycle missing timeframe', async () => {
    const { timeframe: _drop, ...noTf } = validSpec;
    await expect(p.validateEntityKind(cycle(noTf))).rejects.toThrow(
      /spec\.timeframe/,
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd components/leidangr && corepack yarn backstage-cli repo test packages/backend --no-cache`
Expected: FAIL — `Cannot find module './CycleProcessor'` (file not created yet).

- [ ] **Step 4: Implement `CycleProcessor` (validation only)**

Create `components/leidangr/packages/backend/src/modules/cycle/CycleProcessor.ts`:

```ts
import { Entity } from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';

export const CYCLE_KIND = 'Cycle';

type CycleSpec = {
  type?: unknown;
  of?: unknown;
  owner?: unknown;
  happensAt?: unknown;
  timeframe?: { start?: unknown; end?: unknown };
};

export class CycleProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'CycleProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    if (entity.kind !== CYCLE_KIND) {
      return false;
    }
    const spec = (entity.spec ?? {}) as CycleSpec;
    const errors: string[] = [];

    if (typeof spec.type !== 'string' || spec.type.trim() === '') {
      errors.push('spec.type is required');
    }
    if (typeof spec.of !== 'string' || spec.of.trim() === '') {
      errors.push('spec.of is required');
    }
    const tf = spec.timeframe;
    if (!tf || typeof tf.start !== 'string' || typeof tf.end !== 'string') {
      errors.push('spec.timeframe.start and spec.timeframe.end are required');
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid Cycle entity "${entity.metadata.name}": ${errors.join('; ')}`,
      );
    }
    return true;
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    // Relation emission added in Task 2.
    return entity;
  }
}
```

Note: if `yarn tsc` flags the `LocationSpec` import, confirm its path — in 1.52 it is exported from `@backstage/plugin-catalog-common` (add it to `package.json` deps if the import needs it explicit).

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd components/leidangr && corepack yarn backstage-cli repo test packages/backend --no-cache`
Expected: PASS — all four `validateEntityKind` cases green.

- [ ] **Step 6: Commit**

Write `.commits/phase3-cycle-processor-validate.md` (frontmatter `message: "feat(cycle): add CycleProcessor with kind validation"`, `add:` the three files), then:
```bash
bash scripts/ws commit leidangr .commits/phase3-cycle-processor-validate.md
```

---

## Task 2: `CycleProcessor` — relation emission

**Files:**
- Modify: `components/leidangr/packages/backend/src/modules/cycle/CycleProcessor.ts`
- Test: `components/leidangr/packages/backend/src/modules/cycle/CycleProcessor.test.ts`

**Interfaces:**
- Consumes: `processingResult` (from `@backstage/plugin-catalog-node`); `getCompoundEntityRef`, `parseEntityRef`, and `RELATION_*` constants (from `@backstage/catalog-model`).
- Produces: `postProcessEntity` now emits relations for `Cycle` entities. `processingResult.relation(spec)` yields a result object `{ type: 'relation', relation: { source, type, target } }` passed to `emit`.

- [ ] **Step 1: Write the failing relation test**

Append to `CycleProcessor.test.ts`:

```ts
import { CatalogProcessorResult } from '@backstage/plugin-catalog-node';

describe('CycleProcessor.postProcessEntity', () => {
  const p = new CycleProcessor();

  it('emits partOf/ownedBy/dependsOn relations for a Cycle', async () => {
    const emitted: CatalogProcessorResult[] = [];
    await p.postProcessEntity(
      cycle({
        type: 'season',
        of: 'group:default/mtl-soccer',
        owner: 'group:default/mtl-soccer',
        happensAt: ['resource:default/field-1'],
        timeframe: { start: '2026-03-01', end: '2026-06-15' },
      }),
      { type: 'file', target: 'examples/mtl.yaml' } as any,
      r => emitted.push(r),
    );

    const relations = emitted
      .filter(r => r.type === 'relation')
      .map(r => (r as any).relation);

    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'partOf',
          source: expect.objectContaining({ kind: 'cycle', name: 'soccer-2026-spring' }),
          target: expect.objectContaining({ kind: 'group', name: 'mtl-soccer' }),
        }),
        expect.objectContaining({ type: 'hasPart' }),
        expect.objectContaining({ type: 'ownedBy' }),
        expect.objectContaining({
          type: 'dependsOn',
          target: expect.objectContaining({ kind: 'resource', name: 'field-1' }),
        }),
        expect.objectContaining({ type: 'dependencyOf' }),
      ]),
    );
  });

  it('emits nothing for non-Cycle kinds', async () => {
    const emitted: CatalogProcessorResult[] = [];
    await p.postProcessEntity(
      { apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name: 'x' } },
      { type: 'file', target: 'x' } as any,
      r => emitted.push(r),
    );
    expect(emitted).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd components/leidangr && corepack yarn backstage-cli repo test packages/backend --no-cache`
Expected: FAIL — no relations emitted (the postProcessEntity stub returns early).

- [ ] **Step 3: Implement relation emission**

Replace the `postProcessEntity` stub in `CycleProcessor.ts`, and add imports:

```ts
import {
  Entity,
  getCompoundEntityRef,
  parseEntityRef,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
  RELATION_PART_OF,
  RELATION_HAS_PART,
  RELATION_DEPENDS_ON,
  RELATION_DEPENDENCY_OF,
} from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
```

```ts
  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== CYCLE_KIND) {
      return entity;
    }
    const self = getCompoundEntityRef(entity);
    const spec = (entity.spec ?? {}) as CycleSpec;

    // of → partOf / hasPart (default parent kind: Group)
    const ofRef = parseEntityRef(spec.of as string, {
      defaultKind: 'Group',
      defaultNamespace: 'default',
    });
    emit(processingResult.relation({ source: self, type: RELATION_PART_OF, target: ofRef }));
    emit(processingResult.relation({ source: ofRef, type: RELATION_HAS_PART, target: self }));

    // owner → ownedBy / ownerOf
    if (typeof spec.owner === 'string' && spec.owner.trim() !== '') {
      const ownerRef = parseEntityRef(spec.owner, {
        defaultKind: 'Group',
        defaultNamespace: 'default',
      });
      emit(processingResult.relation({ source: self, type: RELATION_OWNED_BY, target: ownerRef }));
      emit(processingResult.relation({ source: ownerRef, type: RELATION_OWNER_OF, target: self }));
    }

    // happensAt → dependsOn / dependencyOf (default target kind: Resource)
    const happensAt = Array.isArray(spec.happensAt) ? spec.happensAt : [];
    for (const t of happensAt) {
      if (typeof t !== 'string') continue;
      const resRef = parseEntityRef(t, {
        defaultKind: 'Resource',
        defaultNamespace: 'default',
      });
      emit(processingResult.relation({ source: self, type: RELATION_DEPENDS_ON, target: resRef }));
      emit(processingResult.relation({ source: resRef, type: RELATION_DEPENDENCY_OF, target: self }));
    }

    return entity;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd components/leidangr && corepack yarn backstage-cli repo test packages/backend --no-cache`
Expected: PASS — both `postProcessEntity` cases green (and Task 1's validation cases still pass).

- [ ] **Step 5: Commit**

`.commits/phase3-cycle-processor-relations.md` (`message: "feat(cycle): emit ownedBy/partOf/dependsOn relations from CycleProcessor"`), then `bash scripts/ws commit leidangr .commits/phase3-cycle-processor-relations.md`.

---

## Task 3: Register the catalog backend module

**Files:**
- Create: `components/leidangr/packages/backend/src/modules/cycle/catalogModuleCycle.ts`
- Modify: `components/leidangr/packages/backend/src/index.ts`

**Interfaces:**
- Consumes: `createBackendModule` (`@backstage/backend-plugin-api`), `catalogProcessingExtensionPoint` (`@backstage/plugin-catalog-node`), `CycleProcessor` (Task 1/2).
- Produces: default-exported `BackendFeature` added via `backend.add(import('./modules/cycle/catalogModuleCycle'))`.

- [ ] **Step 1: Create the module**

`components/leidangr/packages/backend/src/modules/cycle/catalogModuleCycle.ts`:

```ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { CycleProcessor } from './CycleProcessor';

export const catalogModuleCycle = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'cycle',
  register(reg) {
    reg.registerInit({
      deps: { catalog: catalogProcessingExtensionPoint },
      async init({ catalog }) {
        catalog.addProcessor(new CycleProcessor());
      },
    });
  },
});

export default catalogModuleCycle;
```

- [ ] **Step 2: Wire it into the backend**

In `components/leidangr/packages/backend/src/index.ts`, immediately after the existing catalog lines (`plugin-catalog-backend-module-logs`), add:

```ts
// custom community-domain kinds (Cycle)
backend.add(import('./modules/cycle/catalogModuleCycle'));
```

- [ ] **Step 3: Typecheck + verify the backend assembles**

Run:
```bash
cd components/leidangr && corepack yarn tsc
cd components/leidangr && corepack yarn backstage-cli repo test packages/backend --no-cache
```
Expected: `tsc` clean (no type errors — confirms imports resolve, incl. `LocationSpec`); backend tests still PASS.

- [ ] **Step 4: Commit**

`.commits/phase3-cycle-module-wire.md` (`message: "feat(cycle): register CycleProcessor via a catalog backend module"`), then `bash scripts/ws commit leidangr .commits/phase3-cycle-module-wire.md`.

---

## Task 4: Add the MTL seed + allow the `Cycle` kind

**Files:**
- Create: `components/leidangr/examples/mtl.yaml`
- Modify: `components/leidangr/app-config.yaml` (add a catalog location with per-location rules)

**Interfaces:**
- Consumes: nothing (data + config).
- Produces: catalog entities the BDD suite (Task 5) asserts, and the relations the processor (Task 2) emits. Entity refs used downstream: `group:default/mtl`, `group:default/mtl-soccer`, `group:default/soccer-u8`, `group:default/soccer-u8-red`, `group:default/mtl-basketball`, `group:default/bball-varsity`, `group:default/mtl-hockey`, `domain:default/mtl`, `system:default/mtl-house`, `system:default/mtl-fields`, `system:default/mtl-registration`, `resource:default/main-room`, `resource:default/field-1`, `component:default/reg-web`, `component:default/reg-api`, `cycle:default/soccer-2026-spring`.

- [ ] **Step 1: Write the seed**

Create `components/leidangr/examples/mtl.yaml`:

```yaml
---
# People-org — typed Group tree (organization → sport → division → team)
apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: mtl
  description: Mountaintop League
spec:
  type: organization
  children: [mtl-soccer, mtl-basketball, mtl-hockey]
---
apiVersion: backstage.io/v1alpha1
kind: Group
metadata: { name: mtl-soccer }
spec: { type: sport, parent: mtl, children: [soccer-u8] }
---
apiVersion: backstage.io/v1alpha1
kind: Group
metadata: { name: soccer-u8 }
spec: { type: division, parent: mtl-soccer, children: [soccer-u8-red] }
---
apiVersion: backstage.io/v1alpha1
kind: Group
metadata: { name: soccer-u8-red }
spec: { type: team, parent: soccer-u8, children: [] }
---
apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: mtl-basketball
  description: Small sport — teams hang directly, no division level
spec: { type: sport, parent: mtl, children: [bball-varsity] }
---
apiVersion: backstage.io/v1alpha1
kind: Group
metadata: { name: bball-varsity }
spec: { type: team, parent: mtl-basketball, children: [] }
---
apiVersion: backstage.io/v1alpha1
kind: Group
metadata: { name: mtl-hockey }
spec: { type: sport, parent: mtl, children: [] }
---
# Asset graph — Domain / System / Resource / Component
apiVersion: backstage.io/v1alpha1
kind: Domain
metadata: { name: mtl }
spec: { owner: group:default/mtl }
---
apiVersion: backstage.io/v1alpha1
kind: System
metadata: { name: mtl-house, description: The league house (facility) }
spec: { owner: group:default/mtl, domain: mtl }
---
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: main-room
  annotations:
    siliconsaga.org/reservable: 'true'
spec: { type: bookable-space, owner: group:default/mtl, system: mtl-house }
---
apiVersion: backstage.io/v1alpha1
kind: System
metadata: { name: mtl-fields, description: Playing fields (facility) }
spec: { owner: group:default/mtl-soccer, domain: mtl }
---
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: field-1
  annotations:
    siliconsaga.org/reservable: 'true'
spec: { type: bookable-space, owner: group:default/mtl-soccer, system: mtl-fields }
---
apiVersion: backstage.io/v1alpha1
kind: System
metadata: { name: mtl-registration, description: Registration app (real software) }
spec: { owner: group:default/mtl, domain: mtl }
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata: { name: reg-web }
spec: { type: website, lifecycle: production, owner: group:default/mtl, system: mtl-registration }
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata: { name: reg-api }
spec: { type: service, lifecycle: production, owner: group:default/mtl, system: mtl-registration }
---
# The one Cycle — a soccer season
apiVersion: siliconsaga.org/v1alpha1
kind: Cycle
metadata: { name: soccer-2026-spring, description: MTL Soccer, Spring 2026 season }
spec:
  type: season
  timeframe: { start: '2026-03-01', end: '2026-06-15' }
  of: group:default/mtl-soccer
  owner: group:default/mtl-soccer
  happensAt: [resource:default/field-1]
```

- [ ] **Step 2: Register the location + allow the `Cycle` kind**

In `components/leidangr/app-config.yaml`, add to `catalog.locations` (after the `org.yaml` entry) a location with its own rules so `Cycle`/`Domain`/`Group` are permitted:

```yaml
    - type: file
      target: ../../examples/mtl.yaml
      rules:
        - allow: [Group, Domain, System, Resource, Component, Cycle]
```

- [ ] **Step 3: Verify config is valid**

Run: `cd components/leidangr && corepack yarn backstage-cli config:check --config app-config.yaml`
Expected: PASS (no schema error). This validates config shape; entity ingestion is asserted in Task 5 / verified live in Task 7.

- [ ] **Step 4: Commit**

`.commits/phase3-mtl-seed.md` (`message: "feat(cycle): seed representative MTL hierarchy + allow Cycle kind"`), then `bash scripts/ws commit leidangr .commits/phase3-mtl-seed.md`.

---

## Task 5: BDD acceptance — seed source-assertions (checkpoint 3)

**Files:**
- Create: `components/leidangr/tests/acceptance/checkpoint-3-community-domain.feature`
- Test: `components/leidangr/tests/acceptance/checkpoint-3.steps.ts`

**Interfaces:**
- Consumes: `loadFeature`/`defineFeature` from `jest-cucumber`; `readFileSync` (mirrors `checkpoint-1.steps.ts`). Reads `examples/mtl.yaml` and `app-config.yaml`.
- Produces: envelope-suite coverage (`make test` / `ws test leidangr`).

- [ ] **Step 1: Write the feature file**

Create `components/leidangr/tests/acceptance/checkpoint-3-community-domain.feature`:

```gherkin
Feature: Phase 3 community domain seed
  The MTL seed models the community hierarchy with built-in kinds plus one Cycle.

  Scenario: the seed declares the MTL org Group tree
    Given the MTL seed file
    Then it declares a Group "mtl" of type "organization"
    And it declares a Group "soccer-u8-red" of type "team"

  Scenario: the seed declares a season Cycle wired to its league and field
    Given the MTL seed file
    Then it declares a Cycle "soccer-2026-spring" of type "season"
    And that Cycle is "of" group "mtl-soccer"
    And that Cycle "happensAt" resource "field-1"

  Scenario: the catalog allows the Cycle kind
    Given the app-config catalog rules
    Then the "mtl.yaml" location allows the "Cycle" kind
```

- [ ] **Step 2: Write the step definitions**

Create `components/leidangr/tests/acceptance/checkpoint-3.steps.ts`:

```ts
import { readFileSync } from 'fs';
import { loadFeature, defineFeature } from 'jest-cucumber';

const feature = loadFeature(
  'tests/acceptance/checkpoint-3-community-domain.feature',
);

defineFeature(feature, test => {
  let seed = '';
  let appConfig = '';

  test('the seed declares the MTL org Group tree', ({ given, then, and }) => {
    given('the MTL seed file', () => {
      seed = readFileSync('examples/mtl.yaml', 'utf-8');
    });
    then(/^it declares a Group "(.*)" of type "(.*)"$/, (name, type) => {
      expect(seed).toMatch(new RegExp(`kind:\\s*Group[\\s\\S]*?name:\\s*${name}\\b`));
      expect(seed).toMatch(new RegExp(`type:\\s*${type}\\b`));
    });
    and(/^it declares a Group "(.*)" of type "(.*)"$/, (name, type) => {
      expect(seed).toMatch(new RegExp(`name:\\s*${name}\\b`));
      expect(seed).toMatch(new RegExp(`type:\\s*${type}\\b`));
    });
  });

  test('the seed declares a season Cycle wired to its league and field', ({ given, then, and }) => {
    given('the MTL seed file', () => {
      seed = readFileSync('examples/mtl.yaml', 'utf-8');
    });
    then(/^it declares a Cycle "(.*)" of type "(.*)"$/, (name, type) => {
      expect(seed).toMatch(/kind:\s*Cycle/);
      expect(seed).toMatch(new RegExp(`name:\\s*${name}\\b`));
      expect(seed).toMatch(new RegExp(`type:\\s*${type}\\b`));
    });
    and(/^that Cycle is "of" group "(.*)"$/, group => {
      expect(seed).toMatch(new RegExp(`of:\\s*group:default/${group}\\b`));
    });
    and(/^that Cycle "happensAt" resource "(.*)"$/, res => {
      expect(seed).toMatch(new RegExp(`happensAt:\\s*\\[resource:default/${res}\\]`));
    });
  });

  test('the catalog allows the Cycle kind', ({ given, then }) => {
    given('the app-config catalog rules', () => {
      appConfig = readFileSync('app-config.yaml', 'utf-8');
    });
    then(/^the "(.*)" location allows the "(.*)" kind$/, (loc, kind) => {
      expect(appConfig).toMatch(new RegExp(`${loc.replace('.', '\\.')}`));
      expect(appConfig).toMatch(new RegExp(`allow:\\s*\\[[^\\]]*\\b${kind}\\b`));
    });
  });
});
```

- [ ] **Step 3: Run the envelope suite**

Run: `cd components/leidangr && make test`
Expected: PASS — the three checkpoint-3 scenarios green, alongside the existing checkpoint-1/2 (`@live` excluded).

- [ ] **Step 4: Commit**

`.commits/phase3-bdd.md` (`message: "test(cycle): BDD source-assertions for the MTL seed + Cycle allow-rule"`), then `bash scripts/ws commit leidangr .commits/phase3-bdd.md`.

---

## Task 6: CI coverage + ADR

**Files:**
- Modify: `components/leidangr/Makefile` (include unit tests in `ci`)
- Create: `components/leidangr/docs/adrs/0007-cycle-custom-kind.md`
- Modify: `components/leidangr/docs/development/testing.md` (note the two test surfaces)

- [ ] **Step 1: Make `ci` run the processor unit tests**

The processor units run via `backstage-cli repo test` (the `test-app` target), which `make ci` does not currently include. Update the `ci` target in `components/leidangr/Makefile`:

```make
ci: config-check lint test test-app
```

- [ ] **Step 2: Write the ADR**

Create `components/leidangr/docs/adrs/0007-cycle-custom-kind.md` (MADR v3, matching the 0001–0006 style): context = Backstage has no bounded-grouping kind; decision = a single `Cycle` custom kind (open `spec.type` vocabulary) via a catalog backend module that reuses built-in relation types (`ownedBy`/`partOf`/`dependsOn`); consequences = occurrences stay queried-not-minted, `Saga`/TeamSnap deferred, custom kind gets the default entity page for now. Reference the design doc at `../plans/2026-07-06-leidangr-phase3-community-domain-design.md`.

- [ ] **Step 3: Note the two test surfaces**

In `components/leidangr/docs/development/testing.md`, add a short subsection: envelope BDD (`make test` / `ws test leidangr`) covers seed + config source-assertions; `make test-app` (`backstage-cli repo test`) covers the `CycleProcessor` units; `make ci` now runs both.

- [ ] **Step 4: Verify the full gate**

Run: `cd components/leidangr && make ci`
Expected: `config-check`, `lint`, `test`, and `test-app` all PASS.

- [ ] **Step 5: Commit**

`.commits/phase3-ci-adr.md` (`message: "docs(cycle): ADR 0007 + CI wiring for processor units"`), then `bash scripts/ws commit leidangr .commits/phase3-ci-adr.md`.

---

## Task 7: Verify in a running instance (manual)

**Files:** none (verification).

- [ ] **Step 1: Boot the stub instance**

Run: `cd components/leidangr && make dev`
Expected: the app boots (zero-secret stub mode; no cluster needed).

- [ ] **Step 2: Confirm the entities and relations render**

In the catalog UI:
- Filter by kind — `Cycle` appears as a kind option; `soccer-2026-spring` is listed.
- Open `soccer-2026-spring` — the default entity page shows its relations: **part of** `mtl-soccer`, **owned by** `mtl-soccer`, **depends on** `field-1`.
- Open Group `mtl` — its tree (`mtl-soccer`/`mtl-basketball`/`mtl-hockey`) and members render; `mtl-basketball` has `bball-varsity` directly (no division).
- Confirm no red catalog-processing errors in the backend log for the seed.

- [ ] **Step 3: Stop the instance** (`Ctrl-C`). No commit (verification only).

---

## After the plan

- Open the component CR: `bash scripts/ws cr leidangr "feat: Phase 3 community domain — Cycle kind + MTL seed" .crs/<slug>.md` (body from `templates/change.md`). This CR carries the relocated design + plan docs and the implementation.
- Deferred (not this plan): `Saga` kind, TeamSnap scrape→provider, a curated `Cycle` entity page, real `startTestBackend` catalog ingestion tests.

## Self-Review

- **Spec coverage:** Cycle kind (Tasks 1–3) ✓; built-in seed incl. Group tree/facilities/real software (Task 4) ✓; occurrences not modeled ✓; relation vocabulary decided (built-ins) ✓; BDD seed coverage (Task 5) ✓; done-signal "catalog shows entities + relations" (Task 7) ✓; `Saga`/TeamSnap deferred ✓. Done-signal "ws test leidangr green" = Task 5 (envelope) ✓; processor units gated via `make ci`/`test-app` (Task 6) ✓.
- **Placeholder scan:** every code/config step contains full content; the one flagged verification (LocationSpec import path) is a real `tsc`-checked step, not a placeholder.
- **Type consistency:** `CycleProcessor` methods, `CYCLE_KIND`, `CycleSpec`, entity refs, and `RELATION_*` constants are used identically across Tasks 1–3 and the tests; seed refs in Task 4 match the assertions in Task 5 and the processor defaults in Task 2.
