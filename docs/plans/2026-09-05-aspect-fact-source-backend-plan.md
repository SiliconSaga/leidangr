# Aspect Fact Source — Implementation Plan (Stages 3–4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute trial outcomes for adopting components and serve them, so a medal becomes derivable from real data.

**Architecture:** A new `@siliconsaga/plugin-gildi-backend` owns acquisition: a resolver registry keyed by `factSource`, two resolvers, facet filtering, an evaluator, an append-only store, a scheduler task, and a router. It consumes the merged `gildi-common` vocabulary and produces run rows. The `gildi` frontend gains a read-only hook. Nothing renders a badge — that stays sub-project 4's UI work, which this deliberately stops short of.

**Tech Stack:** TypeScript, Backstage new backend system (`createBackendPlugin`, `coreServices`), Knex migrations, `@swc/jest`.

**Spec:** `docs/plans/2026-08-29-aspect-fact-source-design.md`

## Where you are working

Every path here is relative to the **yggdrasil workspace root**, not to leidangr. `components/leidangr/...` is the component; `bash scripts/ws ...` is the workspace CLI and only resolves from the root. Running these steps from inside `components/leidangr` fails immediately on missing paths and a missing `scripts/ws`.

## Global Constraints

- Outcomes come from `@siliconsaga/plugin-gildi-common`. **Never redefine the union, the verdict, or `CHECK_TYPES`** — importing them is the point of that package.
- **A missing artifact is `fail`, not `unmeasured`** (design §3). `unmeasured` means we could not look.
- **Aggregation consumes outcomes, never resolvers** (design §3). Resolvers return `Outcome`, and nothing downstream inspects how it was produced.
- **An unreadable `standard.yaml` is `unevaluatedVerdict('no-standard')`, never `verdictFor([])`** (design §7). The latter yields a confident `none`.
- **Failure is isolated per resolver** (design §7): a throwing resolver marks only its own trials `unmeasured{error}`.
- Store is **append-only, one row per run**, with `applicable`/`passing` **null, not zero**, on an unevaluated run (design §8).
- Bounded from day one (design §7), at **two** levels that do different jobs: a **per-trial timeout** so one slow trial cannot stretch a run and says so in terms its author can act on, and a **sweep concurrency limit** so the fleet cannot saturate the GitHub API as adoption grows.
- **Commit via `ws commit`, never raw `git commit`.** Bodyfile paths relative to yggdrasil root; `add:` paths relative to component root.
- Avoid semicolons in commit bodies and CR text — the permission hook flags them in quoted prose.
- **Move files with plain `mv`, never `git mv`** — a hook rejects it; list both paths under `add:`.

## Verified API facts

Checked against the installed packages rather than predicted. Use these exactly.

| Need | Verified |
|---|---|
| Plugin shell | `createBackendPlugin` from `@backstage/backend-plugin-api` |
| Services | `coreServices.database`, `.scheduler`, `.httpRouter`, `.httpAuth`, `.logger`, `.urlReader`, `.auth` |
| Catalog access | `catalogServiceRef` from `@backstage/plugin-catalog-node` |
| Catalog calls | Every method takes `(request, options)` where options carry `credentials` |
| Credentials | `auth.getOwnServiceCredentials()` |
| Scheduling | `scheduler.scheduleTask({ id, frequency, timeout, initialDelay?, scope?, fn })` — durations accept `HumanDuration` like `{ minutes: 30 }` |
| Reading files | `urlReader.readUrl(url)` → response with `.buffer()` |

## File Structure

| File | Responsibility |
|---|---|
| `plugins/gildi-backend/src/plugin.ts` | Plugin shell, service wiring, scheduler registration |
| `plugins/gildi-backend/src/facets.ts` | Facet resolution and block applicability |
| `plugins/gildi-backend/src/standard.ts` | Locate and parse a practice's `standard.yaml` |
| `plugins/gildi-backend/src/resolvers/types.ts` | `Resolver` interface and `ResolverContext` |
| `plugins/gildi-backend/src/resolvers/repoFiles.ts` | `repo-files` — reads artifacts from the adopter |
| `plugins/gildi-backend/src/resolvers/githubPages.ts` | `github-pages-api` — reads Pages settings |
| `plugins/gildi-backend/src/resolvers/registry.ts` | `factSource` → resolver dispatch |
| `plugins/gildi-backend/src/evaluate.ts` | Entity + standard + registry → outcomes |
| `plugins/gildi-backend/src/store.ts` | `TrialResultStore` interface + Knex implementation |
| `plugins/gildi-backend/migrations/*.js` | Table creation |
| `plugins/gildi-backend/src/router.ts` | Latest, history, refresh endpoints |
| `plugins/gildi/src/entity/useComponentTrials.ts` | Read-only frontend hook |

---

## Task 1: Scaffold `gildi-backend` with facet resolution

Facet filtering is the "just enough of sub-project 2" piece and is pure logic, so it makes the package's first testable deliverable without needing any service wiring.

**Files:**
- Create: `plugins/gildi-backend/package.json`, `.eslintrc.js`, `tsconfig.json`, `README.md`
- Create: `plugins/gildi-backend/src/facets.ts`, `src/facets.test.ts`
- Modify: `yarn.lock`

**Interfaces:**
- Consumes: `Block`, `Standard`, `Trial` from `@siliconsaga/plugin-gildi-common`.
- Produces: `facetsOf(entity: Entity, standard: Standard): string[]` and `applicableTrials(entity: Entity, standard: Standard): Trial[]`.

- [ ] **Step 1: Create the package files**

`components/leidangr/plugins/gildi-backend/package.json`:

```json
{
  "name": "@siliconsaga/plugin-gildi-backend",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "license": "UNLICENSED",
  "private": true,
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "backstage": {
    "role": "backend-plugin",
    "pluginId": "gildi",
    "pluginPackages": [
      "@siliconsaga/plugin-gildi",
      "@siliconsaga/plugin-gildi-backend",
      "@siliconsaga/plugin-gildi-common"
    ]
  },
  "scripts": {
    "build": "backstage-cli package build",
    "lint": "backstage-cli package lint",
    "test": "backstage-cli package test",
    "clean": "backstage-cli package clean"
  },
  "dependencies": {
    "@backstage/backend-plugin-api": "^1.4.1",
    "@backstage/catalog-model": "^1.7.3",
    "@backstage/errors": "^1.2.7",
    "@backstage/integration": "^1.17.0",
    "@backstage/plugin-catalog-node": "^1.16.1",
    "@octokit/rest": "^21.0.0",
    "@siliconsaga/plugin-gildi-common": "0.1.0",
    "express": "^4.21.2",
    "knex": "^3.1.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@backstage/backend-test-utils": "^1.7.0",
    "@backstage/cli": "^0.36.3"
  },
  "files": ["dist", "migrations"]
}
```

**Pin the dependency versions to what the repo already resolves.** Before writing the file, run `grep -n '"@backstage/backend-plugin-api"\|"@backstage/catalog-model"\|"@backstage/plugin-catalog-node"\|"express"\|"yaml"' components/leidangr/packages/backend/package.json components/leidangr/package.json` and use those ranges instead of the ones above where they differ. A mismatched range is what forces a lockfile churn nobody asked for.

`.eslintrc.js` — identical to `gildi-common`'s, and load-bearing: without it lint parses TypeScript as JavaScript and reports `export` as a reserved word.

```js
module.exports = require('@backstage/cli/config/eslint-factory')(__dirname);
```

`tsconfig.json`:

```json
{ "extends": "@backstage/cli/config/tsconfig.json", "include": ["src"], "exclude": ["node_modules"], "compilerOptions": { "outDir": "dist", "rootDir": "." } }
```

`README.md` — state the one rule: this package owns **acquisition**. It reads the outside world and produces `Outcome` values. It must not restate any rule from `gildi-common`, and it must not render anything.

- [ ] **Step 2: Install**

**Not `make deps`** — that runs `yarn install --immutable`, and a new workspace necessarily changes `yarn.lock`.

Run: `bash scripts/ws exec leidangr corepack yarn install`
Expected: `Done with warnings`. The peer warnings about `@testing-library/react`, `react` and `jest` are pre-existing and also name `gildi`, `app` and `backend`.

- [ ] **Step 3: Write the failing test**

`components/leidangr/plugins/gildi-backend/src/facets.test.ts`:

```ts
import type { Entity } from '@backstage/catalog-model';
import type { Standard } from '@siliconsaga/plugin-gildi-common';
import { applicableTrials, facetsOf } from './facets';

const trial = (id: string) => ({
  id,
  rule: 'r',
  artifact: 'a',
  factSource: 'repo-files',
  remediation: './fix.md',
});

const STANDARD: Standard = {
  id: 'website-hygiene',
  aspect: 'website-hygiene',
  facetDefaults: { website: ['web-ui'] },
  blocks: [
    { id: 'build', appliesTo: ['web-ui'], trials: [trial('gemfile')] },
    { id: 'any', appliesTo: ['*'], trials: [trial('everywhere')] },
    { id: 'apis', appliesTo: ['api'], trials: [trial('api-only')] },
  ],
};

const component = (spec: object, annotations?: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'site', ...(annotations ? { annotations } : {}) },
  spec: spec as Entity['spec'],
});

describe('facetsOf', () => {
  it('maps spec.type through facetDefaults', () => {
    expect(facetsOf(component({ type: 'website' }), STANDARD)).toEqual(['web-ui']);
  });

  it('lets the annotation override the default entirely', () => {
    // Override, not merge: a component declaring its facets is stating what it
    // IS, and silently adding the type's defaults back would make the
    // annotation unable to remove one.
    const e = component({ type: 'website' }, { 'siliconsaga.org/facets': 'api, batch' });
    expect(facetsOf(e, STANDARD)).toEqual(['api', 'batch']);
  });

  it('is empty for a type with no default and no annotation', () => {
    expect(facetsOf(component({ type: 'library' }), STANDARD)).toEqual([]);
  });

  it('is empty for an entity with no spec.type at all', () => {
    expect(facetsOf(component({}), STANDARD)).toEqual([]);
  });

  it('falls back to the default for a blank annotation rather than exempting the component', () => {
    // `facets: ""` is a half-finished edit, not a declaration of none. Reading
    // it as an opt-out would leave a component enrolled and asked nothing,
    // which looks identical to compliance.
    const e = component({ type: 'website' }, { 'siliconsaga.org/facets': '  ,  ' });
    expect(facetsOf(e, STANDARD)).toEqual(['web-ui']);
  });
});

describe('applicableTrials', () => {
  it('includes matching blocks and the wildcard, excluding the rest', () => {
    const ids = applicableTrials(component({ type: 'website' }), STANDARD).map(t => t.id);
    expect(ids).toEqual(['gemfile', 'everywhere']);
  });

  it('still includes the wildcard when nothing else matches', () => {
    // `*` means every component, including one whose facets are unknown. A
    // standard with a wildcard block always asks something.
    const ids = applicableTrials(component({ type: 'library' }), STANDARD).map(t => t.id);
    expect(ids).toEqual(['everywhere']);
  });

  it('returns an empty set rather than throwing when a standard has no blocks', () => {
    const empty: Standard = { id: 'x', aspect: 'x', blocks: [] };
    expect(applicableTrials(component({ type: 'website' }), empty)).toEqual([]);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `make -C components/leidangr test-app`
Expected: FAIL — `Cannot find module './facets'`.

- [ ] **Step 5: Implement**

`components/leidangr/plugins/gildi-backend/src/facets.ts`:

```ts
import type { Entity } from '@backstage/catalog-model';
import type { Standard, Trial } from '@siliconsaga/plugin-gildi-common';

const FACETS_ANNOTATION = 'siliconsaga.org/facets';

// Same parsing as gildi's aspects.ts: trimmed, deduped, blanks dropped. A stray
// space is not cosmetic here — facets are compared for equality, so ' web-ui '
// matches nothing.
function parseList(value?: string): string[] {
  return [...new Set((value ?? '').split(',').map(s => s.trim()).filter(Boolean))];
}

/**
 * The facets a component presents to a standard.
 *
 * The annotation OVERRIDES the type default rather than merging with it. A
 * component declaring its facets is stating what it is, and merging would make
 * the annotation unable to remove a facet its type implies.
 *
 * A present-but-BLANK annotation falls back to the default rather than meaning
 * "no facets". `facets: ""` is overwhelmingly a half-finished edit, and reading
 * it as a deliberate opt-out would silently exempt a component from every trial
 * — the failure mode is a component that looks enrolled and is asked nothing.
 * A component that genuinely applies to nothing simply has no matching block.
 */
export function facetsOf(entity: Entity, standard: Standard): string[] {
  const declared = parseList(entity.metadata.annotations?.[FACETS_ANNOTATION]);
  if (declared.length > 0) {
    return declared;
  }
  const type = entity.spec?.type;
  if (typeof type !== 'string') {
    return [];
  }
  return standard.facetDefaults?.[type] ?? [];
}

/**
 * The trials that apply to this component, already filtered.
 *
 * `not applicable` is NOT an outcome (design §3) — a skipped trial is simply
 * absent from this list, which is what lets verdictFor keep its shape.
 */
export function applicableTrials(entity: Entity, standard: Standard): Trial[] {
  const facets = facetsOf(entity, standard);
  return (standard.blocks ?? [])
    .filter(b => (b.appliesTo ?? []).some(f => f === '*' || facets.includes(f)))
    .flatMap(b => b.trials ?? []);
}
```

- [ ] **Step 6: Run tests and the full gate**

Run: `make -C components/leidangr test-app`
Expected: PASS.

Run: `bash scripts/ws lint leidangr`
Expected: clean. If lint reports `Parsing error: The keyword 'export' is reserved`, `.eslintrc.js` is missing from step 1.

- [ ] **Step 7: Commit**

Create `.commits/gildi-backend-facets.md`:

```markdown
---
message: "feat(gildi-backend): the package, and facet applicability"
add:
  - plugins/gildi-backend/
  - yarn.lock
---

Facet filtering first because it is pure logic and needs no services, so the new package gets a testable deliverable before any wiring exists.

The annotation overrides the type default rather than merging with it. A component declaring its facets is stating what it is, and merging would leave the annotation unable to remove a facet its type implies.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-backend-facets.md`

---

## Task 2: Locate and parse a practice's standard

**Files:**
- Create: `plugins/gildi-backend/src/standard.ts`, `src/standard.test.ts`
- Modify: `plugins/gildi-common/src/standard.ts` (add `validateStandardShape`)
- Modify: `plugins/gildi-common/src/index.ts`
- Modify: `scripts/lib/standard-shape.ts` (delegate its shape checks)

**Do not write a second validator.** `scripts/lib/standard-shape.ts` already validates this shape and is the thing that keeps volundr's file honest. It cannot be reused as-is — it takes a path and also checks that remediation files resolve on disk, which a standard read over the network cannot do. So the **shape** half moves into `gildi-common` where both callers can share it, and the filesystem half stays where it is. A backend that re-checks the shape its own way is exactly the drift the shared package exists to prevent.

**Interfaces:**
- Consumes: `Standard` from `gildi-common`; `UrlReaderService` from `@backstage/backend-plugin-api`.
- Produces: `standardUrlFor(practice: Entity): string | undefined` and `loadStandard(reader: UrlReaderService, url: string): Promise<Standard>` (rejects on unreadable or malformed input).

- [ ] **Step 0: Move the shape check into `gildi-common`**

Lift the structural half of `scripts/lib/standard-shape.ts` into `plugins/gildi-common/src/standard.ts` as `validateStandardShape(root: unknown): StandardIssue[]`, exported from the package index. It checks exactly what that validator checks today minus anything touching the filesystem: standard `id` and `aspect` present, at least one block, each block with an `id` and a non-empty `appliesTo` of non-empty non-padded strings, each trial with `id`/`rule`/`artifact`/`factSource`/`remediation`, and any `check` being a mapping whose `type` is an unpadded member of `CHECK_TYPES` with a non-empty `value`.

Then have `scripts/lib/standard-shape.ts` call it and append only its filesystem findings — remediation resolves, is a file, and does not escape the module. Its existing tests must pass unchanged; if any expectation moves, the lift changed behaviour and should be corrected rather than the test.

Run: `bash scripts/ws test leidangr`
Expected: PASS, including every pre-existing `standard-shape` case.

- [ ] **Step 1: Write the failing test**

`components/leidangr/plugins/gildi-backend/src/standard.test.ts`:

```ts
import type { Entity } from '@backstage/catalog-model';
import { loadStandard, standardUrlFor } from './standard';

const practice = (annotations: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'website-hygiene-practice', annotations },
  spec: { type: 'practice' },
});

describe('standardUrlFor', () => {
  it('resolves the annotation against the entity source location', () => {
    expect(
      standardUrlFor(
        practice({
          'siliconsaga.org/standard': './standard.yaml',
          'backstage.io/source-location':
            'url:https://github.com/SiliconSaga/volundr/tree/main/aspect/',
        }),
      ),
    ).toBe('https://github.com/SiliconSaga/volundr/tree/main/aspect/standard.yaml');
  });

  it('is undefined when the practice declares no standard', () => {
    // Not an error: the seeded security practice has no standard annotation,
    // and the run is recorded as unevaluated{no-standard} rather than failing.
    expect(
      standardUrlFor(
        practice({
          'backstage.io/source-location': 'url:https://example.com/aspect/',
        }),
      ),
    ).toBeUndefined();
  });

  it('is undefined when the entity has no source location', () => {
    expect(standardUrlFor(practice({ 'siliconsaga.org/standard': './standard.yaml' }))).toBeUndefined();
  });
});

describe('loadStandard', () => {
  const readerReturning = (body: string) =>
    ({ readUrl: async () => ({ buffer: async () => Buffer.from(body, 'utf8') }) } as any);

  it('parses the standard body', async () => {
    const std = await loadStandard(
      readerReturning(`
standard:
  id: website-hygiene
  aspect: website-hygiene
  blocks:
    - id: build
      appliesTo: [web-ui]
      trials:
        - id: gemfile-present
          rule: r
          artifact: Gemfile
          factSource: repo-files
          check: { type: file-contains, value: github-pages }
          remediation: ./docs/adopting.md
`),
      'https://example.com/standard.yaml',
    );
    expect(std.id).toBe('website-hygiene');
    expect(std.blocks[0].trials[0].check).toEqual({
      type: 'file-contains',
      value: 'github-pages',
    });
  });

  it('rejects a body with no standard key rather than returning a hollow object', async () => {
    // Returning `{}` here would produce an empty applicable set, which derives
    // medal `none` — a confident verdict about a component built on our own
    // failure to read the file. See design §7.
    await expect(
      loadStandard(readerReturning('something: else'), 'https://example.com/standard.yaml'),
    ).rejects.toThrow(/invalid standard/i);
  });

  // Shape faults reach us the same way a missing file does. A standard whose
  // blocks are malformed would otherwise be cast to Standard and throw later,
  // deep inside facet filtering, where the message says nothing useful.
  it('rejects a standard whose shape is wrong, naming the fault', async () => {
    await expect(
      loadStandard(
        readerReturning(`
standard:
  id: website-hygiene
  blocks:
    - id: build
      appliesTo: [web-ui]
      trials:
        - id: t
          rule: r
          artifact: a
          factSource: repo-files
          check: { type: file-contins, value: x }
          remediation: ./f.md
`),
        'https://example.com/standard.yaml',
      ),
    ).rejects.toThrow(/unknown check type file-contins/);
  });

  it('rejects malformed YAML', async () => {
    await expect(
      loadStandard(readerReturning('standard: [oops'), 'https://example.com/standard.yaml'),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `make -C components/leidangr test-app`
Expected: FAIL — `Cannot find module './standard'`.

- [ ] **Step 3: Implement**

`components/leidangr/plugins/gildi-backend/src/standard.ts`:

```ts
import type { Entity } from '@backstage/catalog-model';
import { ANNOTATION_SOURCE_LOCATION, parseLocationRef } from '@backstage/catalog-model';
import type { UrlReaderService } from '@backstage/backend-plugin-api';
import type { Standard } from '@siliconsaga/plugin-gildi-common';
import { parse } from 'yaml';

const STANDARD_ANNOTATION = 'siliconsaga.org/standard';

/**
 * Where this practice's standard.yaml lives, or undefined if it declares none.
 *
 * Resolved against the entity's own source location so the standard travels
 * with the module. Undefined is a legitimate answer — the seeded security
 * practice has no standard annotation.
 */
export function standardUrlFor(practice: Entity): string | undefined {
  const rel = practice.metadata.annotations?.[STANDARD_ANNOTATION]?.trim();
  const source = practice.metadata.annotations?.[ANNOTATION_SOURCE_LOCATION]?.trim();
  if (!rel || !source) {
    return undefined;
  }
  let target: string;
  try {
    ({ target } = parseLocationRef(source));
  } catch {
    return undefined;
  }
  try {
    return new URL(rel, target.endsWith('/') ? target : `${target}/`).toString();
  } catch {
    return undefined;
  }
}

/**
 * Read and parse a standard.
 *
 * THROWS rather than returning a partial standard. A hollow object would
 * produce an empty applicable set, and an empty applicable set derives medal
 * `none` — publishing a verdict about a component on the strength of our own
 * failure to read the file. The caller turns this rejection into
 * unevaluatedVerdict('no-standard').
 */
export async function loadStandard(
  reader: UrlReaderService,
  url: string,
): Promise<Standard> {
  const response = await reader.readUrl(url);
  const body = (await response.buffer()).toString('utf8');
  const root = parse(body)?.standard;

  // The SHARED shape check, not a second opinion about it. Rejecting on the
  // same rules scripts/lib enforces means a standard that passes CI cannot
  // then be refused here, and one that is malformed cannot slip through here
  // after being caught there.
  const issues = validateStandardShape(root);
  if (issues.length > 0) {
    const summary = issues.map(i => `${i.trial}: ${i.problem}`).join(', ');
    throw new Error(`invalid standard at ${url} — ${summary}`);
  }
  return root as Standard;
}
```

Add the import at the top of the same file:

```ts
import { validateStandardShape } from '@siliconsaga/plugin-gildi-common';
```

- [ ] **Step 4: Run tests**

Run: `make -C components/leidangr test-app`
Expected: PASS, all six cases.

- [ ] **Step 5: Commit**

Create `.commits/gildi-backend-standard.md`:

```markdown
---
message: "feat(gildi-backend): find and read a practice's standard"
add:
  - plugins/gildi-backend/src/standard.ts
  - plugins/gildi-backend/src/standard.test.ts
---

`loadStandard` throws rather than returning a partial standard, and that is the load-bearing decision. A hollow object produces an empty applicable set, and an empty applicable set derives medal `none` — a confident verdict about a component built on our own failure to read the file. The caller turns the rejection into an unevaluated run instead.

A practice with no standard annotation is not an error. The seeded security practice has none, and the run is recorded as unevaluated with reason `no-standard` and no outcomes — not as a set of unmeasured trials, because without a standard we never learned what the trials were.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-backend-standard.md`

---

## Task 3: The resolver registry and the `repo-files` resolver

**Files:**
- Create: `plugins/gildi-backend/src/resolvers/types.ts`
- Create: `plugins/gildi-backend/src/resolvers/repoFiles.ts`, `resolvers/repoFiles.test.ts`
- Create: `plugins/gildi-backend/src/resolvers/registry.ts`, `resolvers/registry.test.ts`

**Interfaces:**
- Consumes: `Outcome`, `Trial`, `fail`, `pass`, `unmeasured` from `gildi-common`.
- Produces:
  - `interface ResolverContext { entity: Entity; sourceUrl?: string; reader: UrlReaderService }`
  - `interface Resolver { answer(trial: Trial, ctx: ResolverContext): Promise<Outcome> }`
  - `repoFilesResolver: Resolver`
  - `resolverFor(factSource: string): Resolver | undefined`

- [ ] **Step 1: Write the failing tests**

`components/leidangr/plugins/gildi-backend/src/resolvers/repoFiles.test.ts`:

```ts
import type { Trial } from '@siliconsaga/plugin-gildi-common';
import { repoFilesResolver } from './repoFiles';
import type { ResolverContext } from './types';

const GEMFILE: Trial = {
  id: 'gemfile-present',
  rule: 'a Gemfile declares the github-pages gem',
  artifact: 'Gemfile',
  factSource: 'repo-files',
  check: { type: 'file-contains', value: 'github-pages' },
  remediation: './docs/adopting.md',
};

const DEPLOY: Trial = {
  id: 'deploy-stub-points-at-volundr',
  rule: 'a job uses the shared workflow',
  artifact: '.github/workflows/deploy.yml',
  factSource: 'repo-files',
  check: {
    type: 'workflow-job-uses',
    value: 'SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@main',
  },
  remediation: './docs/adopting.md',
};

function ctx(files: Record<string, string | Error>): ResolverContext {
  return {
    entity: {} as any,
    sourceUrl: 'https://github.com/SiliconSaga/site/tree/main/',
    reader: {
      readUrl: async (url: string) => {
        const key = Object.keys(files).find(k => url.endsWith(k));
        const value = key ? files[key] : undefined;
        if (value === undefined) {
          const err = new Error('NotFound') as Error & { name: string };
          err.name = 'NotFoundError';
          throw err;
        }
        if (value instanceof Error) throw value;
        return { buffer: async () => Buffer.from(value, 'utf8') };
      },
    } as any,
  };
}

describe('repo-files resolver', () => {
  it('passes when the file contains the value', async () => {
    const out = await repoFilesResolver.answer(
      GEMFILE,
      ctx({ Gemfile: 'source "https://rubygems.org"\ngem "github-pages"' }),
    );
    expect(out).toEqual({ state: 'pass' });
  });

  it('fails when the file exists without the value', async () => {
    const out = await repoFilesResolver.answer(GEMFILE, ctx({ Gemfile: 'gem "rails"' }));
    expect(out.state).toBe('fail');
  });

  // A MISSING ARTIFACT IS `fail`, NOT `unmeasured`. Absence is the answer — no
  // Gemfile means gemfile-present fails. Getting this backwards reports a
  // genuinely non-compliant repo as "we could not check". Design §3.
  it('fails when the artifact is absent', async () => {
    const out = await repoFilesResolver.answer(GEMFILE, ctx({}));
    expect(out.state).toBe('fail');
  });

  it('passes when a workflow job uses the exact value', async () => {
    const out = await repoFilesResolver.answer(
      DEPLOY,
      ctx({
        'deploy.yml': `jobs:
  deploy:
    uses: SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@main`,
      }),
    );
    expect(out).toEqual({ state: 'pass' });
  });

  // NEGATIVE CONTROL. Without this a substring match passes everything and the
  // trial looks green while checking nothing.
  it.each([
    ['a different ref', 'SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@v1'],
    ['a different repo', 'Other/volundr/.github/workflows/jekyll-deploy.yml@main'],
    ['a different workflow', 'SiliconSaga/volundr/.github/workflows/pr-preview.yml@main'],
  ])('fails on a near miss: %s', async (_label, uses) => {
    const out = await repoFilesResolver.answer(
      DEPLOY,
      ctx({ 'deploy.yml': `jobs:\n  deploy:\n    uses: ${uses}` }),
    );
    expect(out.state).toBe('fail');
  });

  it('is unmeasured with no source url, because we cannot look', async () => {
    const out = await repoFilesResolver.answer(GEMFILE, {
      ...ctx({}),
      sourceUrl: undefined,
    });
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-source' });
  });

  it('is unmeasured when the read errors for a reason other than absence', async () => {
    const out = await repoFilesResolver.answer(GEMFILE, ctx({ Gemfile: new Error('HTTP 403') }));
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'error' });
  });

  it('is unmeasured when the trial declares no check', async () => {
    const { check: _drop, ...noCheck } = GEMFILE;
    const out = await repoFilesResolver.answer(noCheck as Trial, ctx({ Gemfile: 'anything' }));
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-resolver' });
  });
});
```

`components/leidangr/plugins/gildi-backend/src/resolvers/registry.test.ts`:

```ts
import { resolverFor } from './registry';

describe('resolverFor', () => {
  it.each(['repo-files', 'github-pages-api'])('resolves %s', kind => {
    expect(resolverFor(kind)).toBeDefined();
  });

  // The mock security standard declares these and nothing implements them.
  // Returning undefined is what makes the caller record unmeasured{no-resolver}
  // rather than a pass.
  it.each(['ci-pipeline-results', 'catalog-annotations', 'aspect-repo', 'nonsense'])(
    'returns undefined for %s',
    kind => {
      expect(resolverFor(kind)).toBeUndefined();
    },
  );
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `make -C components/leidangr test-app`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the types**

`components/leidangr/plugins/gildi-backend/src/resolvers/types.ts`:

```ts
import type { Entity } from '@backstage/catalog-model';
import type { UrlReaderService } from '@backstage/backend-plugin-api';
import type { Outcome, Trial } from '@siliconsaga/plugin-gildi-common';

export interface ResolverContext {
  entity: Entity;
  /** The adopting repository's directory URL, absent when undeterminable. */
  sourceUrl?: string;
  reader: UrlReaderService;
  /**
   * Aborted when the trial's budget expires. Resolvers MUST pass it to every
   * request they make: without it a timed-out trial is only abandoned, not
   * stopped, and its HTTP request keeps running against a rate limit nobody is
   * waiting on. `Promise.race` ends the wait, not the work.
   */
  signal?: AbortSignal;
}

/**
 * Answers one trial.
 *
 * Returns an Outcome and never throws for an expected condition — the caller
 * isolates failures per resolver, but a resolver that knows why it could not
 * answer should say so with a reason rather than let the caller guess.
 */
export interface Resolver {
  answer(trial: Trial, ctx: ResolverContext): Promise<Outcome>;
}
```

- [ ] **Step 4: Implement the `repo-files` resolver**

`components/leidangr/plugins/gildi-backend/src/resolvers/repoFiles.ts`:

```ts
import { parse } from 'yaml';
import { fail, pass, unmeasured, type Outcome, type Trial } from '@siliconsaga/plugin-gildi-common';
import type { Resolver, ResolverContext } from './types';

// Absence of the artifact is an ANSWER, not an obstacle. Distinguished from a
// transport failure by the reader's NotFoundError, because "no Gemfile" must
// fail the trial while "HTTP 403" must not.
function isNotFound(err: unknown): boolean {
  return (err as { name?: string })?.name === 'NotFoundError';
}

function jobUses(body: string, expected: string): boolean {
  // Structural, not substring: `@v1` and `@main` differ by two characters and a
  // substring match would accept either. Parsed so a job's `uses` is compared
  // whole.
  const jobs = parse(body)?.jobs;
  if (!jobs || typeof jobs !== 'object') {
    return false;
  }
  return Object.values(jobs as Record<string, { uses?: unknown }>).some(
    job => typeof job?.uses === 'string' && job.uses.trim() === expected,
  );
}

export const repoFilesResolver: Resolver = {
  async answer(trial: Trial, ctx: ResolverContext): Promise<Outcome> {
    if (!ctx.sourceUrl) {
      return unmeasured('no-source', 'the component declares no source location');
    }
    const check = trial.check;
    if (!check) {
      return unmeasured('no-resolver', `trial ${trial.id} declares no check`);
    }

    let body: string;
    try {
      const base = ctx.sourceUrl.endsWith('/') ? ctx.sourceUrl : `${ctx.sourceUrl}/`;
      // signal forwarded so the budget actually stops the request, not just
      // the wait for it.
      const response = await ctx.reader.readUrl(new URL(trial.artifact, base).toString(), {
        signal: ctx.signal,
      });
      body = (await response.buffer()).toString('utf8');
    } catch (err) {
      if (isNotFound(err)) {
        return fail(`${trial.artifact} is not present`);
      }
      return unmeasured('error', `could not read ${trial.artifact}: ${err}`);
    }

    switch (check.type) {
      case 'file-contains':
        return body.includes(check.value)
          ? pass()
          : fail(`${trial.artifact} does not contain ${check.value}`);
      case 'workflow-job-uses':
        return jobUses(body, check.value)
          ? pass()
          : fail(`no job in ${trial.artifact} uses ${check.value}`);
      default:
        // pages-source-branch belongs to the other resolver. Never a pass.
        return unmeasured('no-resolver', `repo-files cannot answer ${check.type}`);
    }
  },
};
```

- [ ] **Step 5: Implement the registry**

`components/leidangr/plugins/gildi-backend/src/resolvers/registry.ts`:

```ts
import { githubPagesResolver } from './githubPages';
import { repoFilesResolver } from './repoFiles';
import type { Resolver } from './types';

// Keyed by the standard's `factSource`. An unregistered kind resolves to
// undefined and the caller records unmeasured{no-resolver} — never a pass,
// which is the failure that would silently inflate every medal.
//
// The three security fact sources are deliberately absent: they exist only in
// examples/mock-org, and writing resolvers for fictional artifacts would be
// inventing evidence.
const RESOLVERS: Record<string, Resolver> = {
  'repo-files': repoFilesResolver,
  'github-pages-api': githubPagesResolver,
};

export function resolverFor(factSource: string): Resolver | undefined {
  return RESOLVERS[factSource];
}
```

This imports `githubPagesResolver`, which Task 4 creates. To keep this task independently green, create the file now with a placeholder implementation that returns `unmeasured('no-resolver', 'not implemented')` — **and Task 4 replaces it**. Do not ship the placeholder past Task 4.

`components/leidangr/plugins/gildi-backend/src/resolvers/githubPages.ts`:

```ts
import { unmeasured, type Outcome, type Trial } from '@siliconsaga/plugin-gildi-common';
import type { Resolver, ResolverContext } from './types';

export const githubPagesResolver: Resolver = {
  async answer(_trial: Trial, _ctx: ResolverContext): Promise<Outcome> {
    return unmeasured('no-resolver', 'github-pages-api not implemented yet');
  },
};
```

- [ ] **Step 6: Run tests**

Run: `make -C components/leidangr test-app`
Expected: PASS, including all three near-miss cases.

- [ ] **Step 7: Prove the near-miss control can fail**

Temporarily change `job.uses.trim() === expected` to `job.uses.includes(expected)` in `repoFiles.ts`.

Run: `make -C components/leidangr test-app`
Expected: FAIL on "a different ref" — `@main` is a substring of nothing here, so confirm which cases break and that at least one does. **Revert and re-run to confirm PASS before continuing.** A near-miss control that cannot fail proves nothing.

- [ ] **Step 8: Commit**

Create `.commits/gildi-backend-repo-files.md`:

```markdown
---
message: "feat(gildi-backend): the resolver registry and repo-files"
add:
  - plugins/gildi-backend/src/resolvers/
---

A missing artifact fails the trial rather than reading as unmeasured, distinguished from a transport failure by the reader's NotFoundError. Absence is the answer: no Gemfile means gemfile-present fails, and getting that backwards would report a genuinely non-compliant repo as one we could not check.

`workflow-job-uses` parses the workflow and compares a job's `uses` whole. A substring match accepts `@v1` where `@main` was required, which looks green while checking nothing — the near-miss cases were verified to fail against exactly that mistake.

An unregistered factSource resolves to undefined so the caller records unmeasured, never a pass. The three security fact sources stay absent because they exist only in mock data.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-backend-repo-files.md`

---

## Task 4: The `github-pages-api` resolver

The one trial no pull request can satisfy — a repository setting, deliberately manual, so it should fail on a correct adoption until someone flips it.

**Files:**
- Modify: `plugins/gildi-backend/src/resolvers/githubPages.ts` (replace the placeholder)
- Create: `plugins/gildi-backend/src/resolvers/githubPages.test.ts`
- Modify: `plugins/gildi-backend/src/resolvers/types.ts` (add the Pages fetcher to the context)

**Interfaces:**
- Consumes: `ResolverContext` from Task 3.
- Produces: `githubPagesResolver: Resolver`, and `ResolverContext` gains `pagesSourceBranch?: (sourceUrl: string) => Promise<string | undefined>`.

**Why a function on the context rather than an Octokit call inside the resolver:** it keeps the resolver a pure decision over a fetched fact, which is what makes it testable without a network stub, and it keeps GitHub credentials in the plugin shell where the other integrations already live.

- [ ] **Step 1: Extend the context**

Add to `components/leidangr/plugins/gildi-backend/src/resolvers/types.ts`:

```ts
  /**
   * The branch GitHub Pages is configured to serve, or undefined if Pages is
   * not configured. Absent entirely when the plugin has no GitHub credentials,
   * which is a different thing and resolves to unmeasured rather than fail.
   */
  pagesSourceBranch?: (sourceUrl: string) => Promise<string | undefined>;
```

- [ ] **Step 2: Write the failing test**

`components/leidangr/plugins/gildi-backend/src/resolvers/githubPages.test.ts`:

```ts
import type { Trial } from '@siliconsaga/plugin-gildi-common';
import { githubPagesResolver } from './githubPages';
import type { ResolverContext } from './types';

const PAGES: Trial = {
  id: 'pages-source-is-gh-pages',
  rule: 'the Pages source branch is gh-pages',
  artifact: 'github-pages-settings',
  factSource: 'github-pages-api',
  check: { type: 'pages-source-branch', value: 'gh-pages' },
  remediation: './docs/pages-source.md',
};

const ctx = (over: Partial<ResolverContext>): ResolverContext =>
  ({
    entity: {} as any,
    sourceUrl: 'https://github.com/SiliconSaga/site/tree/main/',
    reader: {} as any,
    ...over,
  }) as ResolverContext;

describe('github-pages-api resolver', () => {
  it('passes when Pages serves the expected branch', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({ pagesSourceBranch: async () => 'gh-pages' }),
    );
    expect(out).toEqual({ state: 'pass' });
  });

  it('fails when Pages serves another branch', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({ pagesSourceBranch: async () => 'main' }),
    );
    expect(out.state).toBe('fail');
  });

  // Pages not configured is an ANSWER — the setting is not what the standard
  // requires — and this is the case a correct adoption sits in until a human
  // flips the switch. It must not read as unmeasured.
  it('fails when Pages is not configured at all', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({ pagesSourceBranch: async () => undefined }),
    );
    expect(out.state).toBe('fail');
  });

  it('is unmeasured when the plugin has no way to ask', async () => {
    const out = await githubPagesResolver.answer(PAGES, ctx({ pagesSourceBranch: undefined }));
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-resolver' });
  });

  it('is unmeasured when the lookup throws', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({
        pagesSourceBranch: async () => {
          throw new Error('HTTP 403');
        },
      }),
    );
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'error' });
  });

  it('is unmeasured with no source url', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({ sourceUrl: undefined, pagesSourceBranch: async () => 'gh-pages' }),
    );
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-source' });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `make -C components/leidangr test-app`
Expected: FAIL — the placeholder returns `no-resolver` for every case.

- [ ] **Step 4: Implement**

Replace `components/leidangr/plugins/gildi-backend/src/resolvers/githubPages.ts`:

```ts
import { fail, pass, unmeasured, type Outcome, type Trial } from '@siliconsaga/plugin-gildi-common';
import type { Resolver, ResolverContext } from './types';

export const githubPagesResolver: Resolver = {
  async answer(trial: Trial, ctx: ResolverContext): Promise<Outcome> {
    if (!ctx.sourceUrl) {
      return unmeasured('no-source', 'the component declares no source location');
    }
    const check = trial.check;
    if (!check || check.type !== 'pages-source-branch') {
      return unmeasured('no-resolver', `github-pages-api cannot answer ${check?.type}`);
    }
    if (!ctx.pagesSourceBranch) {
      // No credentials configured, so we cannot ask. Distinct from asking and
      // being told Pages is off, which is a real failing answer.
      return unmeasured('no-resolver', 'no GitHub Pages lookup is configured');
    }

    let branch: string | undefined;
    try {
      branch = await ctx.pagesSourceBranch(ctx.sourceUrl);
    } catch (err) {
      return unmeasured('error', `could not read the Pages configuration: ${err}`);
    }

    // Pages being unconfigured is an ANSWER, not an obstacle: the setting is
    // not what the standard asks for. This is the state a correct adoption sits
    // in until a human flips the switch, which is the point of the trial.
    if (!branch) {
      return fail('GitHub Pages is not configured for this repository');
    }
    return branch === check.value
      ? pass()
      : fail(`Pages serves ${branch}, not ${check.value}`);
  },
};
```

- [ ] **Step 5: Run tests**

Run: `make -C components/leidangr test-app`
Expected: PASS, all six cases.

- [ ] **Step 6: Commit**

Create `.commits/gildi-backend-github-pages.md`:

```markdown
---
message: "feat(gildi-backend): the github-pages-api resolver"
add:
  - plugins/gildi-backend/src/resolvers/githubPages.ts
  - plugins/gildi-backend/src/resolvers/githubPages.test.ts
  - plugins/gildi-backend/src/resolvers/types.ts
---

Pages being unconfigured FAILS the trial rather than reading as unmeasured. The setting is not what the standard asks for, and this is precisely the state a correct adoption sits in until a human flips the switch — which is the reason the trial exists.

Having no way to ask is the different case and stays unmeasured, so a missing credential never looks like a non-compliant repository.

The lookup arrives on the context rather than being an Octokit call inside the resolver, which keeps the resolver a decision over a fetched fact and keeps credentials in the plugin shell.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-backend-github-pages.md`

---

## Task 5: The evaluator

**Files:**
- Create: `plugins/gildi-backend/src/evaluate.ts`, `src/evaluate.test.ts`

**Interfaces:**
- Consumes: `applicableTrials` (Task 1), `loadStandard`/`standardUrlFor` (Task 2), `resolverFor` (Task 3), `verdictFor`/`unevaluatedVerdict` from `gildi-common`.
- Produces: `evaluate(input: EvaluateInput): Promise<RunResult>` where

```ts
interface RunResult {
  verdict: Verdict;
  outcomes: Array<{ trialId: string } & Outcome>;
  moduleRelease?: string;
}
```

- [ ] **Step 1: Write the failing test**

`components/leidangr/plugins/gildi-backend/src/evaluate.test.ts`:

```ts
import { pass, unmeasured } from '@siliconsaga/plugin-gildi-common';
import type { Standard } from '@siliconsaga/plugin-gildi-common';
import { evaluate } from './evaluate';

const STANDARD: Standard = {
  id: 'website-hygiene',
  aspect: 'website-hygiene',
  facetDefaults: { website: ['web-ui'] },
  blocks: [
    {
      id: 'build',
      appliesTo: ['web-ui'],
      trials: [
        {
          id: 'a',
          rule: 'r',
          artifact: 'A',
          factSource: 'repo-files',
          check: { type: 'file-contains', value: 'x' },
          remediation: './f.md',
        },
        {
          id: 'b',
          rule: 'r',
          artifact: 'B',
          factSource: 'nope',
          remediation: './f.md',
        },
      ],
    },
  ],
};

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'site' },
  spec: { type: 'website' },
} as any;

const base = {
  entity,
  sourceUrl: 'https://github.com/o/r/tree/main/',
  reader: {} as any,
  moduleRelease: '1.1',
};

describe('evaluate', () => {
  it('answers each applicable trial through its resolver', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      resolverFor: kind => (kind === 'repo-files' ? { answer: async () => pass() } : undefined),
    });
    expect(result.outcomes).toEqual([
      { trialId: 'a', state: 'pass' },
      // An unregistered factSource is unmeasured, never a pass.
      { trialId: 'b', state: 'unmeasured', reason: 'no-resolver' },
    ]);
    expect(result.verdict.kind).toBe('suppressed');
  });

  it('records module release on the run', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      resolverFor: () => ({ answer: async () => pass() }),
    });
    expect(result.moduleRelease).toBe('1.1');
  });

  // ISOLATION. A resolver that throws must not take the others with it.
  it('isolates a throwing resolver to its own trials', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      resolverFor: kind =>
        kind === 'repo-files'
          ? {
              answer: async () => {
                throw new Error('boom');
              },
            }
          : undefined,
    });
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes[0]).toMatchObject({ trialId: 'a', state: 'unmeasured', reason: 'error' });
  });

  // THE DISTINCTION THAT MATTERS MOST. No standard means we never learned what
  // the trials are, so the run is unevaluated — not an empty applicable set,
  // which would derive a confident medal `none`.
  it('returns an unevaluated run when the standard is absent', async () => {
    const result = await evaluate({ ...base, standard: undefined, resolverFor: () => undefined });
    expect(result.verdict).toMatchObject({ kind: 'unevaluated', reason: 'no-standard' });
    expect(result.outcomes).toEqual([]);
    expect(result.verdict).not.toMatchObject({ kind: 'medal' });
  });

  it('awards a medal when everything applicable passes', async () => {
    const oneTrial: Standard = {
      ...STANDARD,
      blocks: [{ ...STANDARD.blocks[0], trials: [STANDARD.blocks[0].trials[0]] }],
    };
    const result = await evaluate({
      ...base,
      standard: oneTrial,
      resolverFor: () => ({ answer: async () => pass() }),
    });
    expect(result.verdict).toMatchObject({ kind: 'medal', medal: 'gold', applicable: 1, passing: 1 });
  });

  // A hanging resolver must not stretch the run, and the message has to tell
  // the trial's author what to do. Unmeasured rather than fail: we never got an
  // answer, so blaming the component would be the wrong way round.
  it('bounds a hanging trial and says how to fix it', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      timeoutMs: 20,
      resolverFor: kind =>
        kind === 'repo-files'
          ? { answer: () => new Promise(() => {}) as Promise<never> }
          : undefined,
    });
    expect(result.outcomes[0]).toMatchObject({
      trialId: 'a',
      state: 'unmeasured',
      reason: 'error',
    });
    expect(result.outcomes[0].detail).toMatch(/smaller or faster/);
    // The other trial still got its answer.
    expect(result.outcomes).toHaveLength(2);
  });

  it('marks every trial unmeasured when told the resolver set is empty', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      resolverFor: () => undefined,
    });
    expect(result.outcomes.every(o => o.state === 'unmeasured')).toBe(true);
    expect(unmeasured('no-resolver').state).toBe('unmeasured');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `make -C components/leidangr test-app`
Expected: FAIL — `Cannot find module './evaluate'`.

- [ ] **Step 3: Implement**

`components/leidangr/plugins/gildi-backend/src/evaluate.ts`:

```ts
import type { Entity } from '@backstage/catalog-model';
import type { UrlReaderService } from '@backstage/backend-plugin-api';
import {
  unevaluatedVerdict,
  unmeasured,
  verdictFor,
  type Outcome,
  type Standard,
  type Verdict,
} from '@siliconsaga/plugin-gildi-common';
import { applicableTrials } from './facets';
import type { Resolver, ResolverContext } from './resolvers/types';

export interface EvaluateInput {
  entity: Entity;
  /** Undefined when the standard could not be found or read. */
  standard: Standard | undefined;
  sourceUrl?: string;
  reader: UrlReaderService;
  moduleRelease?: string;
  resolverFor: (factSource: string) => Resolver | undefined;
  pagesSourceBranch?: ResolverContext['pagesSourceBranch'];
  /** Per-trial budget. Defaults to TRIAL_TIMEOUT_MS. */
  timeoutMs?: number;
}

// A trial is meant to be small: read one artifact, compare one value. Five
// minutes is not a performance target, it is the point past which the trial is
// the problem rather than the network. Bounding each trial rather than only the
// sweep means one slow resolver cannot stretch every component's run, and the
// detail says what to do about it.
export const TRIAL_TIMEOUT_MS = 5 * 60 * 1000;

// Races the budget AND aborts the work. Promise.race alone only stops waiting:
// the resolver's HTTP request would keep running, spending rate limit on an
// answer nobody will read, and at hourly sweeps those accumulate.
function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new Error(
          `${label} exceeded ${ms}ms. A trial should read one artifact and compare one value — make it smaller or faster rather than raising this budget.`,
        ),
      );
    }, ms);
  });
  return Promise.race([run(controller.signal), expiry]).finally(() =>
    clearTimeout(timer),
  ) as Promise<T>;
}

export interface RunResult {
  verdict: Verdict;
  outcomes: Array<{ trialId: string } & Outcome>;
  moduleRelease?: string;
}

export async function evaluate(input: EvaluateInput): Promise<RunResult> {
  // No standard means we never learned what the trials ARE. Passing [] to
  // verdictFor would derive medal `none` — "measured, and nothing passed" —
  // publishing a verdict about a component on the strength of our own failure.
  // Design §7.
  if (!input.standard) {
    return {
      verdict: unevaluatedVerdict('no-standard'),
      outcomes: [],
      moduleRelease: input.moduleRelease,
    };
  }

  const ctx: ResolverContext = {
    entity: input.entity,
    sourceUrl: input.sourceUrl,
    reader: input.reader,
    pagesSourceBranch: input.pagesSourceBranch,
  };

  const trials = applicableTrials(input.entity, input.standard);
  const outcomes: Array<{ trialId: string } & Outcome> = [];

  for (const trial of trials) {
    const resolver = input.resolverFor(trial.factSource);
    if (!resolver) {
      outcomes.push({
        trialId: trial.id,
        ...unmeasured('no-resolver', `no resolver for ${trial.factSource}`),
      });
      continue;
    }
    // Isolated per trial, and BOUNDED per trial: a throwing or hanging resolver
    // marks only its own and never takes the rest of the run with it. Design §7.
    //
    // A timeout is unmeasured{error}, NOT fail. We never got an answer, and
    // calling that a failure would blame the component for our slow resolver —
    // the same inversion as treating a missing resolver as a failing trial. The
    // actionable message rides in the detail, where the trial's author reads it.
    try {
      outcomes.push({
        trialId: trial.id,
        ...(await withTimeout(
          signal => resolver.answer(trial, { ...ctx, signal }),
          input.timeoutMs ?? TRIAL_TIMEOUT_MS,
          `trial ${trial.id}`,
        )),
      });
    } catch (err) {
      outcomes.push({ trialId: trial.id, ...unmeasured('error', String(err)) });
    }
  }

  return {
    verdict: verdictFor(outcomes.map(({ trialId: _id, ...o }) => o as Outcome)),
    outcomes,
    moduleRelease: input.moduleRelease,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `make -C components/leidangr test-app`
Expected: PASS, all six cases.

- [ ] **Step 5: Prove the unevaluated distinction can fail**

Temporarily change the `if (!input.standard)` early return to `return { verdict: verdictFor([]), outcomes: [], moduleRelease: input.moduleRelease };`.

Run: `make -C components/leidangr test-app`
Expected: FAIL on "returns an unevaluated run when the standard is absent" — the verdict becomes `{kind:'medal', medal:'none'}`, which is the exact confident-but-wrong answer the design forbids. **Revert and re-run to confirm PASS.**

- [ ] **Step 6: Commit**

Create `.commits/gildi-backend-evaluate.md`:

```markdown
---
message: "feat(gildi-backend): the evaluator"
add:
  - plugins/gildi-backend/src/evaluate.ts
  - plugins/gildi-backend/src/evaluate.test.ts
---

An absent standard produces an unevaluated run rather than an empty applicable set. The difference is not cosmetic: `verdictFor([])` returns medal `none`, which means measured and nothing passed, so the tempting shortcut publishes a verdict about a component on the strength of our own failure to read a file. Verified by making exactly that substitution and watching the test catch it.

Resolver failures are isolated per trial. One throwing resolver marks its own trials unmeasured and leaves the others answered, so a single broken integration cannot blank a component's whole record.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-backend-evaluate.md`

---

## Task 6: The append-only store

**Files:**
- Create: `plugins/gildi-backend/migrations/20260905000000_init.js`
- Create: `plugins/gildi-backend/src/store.ts`, `src/store.test.ts`

**Interfaces:**
- Consumes: `RunResult` (Task 5), `DatabaseService` from `@backstage/backend-plugin-api`.
- Produces:

```ts
interface TrialRun {
  entityRef: string; aspectId: string; runAt: string;
  kind: 'evaluated' | 'unevaluated';
  moduleRelease?: string;
  medal: string | null; suppressedReasons: string[] | null;
  applicable: number | null; passing: number | null;
  outcomes: Array<{ trialId: string; state: string; reason?: string; detail?: string }> | null;
  unevaluatedReason?: string; unevaluatedDetail?: string;
}
interface TrialResultStore {
  append(run: TrialRun): Promise<void>;
  latest(entityRef: string, aspectId: string): Promise<TrialRun | undefined>;
  history(entityRef: string, aspectId: string, limit?: number): Promise<TrialRun[]>;
}
```

- [ ] **Step 1: Write the migration**

`components/leidangr/plugins/gildi-backend/migrations/20260905000000_init.js`:

```js
/**
 * Append-only: one row per run, never an upsert. That makes the history
 * chartable and dissolves the "keep last-good or overwrite on error" question
 * rather than answering it — an errored run is simply another row and the
 * previous good one still exists. See design §8.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('gildi_trial_runs', table => {
    table.increments('id').primary();
    table.string('entity_ref').notNullable();
    table.string('aspect_id').notNullable();
    table.dateTime('run_at').notNullable();
    table.string('kind').notNullable();
    table.string('module_release').nullable();
    table.string('medal').nullable();
    table.text('suppressed_reasons').nullable();
    // NULL, not zero, on an unevaluated run: zero applicable is a real and
    // different claim — the standard loaded and nothing applied.
    table.integer('applicable').nullable();
    table.integer('passing').nullable();
    table.text('outcomes').nullable();
    table.string('unevaluated_reason').nullable();
    table.text('unevaluated_detail').nullable();
    table.index(['entity_ref', 'aspect_id', 'run_at'], 'gildi_trial_runs_subject_idx');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('gildi_trial_runs');
};
```

- [ ] **Step 2: Write the failing test**

`components/leidangr/plugins/gildi-backend/src/store.test.ts`:

```ts
import { TestDatabases } from '@backstage/backend-test-utils';
import { DatabaseTrialResultStore } from './store';

jest.setTimeout(60_000);

describe('DatabaseTrialResultStore', () => {
  const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

  async function store() {
    const knex = await databases.init('SQLITE_3');
    return DatabaseTrialResultStore.create({
      getClient: async () => knex,
    } as any);
  }

  const run = (over: Partial<Parameters<Awaited<ReturnType<typeof store>>['append']>[0]> = {}) => ({
    entityRef: 'component:default/site',
    aspectId: 'website-hygiene',
    runAt: '2026-09-05T10:00:00.000Z',
    kind: 'evaluated' as const,
    moduleRelease: '1.1',
    medal: 'gold',
    suppressedReasons: null,
    applicable: 2,
    passing: 2,
    outcomes: [{ trialId: 'a', state: 'pass' }],
    ...over,
  });

  it('returns undefined before anything is stored', async () => {
    const s = await store();
    expect(await s.latest('component:default/nobody', 'website-hygiene')).toBeUndefined();
  });

  it('round-trips a run', async () => {
    const s = await store();
    await s.append(run());
    const got = await s.latest('component:default/site', 'website-hygiene');
    expect(got).toMatchObject({ medal: 'gold', applicable: 2, passing: 2, moduleRelease: '1.1' });
    expect(got?.outcomes).toEqual([{ trialId: 'a', state: 'pass' }]);
  });

  // APPEND-ONLY. A second run must not replace the first.
  it('keeps earlier runs rather than overwriting them', async () => {
    const s = await store();
    await s.append(run({ runAt: '2026-09-05T10:00:00.000Z', medal: 'gold' }));
    await s.append(run({ runAt: '2026-09-05T11:00:00.000Z', medal: 'silver' }));
    const history = await s.history('component:default/site', 'website-hygiene');
    expect(history).toHaveLength(2);
    expect(history[0].medal).toBe('silver'); // newest first
    expect(await s.latest('component:default/site', 'website-hygiene')).toMatchObject({
      medal: 'silver',
    });
  });

  // An errored run does not destroy the last good one — that is the whole
  // reason the store appends rather than upserts.
  it('preserves the previous good run alongside an unevaluated one', async () => {
    const s = await store();
    await s.append(run({ runAt: '2026-09-05T10:00:00.000Z', medal: 'gold' }));
    await s.append(
      run({
        runAt: '2026-09-05T11:00:00.000Z',
        kind: 'unevaluated',
        medal: null,
        applicable: null,
        passing: null,
        outcomes: null,
        unevaluatedReason: 'no-standard',
        unevaluatedDetail: 'HTTP 404',
      }),
    );
    const history = await s.history('component:default/site', 'website-hygiene');
    expect(history[0]).toMatchObject({
      kind: 'unevaluated',
      medal: null,
      applicable: null,
      unevaluatedReason: 'no-standard',
      unevaluatedDetail: 'HTTP 404',
    });
    expect(history[1]).toMatchObject({ medal: 'gold', applicable: 2 });
  });

  it('stores null counts as null rather than zero', async () => {
    // Zero is a real, different claim: the standard loaded and nothing applied.
    const s = await store();
    await s.append(
      run({ kind: 'unevaluated', medal: null, applicable: null, passing: null, outcomes: null }),
    );
    const got = await s.latest('component:default/site', 'website-hygiene');
    expect(got?.applicable).toBeNull();
    expect(got?.passing).toBeNull();
  });

  it('keeps subjects apart', async () => {
    const s = await store();
    await s.append(run());
    await s.append(run({ entityRef: 'component:default/other', medal: 'bronze' }));
    expect(await s.latest('component:default/other', 'website-hygiene')).toMatchObject({
      medal: 'bronze',
    });
  });

  // RETENTION, two-tier (design §8). Recent runs stay at full resolution and
  // older days collapse to one, so a fixed row budget reaches most of a year
  // instead of three weeks.
  describe('prune', () => {
    const ago = (days: number, hour: number) =>
      new Date(Date.now() - days * 86_400_000 + hour * 3_600_000).toISOString();

    it('keeps every run inside the hourly window', async () => {
      const s = await store();
      for (const hour of [0, 1, 2, 3]) {
        await s.append(run({ runAt: ago(1, hour), medal: 'gold' }));
      }
      await s.prune({ keep: 500, hourlyDays: 7 });
      expect(await s.history('component:default/site', 'website-hygiene')).toHaveLength(4);
    });

    // THE ONE THAT MATTERS. Beyond the window a day collapses to its WORST run,
    // not its newest — otherwise an outage that recovered before midnight
    // disappears from the chart entirely, which is the day a reader is looking
    // for.
    it('collapses an older day to its worst run, not its latest', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(30, 1), medal: 'gold' }));
      await s.append(run({ runAt: ago(30, 2), medal: 'bronze' }));
      await s.append(run({ runAt: ago(30, 3), medal: 'gold' }));

      await s.prune({ keep: 500, hourlyDays: 7 });

      const kept = await s.history('component:default/site', 'website-hygiene');
      expect(kept).toHaveLength(1);
      expect(kept[0].medal).toBe('bronze');
    });

    it('ranks an unevaluated day as worse than any medal', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(30, 1), medal: 'gold' }));
      await s.append(
        run({
          runAt: ago(30, 2),
          kind: 'unevaluated',
          medal: null,
          applicable: null,
          passing: null,
          outcomes: null,
          unevaluatedReason: 'no-standard',
        }),
      );
      await s.prune({ keep: 500, hourlyDays: 7 });

      const kept = await s.history('component:default/site', 'website-hygiene');
      expect(kept).toHaveLength(1);
      expect(kept[0].kind).toBe('unevaluated');
    });

    // The cap must order by RUN TIME, not row id. Appending oldest-last makes
    // insertion order the reverse of chronological order, so a cap that sorts
    // by id keeps exactly the wrong two. Asserting the count alone would pass
    // either way, which is how this went unnoticed the first time.
    it('caps to the NEWEST runs even when they were inserted oldest-last', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(10, 1), medal: 'gold' }));
      await s.append(run({ runAt: ago(20, 1), medal: 'silver' }));
      await s.append(run({ runAt: ago(30, 1), medal: 'bronze' }));
      await s.append(run({ runAt: ago(40, 1), medal: 'none' }));

      await s.prune({ keep: 2, hourlyDays: 7 });

      const kept = await s.history('component:default/site', 'website-hygiene');
      expect(kept).toHaveLength(2);
      expect(kept.map(r => r.medal)).toEqual(['gold', 'silver']);
    });

    it('does not delete a run appended while it is working', async () => {
      // A refresh can land mid-prune. The new row is not in the survivor
      // snapshot, and without an id ceiling the delete would take it.
      const s = await store();
      for (const day of [10, 20, 30]) {
        await s.append(run({ runAt: ago(day, 1), medal: 'gold' }));
      }
      const pruning = s.prune({ keep: 1, hourlyDays: 7 });
      await s.append(run({ runAt: new Date().toISOString(), medal: 'silver' }));
      await pruning;

      const kept = await s.history('component:default/site', 'website-hygiene');
      expect(kept.some(r => r.medal === 'silver')).toBe(true);
    });

    it('leaves other subjects untouched', async () => {
      const s = await store();
      await s.append(run({ runAt: ago(30, 1) }));
      await s.append(run({ runAt: ago(30, 2), entityRef: 'component:default/other' }));
      await s.prune({ keep: 500, hourlyDays: 7 });
      expect(await s.history('component:default/other', 'website-hygiene')).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `make -C components/leidangr test-app`
Expected: FAIL — `Cannot find module './store'`.

- [ ] **Step 4: Implement**

`components/leidangr/plugins/gildi-backend/src/store.ts`:

```ts
import { resolvePackagePath, type DatabaseService } from '@backstage/backend-plugin-api';
import type { Knex } from 'knex';

export interface TrialOutcomeRow {
  trialId: string;
  state: string;
  reason?: string;
  detail?: string;
}

export interface TrialRun {
  entityRef: string;
  aspectId: string;
  runAt: string;
  kind: 'evaluated' | 'unevaluated';
  moduleRelease?: string;
  medal: string | null;
  suppressedReasons: string[] | null;
  applicable: number | null;
  passing: number | null;
  outcomes: TrialOutcomeRow[] | null;
  unevaluatedReason?: string;
  unevaluatedDetail?: string;
}

/**
 * The seam that lets the runner and the store be replaced independently later
 * (design §10). Knex-backed today, and the only implementation.
 */
export interface TrialResultStore {
  append(run: TrialRun): Promise<void>;
  latest(entityRef: string, aspectId: string): Promise<TrialRun | undefined>;
  history(entityRef: string, aspectId: string, limit?: number): Promise<TrialRun[]>;
  /** Two-tier retention. Returns how many rows were removed. */
  prune(opts: { keep: number; hourlyDays: number }): Promise<number>;
}

const TABLE = 'gildi_trial_runs';

// JSON columns rather than a row per trial: we never query by trial, and a blob
// avoids schema churn while the outcome union is young.
const parseJson = <T>(value: unknown): T | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

// SQLite has no boolean/JSON types and returns integers for both, so counts are
// normalised on the way out. `?? null` rather than `|| null` because 0 is a
// legitimate stored value and must survive.
const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export class DatabaseTrialResultStore implements TrialResultStore {
  static async create(database: DatabaseService): Promise<DatabaseTrialResultStore> {
    const client = await database.getClient();
    await client.migrate.latest({
      directory: resolvePackagePath('@siliconsaga/plugin-gildi-backend', 'migrations'),
    });
    return new DatabaseTrialResultStore(client);
  }

  private constructor(private readonly db: Knex) {}

  async append(run: TrialRun): Promise<void> {
    await this.db(TABLE).insert({
      entity_ref: run.entityRef,
      aspect_id: run.aspectId,
      run_at: run.runAt,
      kind: run.kind,
      module_release: run.moduleRelease ?? null,
      medal: run.medal,
      suppressed_reasons: run.suppressedReasons
        ? JSON.stringify(run.suppressedReasons)
        : null,
      applicable: run.applicable,
      passing: run.passing,
      outcomes: run.outcomes ? JSON.stringify(run.outcomes) : null,
      unevaluated_reason: run.unevaluatedReason ?? null,
      unevaluated_detail: run.unevaluatedDetail ?? null,
    });
  }

  async latest(entityRef: string, aspectId: string): Promise<TrialRun | undefined> {
    const [row] = await this.history(entityRef, aspectId, 1);
    return row;
  }

  async history(entityRef: string, aspectId: string, limit = 100): Promise<TrialRun[]> {
    const rows = await this.db(TABLE)
      .where({ entity_ref: entityRef, aspect_id: aspectId })
      .orderBy([
        { column: 'run_at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .limit(limit);
    return rows.map((r: Record<string, unknown>) => ({
      entityRef: String(r.entity_ref),
      aspectId: String(r.aspect_id),
      runAt: new Date(r.run_at as string).toISOString(),
      kind: r.kind as TrialRun['kind'],
      moduleRelease: (r.module_release as string) ?? undefined,
      medal: (r.medal as string) ?? null,
      suppressedReasons: parseJson<string[]>(r.suppressed_reasons),
      applicable: num(r.applicable),
      passing: num(r.passing),
      outcomes: parseJson<TrialOutcomeRow[]>(r.outcomes),
      unevaluatedReason: (r.unevaluated_reason as string) ?? undefined,
      unevaluatedDetail: (r.unevaluated_detail as string) ?? undefined,
    }));
  }

  /**
   * Two-tier retention: full resolution recently, one run per day beyond that.
   *
   * Flat count retention does not stretch far enough to be useful. At hourly
   * sweeps, 500 rows is under three weeks — shorter than the window in which
   * "when did this break" is usually asked. Keeping every run for a week and
   * then one per day makes the same 500 rows reach most of a year.
   *
   * The survivor for an older day is the WORST run of that day, not the newest.
   * A day where the medal dropped or the run could not be evaluated is the day
   * worth seeing on the chart, and keeping the last run of the day would hide
   * an outage that recovered before midnight.
   */
  async prune(opts: { keep: number; hourlyDays: number }): Promise<number> {
    const cutoff = Date.now() - opts.hourlyDays * 24 * 60 * 60 * 1000;
    const subjects = await this.db(TABLE).distinct('entity_ref', 'aspect_id');
    let removed = 0;

    for (const s of subjects) {
      const rows: Array<Record<string, unknown>> = await this.db(TABLE)
        .where({ entity_ref: s.entity_ref, aspect_id: s.aspect_id })
        .orderBy([
          { column: 'run_at', order: 'desc' },
          { column: 'id', order: 'desc' },
        ]);

      // Survivors carry their timestamp, because the cap below must order by
      // RUN TIME and not by row id. `runAt` is caller-supplied, so insertion
      // order and chronological order are not the same thing — capping by id
      // silently keeps the oldest runs when history is backfilled or a refresh
      // races a sweep.
      const survivors: Array<{ id: number; at: number }> = [];
      const bestOfDay = new Map<string, Record<string, unknown>>();

      for (const row of rows) {
        const at = new Date(row.run_at as string).getTime();
        if (at >= cutoff) {
          survivors.push({ id: Number(row.id), at });
          continue;
        }
        const day = new Date(at).toISOString().slice(0, 10);
        const held = bestOfDay.get(day);
        if (!held || rankOf(row) < rankOf(held)) {
          bestOfDay.set(day, row);
        }
      }
      for (const row of bestOfDay.values()) {
        survivors.push({ id: Number(row.id), at: new Date(row.run_at as string).getTime() });
      }

      // Hard cap last, newest first, so a very long history still cannot grow
      // without bound however the tiers fall.
      const capped = survivors
        .sort((a, b) => b.at - a.at || b.id - a.id)
        .slice(0, opts.keep)
        .map(s2 => s2.id);

      // Deleted inside a transaction, bounded to rows that existed when the
      // snapshot was taken. A refresh can append while this runs, and without
      // the id ceiling that brand-new row is absent from `capped` and would be
      // deleted — losing the very run someone just asked for.
      await this.db.transaction(async tx => {
        const ceiling = rows.length ? Math.max(...rows.map(r => Number(r.id))) : 0;
        removed += await tx(TABLE)
          .where({ entity_ref: s.entity_ref, aspect_id: s.aspect_id })
          .where('id', '<=', ceiling)
          .whereNotIn('id', capped)
          .delete();
      });
    }
    return removed;
  }
}

// Lower is worse. Unevaluated ranks below suppressed, and both below `none`:
// `none` is at least a measurement, while the other two mean the run could not
// say. On a downsampled chart the reader wants the day something went wrong,
// not the day's tidiest number.
function rankOf(row: Record<string, unknown>): number {
  if (row.kind === 'unevaluated') return 0;
  const medal = row.medal as string | null;
  if (!medal) return 1; // suppressed
  return { none: 2, bronze: 3, silver: 4, gold: 5 }[medal] ?? 2;
}
```

- [ ] **Step 5: Run tests**

Run: `make -C components/leidangr test-app`
Expected: PASS, all six cases. These use a real SQLite database via `TestDatabases`, so the first run is slower than the pure-function suites.

- [ ] **Step 6: Commit**

Create `.commits/gildi-backend-store.md`:

```markdown
---
message: "feat(gildi-backend): the append-only run store"
add:
  - plugins/gildi-backend/migrations/
  - plugins/gildi-backend/src/store.ts
  - plugins/gildi-backend/src/store.test.ts
---

One row per run, never an upsert. That makes the history chartable and dissolves the keep-last-good-on-error question rather than answering it — an errored run is simply another row, and the previous good one is still there, which a test pins directly.

Counts are stored NULL rather than zero on an unevaluated run. Zero applicable is a real and different claim: the standard loaded and nothing applied to this component.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-backend-store.md`

---

## Task 7: The plugin shell, scheduler and router

The first task with no pure-function core, so its tests use `startTestBackend` rather than unit stubs.

**Files:**
- Create: `plugins/gildi-backend/src/plugin.ts`, `src/router.ts`, `src/index.ts`
- Create: `plugins/gildi-backend/src/router.test.ts`
- Modify: `packages/backend/src/index.ts`, `packages/backend/package.json`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `gildiPlugin` (default export), and three endpoints:
  - `GET /api/gildi/trials/:entityRef?aspect=<id>` → latest run or 404
  - `GET /api/gildi/trials/:entityRef/history?aspect=<id>&limit=<n>` → `{ runs, events }`
  - `POST /api/gildi/trials/:entityRef/refresh?aspect=<id>` → the fresh run

- [ ] **Step 1: Write the router with derived events**

`components/leidangr/plugins/gildi-backend/src/router.ts`:

```ts
import { InputError, NotFoundError } from '@backstage/errors';
import type { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import type { TrialResultStore, TrialRun } from './store';

export interface HistoryEvent {
  type: 'release-changed' | 'medal-earned';
  at: string;
  from?: string;
  to?: string;
  medal?: string;
  first?: boolean;
}

/**
 * Derived SERVER-SIDE so every client agrees on the semantics and no consumer
 * re-implements them. Takes runs newest-first and reads them oldest-first,
 * because both event kinds are about transitions.
 */
export function eventsFor(runsNewestFirst: TrialRun[]): HistoryEvent[] {
  const runs = [...runsNewestFirst].reverse();
  const events: HistoryEvent[] = [];
  const seenMedals = new Set<string>();
  let release: string | undefined;
  let heldMedal: string | undefined;

  for (const run of runs) {
    if (run.moduleRelease && run.moduleRelease !== release) {
      if (release !== undefined) {
        events.push({
          type: 'release-changed',
          at: run.runAt,
          from: release,
          to: run.moduleRelease,
        });
      }
      release = run.moduleRelease;
    }

    // `none` is a real verdict but not an earned medal, and a suppressed run
    // has medal null — neither is a moment worth marking on a chart.
    const medal = run.medal && run.medal !== 'none' ? run.medal : undefined;

    // TRANSITIONS, not occurrences. Emitting per run would put twenty-four
    // identical "earned gold" marks on a day where nothing happened, burying
    // the one day it changed. `heldMedal` tracks what the component currently
    // holds, so losing gold and regaining it is two events while holding it is
    // none.
    if (medal && medal !== heldMedal) {
      events.push({
        type: 'medal-earned',
        at: run.runAt,
        medal,
        first: !seenMedals.has(medal),
      });
      seenMedals.add(medal);
    }
    heldMedal = medal;
  }
  return events;
}

export function createRouter(options: {
  store: TrialResultStore;
  httpAuth: HttpAuthService;
  refresh: (entityRef: string, aspectId: string) => Promise<TrialRun>;
}): express.Router {
  const { store, httpAuth, refresh } = options;
  const router = express.Router();
  router.use(express.json());

  const aspectOf = (req: express.Request): string => {
    const aspect = req.query.aspect;
    if (typeof aspect !== 'string' || !aspect.trim()) {
      throw new InputError('an aspect query parameter is required');
    }
    return aspect.trim();
  };

  router.get('/trials/:entityRef', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const run = await store.latest(req.params.entityRef, aspectOf(req));
    if (!run) {
      throw new NotFoundError(`no run recorded for ${req.params.entityRef}`);
    }
    res.json(run);
  });

  router.get('/trials/:entityRef/history', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new InputError('limit must be a positive number');
    }
    const runs = await store.history(req.params.entityRef, aspectOf(req), limit);
    res.json({ runs, events: eventsFor(runs) });
  });

  router.post('/trials/:entityRef/refresh', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    res.json(await refresh(req.params.entityRef, aspectOf(req)));
  });

  return router;
}
```

- [ ] **Step 2: Write the failing test**

`components/leidangr/plugins/gildi-backend/src/router.test.ts`:

```ts
import { eventsFor } from './router';
import type { TrialRun } from './store';

const run = (over: Partial<TrialRun>): TrialRun => ({
  entityRef: 'component:default/site',
  aspectId: 'website-hygiene',
  runAt: '2026-09-01T00:00:00.000Z',
  kind: 'evaluated',
  medal: 'gold',
  suppressedReasons: null,
  applicable: 1,
  passing: 1,
  outcomes: [],
  ...over,
});

describe('eventsFor', () => {
  it('is empty for a single run, because nothing has changed yet', () => {
    expect(eventsFor([run({ moduleRelease: '1.1', medal: null })])).toEqual([]);
  });

  it('marks a release change but not the first release seen', () => {
    const events = eventsFor([
      run({ runAt: '2026-09-02T00:00:00.000Z', moduleRelease: '1.1', medal: null }),
      run({ runAt: '2026-09-01T00:00:00.000Z', moduleRelease: '1.0', medal: null }),
    ]);
    expect(events).toEqual([
      { type: 'release-changed', at: '2026-09-02T00:00:00.000Z', from: '1.0', to: '1.1' },
    ]);
  });

  it('marks a medal the first time and flags re-earning after losing it', () => {
    const events = eventsFor([
      run({ runAt: '2026-09-03T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-02T00:00:00.000Z', medal: null }),
      run({ runAt: '2026-09-01T00:00:00.000Z', medal: 'gold' }),
    ]);
    expect(events.filter(e => e.type === 'medal-earned')).toEqual([
      { type: 'medal-earned', at: '2026-09-01T00:00:00.000Z', medal: 'gold', first: true },
      { type: 'medal-earned', at: '2026-09-03T00:00:00.000Z', medal: 'gold', first: false },
    ]);
  });

  // TRANSITIONS, not occurrences. At hourly sweeps a steady component would
  // otherwise collect twenty-four identical marks a day, burying the one day
  // its medal actually changed.
  it('emits nothing further while a medal is simply held', () => {
    const events = eventsFor([
      run({ runAt: '2026-09-03T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-02T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-01T00:00:00.000Z', medal: 'gold' }),
    ]);
    expect(events.filter(e => e.type === 'medal-earned')).toEqual([
      { type: 'medal-earned', at: '2026-09-01T00:00:00.000Z', medal: 'gold', first: true },
    ]);
  });

  it('treats an upgrade as its own transition', () => {
    const events = eventsFor([
      run({ runAt: '2026-09-02T00:00:00.000Z', medal: 'gold' }),
      run({ runAt: '2026-09-01T00:00:00.000Z', medal: 'silver' }),
    ]);
    expect(events.map(e => e.medal)).toEqual(['silver', 'gold']);
  });

  it('does not treat none or a suppressed run as an earned medal', () => {
    // `none` is a real verdict but not an achievement, and a suppressed run has
    // no medal at all. Neither belongs on the chart as a moment.
    expect(
      eventsFor([run({ medal: 'none' }), run({ medal: null })]).filter(
        e => e.type === 'medal-earned',
      ),
    ).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails, then passes**

Run: `make -C components/leidangr test-app`
Expected: FAIL first if `router.ts` is not yet saved, then PASS once step 1's file is in place. Write the test before saving `router.ts` if you want the failure to be real.

- [ ] **Step 4: Write the plugin shell**

`components/leidangr/plugins/gildi-backend/src/plugin.ts`:

```ts
import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { ANNOTATION_SOURCE_LOCATION, parseLocationRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';
import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import { Octokit } from '@octokit/rest';
import { evaluate } from './evaluate';
import { resolverFor } from './resolvers/registry';
import { loadStandard, standardUrlFor } from './standard';
import { DatabaseTrialResultStore, type TrialRun } from './store';
import { createRouter } from './router';

const ASPECTS = 'siliconsaga.org/aspects';
const ASPECT = 'siliconsaga.org/aspect';
const MODULE_RELEASE = 'siliconsaga.org/module-release';

// Two tiers, sized so a fixed row budget covers most of a year rather than
// three weeks. A week at full hourly resolution is 168 rows, and every day
// beyond that costs one more — so 500 reaches roughly eleven months. A flat
// count at hourly resolution would run out after twenty days, which is inside
// the window where "when did this break" is usually asked.
const RUNS_KEPT_PER_SUBJECT = 500;
const HOURLY_RETENTION_DAYS = 7;

// `https://github.com/owner/repo/tree/main/` -> { owner, repo }. The Pages API
// needs the slug, and the source location is a tree URL rather than a repo URL.
function parseGithubSlug(sourceUrl: string): { owner: string; repo: string } {
  const [, owner, repo] = new URL(sourceUrl).pathname.split('/');
  if (!owner || !repo) {
    throw new Error(`cannot parse an owner and repo from ${sourceUrl}`);
  }
  return { owner, repo };
}

const sourceUrlOf = (entity: Entity): string | undefined => {
  const raw = entity.metadata.annotations?.[ANNOTATION_SOURCE_LOCATION];
  if (!raw) return undefined;
  try {
    return parseLocationRef(raw).target;
  } catch {
    return undefined;
  }
};

export const gildiPlugin = createBackendPlugin({
  pluginId: 'gildi',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        scheduler: coreServices.scheduler,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        reader: coreServices.urlReader,
        catalog: catalogServiceRef,
      },
      async init({ config, logger, database, scheduler, httpRouter, httpAuth, auth, reader, catalog }) {
        const store = await DatabaseTrialResultStore.create(database);

        // WITHOUT THIS THE FEATURE NEVER AWARDS A MEDAL. pages-source-is-gh-pages
        // applies to every website component, and a resolver with no way to ask
        // returns unmeasured — which suppresses the medal. One unwired lookup
        // therefore suppresses every medal in the catalog, permanently and
        // silently. The resolver was built with the lookup on its context to
        // stay testable, and this is where that context gets filled in.
        const integrations = ScmIntegrations.fromConfig(config);
        const githubCredentials = DefaultGithubCredentialsProvider.fromIntegrations(integrations);

        const pagesSourceBranch = async (sourceUrl: string): Promise<string | undefined> => {
          const { owner, repo } = parseGithubSlug(sourceUrl);
          const { token } = await githubCredentials.getCredentials({ url: sourceUrl });
          const octokit = new Octokit({
            auth: token,
            baseUrl: integrations.github.byUrl(sourceUrl)?.config.apiBaseUrl,
          });
          try {
            const { data } = await octokit.rest.repos.getPages({ owner, repo });
            return data.source?.branch;
          } catch (err) {
            // 404 means Pages is NOT CONFIGURED, which is an answer the trial
            // can act on rather than an error. Anything else genuinely failed
            // and must reach the resolver as one.
            if ((err as { status?: number }).status === 404) {
              return undefined;
            }
            throw err;
          }
        };

        // One entity, one aspect, one run row. Shared by the scheduled sweep
        // and the refresh endpoint so both paths cannot drift.
        const runOne = async (entityRef: string, aspectId: string): Promise<TrialRun> => {
          const credentials = await auth.getOwnServiceCredentials();
          const entity = await catalog.getEntityByRef(entityRef, { credentials });
          if (!entity) {
            throw new Error(`no such entity: ${entityRef}`);
          }

          const practices = await catalog.getEntities(
            { filter: { kind: 'Component', [`metadata.annotations.${ASPECT}`]: aspectId } },
            { credentials },
          );
          const practice = practices.items[0];
          const standardUrl = practice ? standardUrlFor(practice) : undefined;

          let standard;
          let detail: string | undefined;
          if (standardUrl) {
            try {
              standard = await loadStandard(reader, standardUrl);
            } catch (err) {
              detail = String(err);
            }
          } else {
            detail = `practice for ${aspectId} declares no standard`;
          }

          const result = await evaluate({
            entity,
            standard,
            sourceUrl: sourceUrlOf(entity),
            reader,
            moduleRelease: practice?.metadata.annotations?.[MODULE_RELEASE],
            resolverFor,
            pagesSourceBranch,
          });

          const v = result.verdict;
          const run: TrialRun = {
            entityRef,
            aspectId,
            runAt: new Date().toISOString(),
            kind: v.kind === 'unevaluated' ? 'unevaluated' : 'evaluated',
            moduleRelease: result.moduleRelease,
            medal: v.kind === 'medal' ? v.medal : null,
            suppressedReasons: v.kind === 'suppressed' ? v.reasons : null,
            applicable: v.kind === 'unevaluated' ? null : v.applicable,
            passing: v.kind === 'unevaluated' ? null : v.passing,
            outcomes: v.kind === 'unevaluated' ? null : result.outcomes,
            unevaluatedReason: v.kind === 'unevaluated' ? v.reason : undefined,
            unevaluatedDetail: v.kind === 'unevaluated' ? (v.detail ?? detail) : undefined,
          };
          await store.append(run);
          return run;
        };

        httpRouter.use(createRouter({ store, httpAuth, refresh: runOne }));

        await scheduler.scheduleTask({
          id: 'gildi-trial-sweep',
          frequency: { hours: 1 },
          timeout: { minutes: 10 },
          // Staggered so a restart does not run a network sweep during boot,
          // when the process is already busy.
          initialDelay: { minutes: 2 },
          async fn() {
            const credentials = await auth.getOwnServiceCredentials();
            const { items } = await catalog.getEntities({ filter: { kind: 'Component' } }, { credentials });
            const enrolled = items.filter(e => e.metadata.annotations?.[ASPECTS]);
            // Fleet-level bound, distinct from the per-trial timeout in
            // evaluate.ts: that one stops a slow trial stretching a run, this
            // one stops N components' worth of GitHub calls going out at once.
            // Small fixed concurrency rather than Promise.all over
            // every component, so the sweep cannot saturate the GitHub API or
            // the event loop as adoption grows.
            // The scheduler's `timeout` releases the task but does not stop
            // `fn`, so without a deadline of our own the workers keep draining
            // after the scheduler has already considered this sweep finished —
            // and the next invocation overlaps with it. Checked before
            // admitting work rather than mid-flight, so a run in progress is
            // never abandoned half-recorded.
            const sweepDeadline = Date.now() + 9 * 60 * 1000;
            const queue = [...enrolled];
            const worker = async () => {
              for (let e = queue.shift(); e; e = queue.shift()) {
                if (Date.now() > sweepDeadline) {
                  logger.warn(
                    `gildi: sweep deadline reached, ${queue.length + 1} components deferred to the next run`,
                  );
                  return;
                }
                const ref = `component:${e.metadata.namespace ?? 'default'}/${e.metadata.name}`;
                for (const aspectId of (e.metadata.annotations?.[ASPECTS] ?? '')
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean)) {
                  try {
                    await runOne(ref, aspectId);
                  } catch (err) {
                    logger.warn(`gildi: run failed for ${ref} / ${aspectId}: ${err}`);
                  }
                }
              }
            };
            await Promise.all([worker(), worker(), worker()]);

            // Retention runs with the sweep rather than on its own schedule:
            // it only has work to do when rows were just added, and one task is
            // one thing to reason about. Design §8.
            // Skipped when the sweep ran out of time: pruning against a
            // half-finished sweep is not wrong, but the next run will do it
            // with a complete picture and there is no value in racing the
            // scheduler for it.
            if (Date.now() <= sweepDeadline) {
              const removed = await store.prune({
                keep: RUNS_KEPT_PER_SUBJECT,
                hourlyDays: HOURLY_RETENTION_DAYS,
              });
              if (removed > 0) {
                logger.info(`gildi: pruned ${removed} old trial runs`);
              }
            }
          },
        });
      },
    });
  },
});

export default gildiPlugin;
```

`components/leidangr/plugins/gildi-backend/src/index.ts`:

```ts
export { gildiPlugin as default } from './plugin';
export type { TrialResultStore, TrialRun } from './store';
```

- [ ] **Step 5: Wire it into the backend**

Add to `components/leidangr/packages/backend/src/index.ts`, after the catalog module lines:

```ts
// guildhall fact source
backend.add(import('@siliconsaga/plugin-gildi-backend'));
```

Add to `components/leidangr/packages/backend/package.json` dependencies, alphabetically:

```json
"@siliconsaga/plugin-gildi-backend": "0.1.0",
```

Run: `bash scripts/ws exec leidangr corepack yarn install`

- [ ] **Step 6: Verify the backend still boots**

Run: `make -C components/leidangr smoke-catalog`
Expected: 37/37 PASS, exit 0. This is the real check on the plugin shell — a bad service dependency or a migration error stops the backend booting, and the smoke would report it.

If it fails with every entity 404 and the log mentions `DevDataStore.load`, that is the known startup race and the script retries once by itself. A second failure is real.

- [ ] **Step 7: Full gate**

Run: `bash scripts/ws test leidangr`
Run: `bash scripts/ws lint leidangr`
Expected: both clean.

- [ ] **Step 8: Commit**

Create `.commits/gildi-backend-plugin.md`:

```markdown
---
message: "feat(gildi-backend): plugin shell, scheduled sweep and router"
add:
  - plugins/gildi-backend/src/plugin.ts
  - plugins/gildi-backend/src/router.ts
  - plugins/gildi-backend/src/index.ts
  - plugins/gildi-backend/src/router.test.ts
  - packages/backend/src/index.ts
  - packages/backend/package.json
  - yarn.lock
---

One `runOne` shared by the scheduled sweep and the refresh endpoint, so the two paths cannot drift into disagreeing about what a run is.

History events are derived server-side rather than in the card, so every consumer agrees on what counts as earning a medal. `none` and a suppressed run are both excluded: the first is a real verdict but not an achievement, the second has no medal at all, and neither is a moment worth marking on a chart.

The sweep is bounded by a small fixed concurrency rather than running every component at once, so it cannot saturate the GitHub API or the event loop as adoption grows. Its scheduled start is staggered so a restart does not begin a network sweep while the process is still booting.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-backend-plugin.md`

---

## Task 8: The frontend hook

Read-only and deliberately last. Nothing renders a badge — that is sub-project 4's UI work and this plan stops short of it.

**Files:**
- Create: `plugins/gildi/src/entity/useComponentTrials.ts`, `entity/useComponentTrials.test.ts`
- Modify: `plugins/gildi/package.json` (add `@siliconsaga/plugin-gildi-common`)

**Interfaces:**
- Consumes: the `GET /trials/:entityRef` endpoint from Task 7.
- Produces: `useComponentTrials(entity: Entity, aspectId: string): { run, medal, loading, error }`.

- [ ] **Step 1: Write the failing test**

`components/leidangr/plugins/gildi/src/entity/useComponentTrials.test.ts`:

```ts
import { medalFromRun } from './useComponentTrials';

describe('medalFromRun', () => {
  it('is the stored medal for an evaluated run', () => {
    expect(medalFromRun({ kind: 'evaluated', medal: 'gold' } as any)).toBe('gold');
  });

  // Suppressed and unevaluated are NOT medals, and must not collapse to
  // `none`. `none` means measured and nothing passed — a verdict about the
  // component. The other two are statements about us.
  it.each([
    ['suppressed', { kind: 'evaluated', medal: null }],
    ['unevaluated', { kind: 'unevaluated', medal: null }],
  ])('is undefined for a %s run rather than none', (_label, run) => {
    expect(medalFromRun(run as any)).toBeUndefined();
  });

  it('is undefined when there is no run at all', () => {
    expect(medalFromRun(undefined)).toBeUndefined();
  });

  it('keeps none, which is a real verdict', () => {
    expect(medalFromRun({ kind: 'evaluated', medal: 'none' } as any)).toBe('none');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `make -C components/leidangr test-app`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`components/leidangr/plugins/gildi/src/entity/useComponentTrials.ts`:

```ts
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import type { Medal } from '@siliconsaga/plugin-gildi-common';
import useAsync from 'react-use/lib/useAsync';

// The SAME type the backend serialises, imported rather than restated. A
// hand-copied mirror of a response shape drifts silently on the first rename,
// and the card would keep compiling while reading a field that no longer
// exists. Move `TrialRun` and `TrialOutcomeRow` from gildi-backend's store.ts
// into gildi-common as part of this task, and have the store import them.
export type { TrialRun as TrialRunView } from '@siliconsaga/plugin-gildi-common';

/**
 * The medal to render, or undefined when there is none TO render.
 *
 * Suppressed and unevaluated runs return undefined rather than 'none'. `none`
 * is a real verdict about a component — measured, and nothing passed — while
 * the other two are statements about us, and collapsing them would tell a
 * component it earned nothing on a run that measured nothing.
 */
export function medalFromRun(run: TrialRunView | undefined): Medal | undefined {
  return (run?.medal as Medal | null) ?? undefined;
}

export function useComponentTrials(entity: Entity, aspectId: string) {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const { value, loading, error } = useAsync(async () => {
    const base = await discovery.getBaseUrl('gildi');
    const ref = encodeURIComponent(stringifyEntityRef(entity));
    const res = await fetchApi.fetch(
      `${base}/trials/${ref}?aspect=${encodeURIComponent(aspectId)}`,
    );
    // A component with no run yet is a normal state, not an error — nothing has
    // swept it. The card shows no badge, which is already its empty rendering.
    if (res.status === 404) {
      return undefined;
    }
    if (!res.ok) {
      throw new Error(`trials request failed: ${res.status}`);
    }
    return (await res.json()) as TrialRunView;
  }, [entity, aspectId]);

  return { run: value, medal: medalFromRun(value), loading, error };
}
```

- [ ] **Step 4: Add the dependency**

Add to `components/leidangr/plugins/gildi/package.json` dependencies, alphabetically:

```json
"@siliconsaga/plugin-gildi-common": "0.1.0",
```

This is the point at which `gildi` genuinely imports the shared package — it deliberately did not depend on it before, when nothing there used it.

Run: `bash scripts/ws exec leidangr corepack yarn install`

- [ ] **Step 5: Run the full gate**

Run: `bash scripts/ws test leidangr`
Run: `bash scripts/ws lint leidangr`
Expected: both clean.

- [ ] **Step 6: Commit**

Create `.commits/gildi-use-component-trials.md`:

```markdown
---
message: "feat(gildi): read a component's trial run"
add:
  - plugins/gildi/src/entity/useComponentTrials.ts
  - plugins/gildi/src/entity/useComponentTrials.test.ts
  - plugins/gildi/package.json
  - yarn.lock
---

Read-only, and nothing renders yet: the badge cell in ComponentAspectsCard stays reserved and empty until sub-project 4.

`medalFromRun` returns undefined for a suppressed or unevaluated run rather than collapsing to `none`. `none` is a real verdict about a component — measured, and nothing passed — while the other two are statements about us, and rendering them alike would tell a component it earned nothing on a run that measured nothing.

A 404 is a normal state rather than an error. A component the sweep has not reached yet simply has no run, and the card's existing empty rendering is already correct for that.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-use-component-trials.md`

---

## Done when

- `bash scripts/ws test leidangr` and `ws lint leidangr` are clean.
- `make -C components/leidangr smoke-catalog` still passes 37/37 with the plugin wired in.
- Both negative controls were **proven to fail** when inverted: the near-miss `uses:` match, and `verdictFor([])` substituted for the unevaluated run.
- A run row can be appended, read back, and does not overwrite its predecessor.
- `prune` keeps the hourly window intact, collapses older days to their **worst** run, and still caps the total.
- A hanging trial is bounded and reports `unmeasured{error}` with a message naming the trial, not `fail`.
- `useComponentTrials` returns a medal for an evaluated run and undefined for a suppressed one.

## Not in this plan

- **The badge and the chart.** Rendering is sub-project 4's UI work. This plan produces the data and the contract it renders from, and deliberately stops there.
- **Live integration against `SiliconSaga/hygiene-testsite`** (design §12). It needs network and a real adopted repo, so it is a manual gate rather than a unit test — worth doing once by hand after Task 7, where `pages-source-is-gh-pages` should FAIL until someone flips the Pages setting.
- **The metrics export and external runner** (design §10). The three seams are in place: the store is an interface, the evaluator is not owned by the scheduler, and the run payload is a defined shape.
- **Attestation** (design §3). The aggregation layer consumes outcomes rather than resolvers, so it arrives later as a new outcome producer.
