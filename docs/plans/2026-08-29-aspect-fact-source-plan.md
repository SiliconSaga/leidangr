# Aspect Fact Source — Implementation Plan (Stages 1–2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the shared vocabulary the fact source is built from — the trial outcome union, medal suppression, and the standard's shape — and make `standard.yaml` declare what makes each trial pass.

**Architecture:** A new `@siliconsaga/plugin-gildi-common` package holds pure domain logic with no I/O, consumed later by both the backend plugin and the existing frontend. `medals.ts` moves there while it still has no caller. In parallel, volundr's `standard.yaml` gains a `check:` block per trial from a closed three-kind vocabulary, and the module release moves to 1.1 across the four places that repeat it.

**Tech Stack:** TypeScript, Backstage CLI package tooling (`backstage-cli package test`), Jest 30 with `@swc/jest`, YAML.

**Spec:** `docs/plans/2026-08-29-aspect-fact-source-design.md`

**Scope note:** This plan covers **stages 1 and 2** of design §13. Stages 3–4 (`gildi-backend` and the `gildi` hook) get their own plan, written once these land so its task interfaces can be stated against shipped signatures rather than predicted ones, and against the Backstage backend APIs as actually installed.

## Global Constraints

- A trial outcome is a **discriminated union, never a boolean** (design §3).
- **A missing artifact is `fail`, not `unmeasured`** (design §3). `unmeasured` means we could not look at all.
- `unmeasured` reasons are exactly `no-resolver | error | no-source`. No other values.
- **`not applicable` is never an outcome** (design §3). Callers pass an already-filtered applicable set.
- **Aggregation consumes outcomes, never resolvers** (design §3) — this is what keeps attestation addable later.
- `check.type` is a **closed enum**: `file-contains | workflow-job-uses | pages-source-branch` (design §4). Not an expression language.
- An unknown `check.type` or `factSource` is `unmeasured{no-resolver}`, **never a pass** (design §4, §7).
- **No new runtime dependencies.** The new package needs only `@backstage/cli` as a devDependency.
- **Commit via `ws commit`, never raw `git commit`** — workspace rule. Bodyfile paths are relative to the yggdrasil root; `add:` paths inside the bodyfile are relative to the component root.
- Avoid semicolons in commit bodies and CR text — the permission hook flags them even inside quoted prose.

## File Structure

| File | Responsibility |
|---|---|
| `plugins/gildi-common/package.json` | Package manifest, `role: common-library` |
| `plugins/gildi-common/src/index.ts` | Public surface — re-exports only |
| `plugins/gildi-common/src/medals.ts` | `Medal`, `medalFor` — moved verbatim from gildi |
| `plugins/gildi-common/src/outcome.ts` | `Outcome` union, `UnmeasuredReason`, constructors |
| `plugins/gildi-common/src/verdict.ts` | `Verdict`, `verdictFor` — suppression lives here |
| `plugins/gildi-common/src/standard.ts` | `Standard`/`Block`/`Trial`/`Check` types, `CHECK_TYPES` |
| `scripts/lib/standard-shape.ts` | Validator — imports shape types instead of restating them |
| `components/volundr/aspect/standard.yaml` | Gains a `check:` block per trial |
| `components/volundr/aspect/catalog-info.yaml` | Gains `siliconsaga.org/standard`, release → 1.1 |
| `components/volundr/aspect/template.yaml` | `moduleRelease` → 1.1 |
| `scripts/smoke-catalog.sh` | Module-release assertion → 1.1 |

---

## Task 1: Create `gildi-common` and move `medalFor` into it

Moving `medals.ts` now is the point of this task — it has no caller today, so the move is free. After stage 4 renders it, the same move would drag the render path with it.

**Files:**
- Create: `plugins/gildi-common/package.json`
- Create: `plugins/gildi-common/src/index.ts`
- Create: `plugins/gildi-common/src/medals.ts`
- Create: `plugins/gildi-common/src/medals.test.ts`
- Delete: `plugins/gildi/src/entity/medals.ts`, `plugins/gildi/src/entity/medals.test.ts`
- Modify: `plugins/gildi/package.json` (add the dependency)

**Interfaces:**
- Consumes: nothing.
- Produces: `Medal = 'gold' | 'silver' | 'bronze' | 'none'` and `medalFor(applicable: number, passing: number): Medal`, exported from `@siliconsaga/plugin-gildi-common`.

- [ ] **Step 1: Create the package manifest**

Create `components/leidangr/plugins/gildi-common/package.json`:

```json
{
  "name": "@siliconsaga/plugin-gildi-common",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "license": "UNLICENSED",
  "private": true,
  "publishConfig": {
    "access": "public",
    "main": "dist/index.esm.js",
    "types": "dist/index.d.ts"
  },
  "backstage": {
    "role": "common-library",
    "pluginId": "gildi",
    "pluginPackages": [
      "@siliconsaga/plugin-gildi",
      "@siliconsaga/plugin-gildi-common"
    ]
  },
  "sideEffects": false,
  "scripts": {
    "build": "backstage-cli package build",
    "lint": "backstage-cli package lint",
    "test": "backstage-cli package test",
    "clean": "backstage-cli package clean"
  },
  "devDependencies": {
    "@backstage/cli": "^0.36.3"
  },
  "files": [
    "dist"
  ]
}
```

The root `package.json` already globs `plugins/*` as a workspace, so no change is needed there.

- [ ] **Step 2: Move `medals.ts` verbatim**

Copy `components/leidangr/plugins/gildi/src/entity/medals.ts` to `components/leidangr/plugins/gildi-common/src/medals.ts` with **no content changes** — its comment block explaining ADR 0013 is the reason the rule is legible, and rewriting it here would lose that.

- [ ] **Step 3: Move the test verbatim**

Copy `components/leidangr/plugins/gildi/src/entity/medals.test.ts` to `components/leidangr/plugins/gildi-common/src/medals.test.ts`. The import path is already `'./medals'` and stays correct.

- [ ] **Step 4: Create the public surface**

Create `components/leidangr/plugins/gildi-common/src/index.ts`:

```ts
// The Guildhall's shared domain vocabulary: pure functions and types with no
// I/O, so the backend that produces outcomes and the frontend that renders
// them agree on what a trial result means without either importing the other.
export { medalFor } from './medals';
export type { Medal } from './medals';
```

- [ ] **Step 5: Install so the workspace link resolves**

Run: `make -C components/leidangr deps`
Expected: completes without error, and `components/leidangr/node_modules/@siliconsaga/plugin-gildi-common` exists as a symlink.

- [ ] **Step 6: Run the moved test to verify it passes in its new home**

Run: `make -C components/leidangr test-app`
Expected: PASS, including the `medalFor` describe block.

- [ ] **Step 7: Delete the originals and point gildi at the package**

Delete `components/leidangr/plugins/gildi/src/entity/medals.ts` and `components/leidangr/plugins/gildi/src/entity/medals.test.ts`.

Add to `components/leidangr/plugins/gildi/package.json` under `dependencies`, keeping the block alphabetical:

```json
"@siliconsaga/plugin-gildi-common": "0.1.0",
```

- [ ] **Step 8: Verify nothing still imports the deleted module**

Run: `grep -rn "from './medals'\|entity/medals" components/leidangr/plugins components/leidangr/packages`
Expected: no matches. `medalFor` has no caller today, so this should be clean — if anything appears, repoint it at `@siliconsaga/plugin-gildi-common`.

- [ ] **Step 9: Run the full gate**

Run: `bash scripts/ws test leidangr`
Expected: PASS.

- [ ] **Step 10: Commit**

Create `.commits/gildi-common-package.md`:

```markdown
---
message: "refactor(gildi): move medal derivation into a shared package"
add:
  - plugins/gildi-common/
  - plugins/gildi/package.json
  - plugins/gildi/src/entity/medals.ts
  - plugins/gildi/src/entity/medals.test.ts
---

The fact source needs the medal rule on the backend and the card needs it on the frontend, so it belongs to neither. `medalFor` has no caller yet, which makes this the cheapest moment the move will ever be — once the badge renders, the same move drags the render path with it.
```

Run: `bash scripts/ws commit leidangr .commits/gildi-common-package.md`

---

## Task 2: Add the trial outcome union

**Files:**
- Create: `plugins/gildi-common/src/outcome.ts`
- Create: `plugins/gildi-common/src/outcome.test.ts`
- Modify: `plugins/gildi-common/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `UnmeasuredReason`, `Outcome`, and constructors `pass()`, `fail(detail?)`, `unmeasured(reason, detail?)`.

- [ ] **Step 1: Write the failing test**

Create `components/leidangr/plugins/gildi-common/src/outcome.test.ts`:

```ts
import { fail, pass, unmeasured } from './outcome';

describe('outcome constructors', () => {
  it('builds a pass with no extra fields', () => {
    expect(pass()).toEqual({ state: 'pass' });
  });

  it('omits detail entirely when none is given', () => {
    // Not `{ detail: undefined }`: these outcomes are serialised into a stored
    // run row, and an explicit undefined key becomes null in JSON, which reads
    // as "there was a detail and it was empty" rather than "there was none".
    expect(fail()).toEqual({ state: 'fail' });
    expect(Object.keys(fail())).toEqual(['state']);
  });

  it('carries detail when given', () => {
    expect(fail('no github-pages gem')).toEqual({
      state: 'fail',
      detail: 'no github-pages gem',
    });
  });

  it('requires a reason for unmeasured', () => {
    expect(unmeasured('no-resolver')).toEqual({
      state: 'unmeasured',
      reason: 'no-resolver',
    });
  });

  it('carries reason and detail together', () => {
    expect(unmeasured('error', 'HTTP 403')).toEqual({
      state: 'unmeasured',
      reason: 'error',
      detail: 'HTTP 403',
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `make -C components/leidangr test-app`
Expected: FAIL — `Cannot find module './outcome'`.

- [ ] **Step 3: Write the implementation**

Create `components/leidangr/plugins/gildi-common/src/outcome.ts`:

```ts
// A trial outcome is a union, never a boolean. The boolean is the trap the
// standard's `artifact:` field was added to avoid: it reads fine and cannot
// express what you later need.
//
// `unmeasured` means WE COULD NOT LOOK, and its reasons are sub-flavours of
// that rather than peers of `fail` — collapsing them into `fail` would blame a
// component for our missing resolver.
//
// A MISSING ARTIFACT IS `fail`, NOT `unmeasured`. No Gemfile means
// gemfile-present fails: absence is the answer, not an obstacle to finding one.
// This is the distinction most likely to be got wrong. See design §3.
export type UnmeasuredReason =
  // Nothing here knows how to answer this trial — an unregistered factSource
  // or an unknown check.type. Never a pass.
  | 'no-resolver'
  // The lookup itself broke: network, auth, malformed artifact.
  | 'error'
  // The component's repository could not be determined at all.
  | 'no-source';

export type Outcome =
  | { state: 'pass' }
  | { state: 'fail'; detail?: string }
  | { state: 'unmeasured'; reason: UnmeasuredReason; detail?: string };

// Constructors rather than object literals at every call site, so the optional
// `detail` key is ABSENT when unset instead of present-and-undefined. These
// outcomes are serialised into a stored run, where the difference is visible.
export const pass = (): Outcome => ({ state: 'pass' });

export const fail = (detail?: string): Outcome =>
  detail ? { state: 'fail', detail } : { state: 'fail' };

export const unmeasured = (reason: UnmeasuredReason, detail?: string): Outcome =>
  detail ? { state: 'unmeasured', reason, detail } : { state: 'unmeasured', reason };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `make -C components/leidangr test-app`
Expected: PASS.

- [ ] **Step 5: Export from the package surface**

Add to `components/leidangr/plugins/gildi-common/src/index.ts`:

```ts
export { fail, pass, unmeasured } from './outcome';
export type { Outcome, UnmeasuredReason } from './outcome';
```

- [ ] **Step 6: Commit**

Create `.commits/trial-outcome-union.md`:

```markdown
---
message: "feat(gildi-common): the trial outcome union"
add:
  - plugins/gildi-common/src/outcome.ts
  - plugins/gildi-common/src/outcome.test.ts
  - plugins/gildi-common/src/index.ts
---

Three states rather than two, because a resolver can be missing or broken and neither of those is the component's fault. The constructors exist so an unset `detail` is an absent key rather than an explicit undefined — these outcomes are serialised into a stored run, where that difference is the gap between "no detail" and "empty detail".
```

Run: `bash scripts/ws commit leidangr .commits/trial-outcome-union.md`

---

## Task 3: Add the verdict aggregation, with suppression

This is where design §3's amendment to ADR 0013 becomes executable. Suppression is not a medal value — `none` means "measured, nothing passed", suppression means "we cannot say".

**Files:**
- Create: `plugins/gildi-common/src/verdict.ts`
- Create: `plugins/gildi-common/src/verdict.test.ts`
- Modify: `plugins/gildi-common/src/index.ts`

**Interfaces:**
- Consumes: `Outcome`, `UnmeasuredReason` from Task 2; `Medal`, `medalFor` from Task 1.
- Produces: `Verdict`, `verdictFor(outcomes: Outcome[]): Verdict`.

**Spec refinement to carry forward:** design §9 sketches a singular `suppressedReason`. Several trials can be unmeasured for different reasons at once, so this returns `reasons: UnmeasuredReason[]` (distinct, sorted). Stage 3's stored column and the §9 contract should be `suppressedReasons` accordingly — update the design doc when stage 3 lands.

- [ ] **Step 1: Write the failing test**

Create `components/leidangr/plugins/gildi-common/src/verdict.test.ts`:

```ts
import { fail, pass, unmeasured } from './outcome';
import { verdictFor } from './verdict';

describe('verdictFor', () => {
  it('awards gold when every applicable trial passes', () => {
    expect(verdictFor([pass(), pass(), pass()])).toEqual({
      kind: 'medal',
      medal: 'gold',
      applicable: 3,
      passing: 3,
    });
  });

  it('awards silver when one trial short', () => {
    expect(verdictFor([pass(), pass(), fail()])).toEqual({
      kind: 'medal',
      medal: 'silver',
      applicable: 3,
      passing: 2,
    });
  });

  // NEGATIVE CONTROL. This is the failure that would silently inflate every
  // medal in the catalog: an unmeasured trial quietly dropping out of the
  // applicable set, so three passes and one missing resolver reads as gold.
  it('suppresses rather than awarding gold when a trial is unmeasured', () => {
    const verdict = verdictFor([pass(), pass(), pass(), unmeasured('no-resolver')]);
    expect(verdict.kind).toBe('suppressed');
    expect(verdict).not.toMatchObject({ medal: 'gold' });
  });

  it('reports how many were unmeasured and why', () => {
    expect(verdictFor([pass(), unmeasured('error'), unmeasured('error')])).toEqual({
      kind: 'suppressed',
      reasons: ['error'],
      unmeasured: 2,
      applicable: 3,
    });
  });

  it('reports distinct reasons sorted, so the summary is stable', () => {
    // Stable ordering matters: this string ends up stored on a run row and
    // compared across runs to decide whether anything actually changed.
    expect(
      verdictFor([unmeasured('no-source'), unmeasured('error'), unmeasured('error')]),
    ).toMatchObject({ reasons: ['error', 'no-source'] });
  });

  it('suppresses even when another trial has already failed', () => {
    // A fail plus an unmeasured could arguably cap the medal at bronze, but the
    // ladder is defined over a KNOWN set. We cannot say, so we do not.
    expect(verdictFor([fail(), unmeasured('error')]).kind).toBe('suppressed');
  });

  it('returns none rather than suppressing when nothing is applicable', () => {
    // A == 0 is a real verdict per ADR 0013: an aspect that asked nothing of
    // this component has awarded it nothing. Nothing was unmeasurable.
    expect(verdictFor([])).toEqual({
      kind: 'medal',
      medal: 'none',
      applicable: 0,
      passing: 0,
    });
  });

  it('returns none when everything failed', () => {
    expect(verdictFor([fail(), fail()])).toEqual({
      kind: 'medal',
      medal: 'none',
      applicable: 2,
      passing: 0,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `make -C components/leidangr test-app`
Expected: FAIL — `Cannot find module './verdict'`.

- [ ] **Step 3: Write the implementation**

Create `components/leidangr/plugins/gildi-common/src/verdict.ts`:

```ts
import { medalFor, type Medal } from './medals';
import type { Outcome, UnmeasuredReason } from './outcome';

// Suppression is NOT a medal value. `none` means "measured, and nothing
// passed" — a real verdict about a component. Suppression means "we cannot
// say", which is a statement about us. Rendering them identically would be the
// same failure ADR 0013 set out to end: a medal that does not mean what it
// says. See design §3 and proposed ADR 0014.
export type Verdict =
  | { kind: 'medal'; medal: Medal; applicable: number; passing: number }
  | {
      kind: 'suppressed';
      reasons: UnmeasuredReason[];
      unmeasured: number;
      applicable: number;
    };

/**
 * Derive a verdict from the outcomes of the APPLICABLE trials.
 *
 * Callers pass an already facet-filtered set: `not applicable` is not an
 * outcome, so a skipped trial is simply absent here rather than present with a
 * third state. That is what lets `medalFor` keep its existing shape.
 *
 * Consumes outcomes, never resolvers — which is what allows attestation to
 * arrive later as a new outcome producer rather than a change to this rule.
 */
export function verdictFor(outcomes: Outcome[]): Verdict {
  const applicable = outcomes.length;
  const unmeasuredOutcomes = outcomes.filter(o => o.state === 'unmeasured');

  if (unmeasuredOutcomes.length > 0) {
    const reasons = [
      ...new Set(
        unmeasuredOutcomes.map(o => (o as { reason: UnmeasuredReason }).reason),
      ),
    ].sort();
    return {
      kind: 'suppressed',
      reasons,
      unmeasured: unmeasuredOutcomes.length,
      applicable,
    };
  }

  const passing = outcomes.filter(o => o.state === 'pass').length;
  return { kind: 'medal', medal: medalFor(applicable, passing), applicable, passing };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `make -C components/leidangr test-app`
Expected: PASS, all nine cases.

- [ ] **Step 5: Prove the negative control can fail**

Temporarily change the `if (unmeasuredOutcomes.length > 0)` guard to `if (false)`.

Run: `make -C components/leidangr test-app`
Expected: FAIL on "suppresses rather than awarding gold when a trial is unmeasured". A negative control that cannot fail proves nothing — this step is how we know it is real. **Revert the change and re-run to confirm PASS before continuing.**

- [ ] **Step 6: Export from the package surface**

Add to `components/leidangr/plugins/gildi-common/src/index.ts`:

```ts
export { verdictFor } from './verdict';
export type { Verdict } from './verdict';
```

- [ ] **Step 7: Commit**

Create `.commits/verdict-suppression.md`:

```markdown
---
message: "feat(gildi-common): suppress the medal when a trial is unmeasured"
add:
  - plugins/gildi-common/src/verdict.ts
  - plugins/gildi-common/src/verdict.test.ts
  - plugins/gildi-common/src/index.ts
---

ADR 0013 defines gold as every applicable trial passing, which an unmeasured trial makes unprovable. Suppression is deliberately not a medal value: `none` means measured and nothing passed, suppression means we cannot say, and rendering them alike would be the same broken promise the ADR set out to end.

The negative control is the load-bearing test. Without it an unmeasured trial dropping silently out of the applicable set reads as gold, which would inflate every medal in the catalog and look entirely correct while doing it. Verified to fail by disabling the guard.
```

Run: `bash scripts/ws commit leidangr .commits/verdict-suppression.md`

---

## Task 4: Add the standard shape types and re-point the validator

The validator currently restates the standard's shape independently. That is a second place that has to be right, and the payoff for consolidating is immediate: it can start rejecting an unknown `check.type`.

**Files:**
- Create: `plugins/gildi-common/src/standard.ts`
- Modify: `plugins/gildi-common/src/index.ts`
- Modify: `scripts/lib/standard-shape.ts`
- Modify: `scripts/lib/standard-shape.test.ts`
- Modify: `jest.envelope.config.cjs`

**Which runner:** `scripts/lib/standard-shape.test.ts` lives outside `packages/*` and `plugins/*`, so `backstage-cli repo test` never sees it. It runs under **`make test`** (the envelope Jest config), whose own header says so. Use `make -C components/leidangr test` for this task, not `test-app`.

**Interfaces:**
- Consumes: nothing.
- Produces: `CHECK_TYPES`, `CheckType`, `Check`, `Trial`, `Block`, `Standard`.

- [ ] **Step 1: Write the shape types**

Create `components/leidangr/plugins/gildi-common/src/standard.ts`:

```ts
// The shape of a module's standard.yaml. Owned here rather than restated by
// each consumer: a validator whose idea of the shape can drift from the code
// that reads it reports green while checking the wrong thing.

// A CLOSED vocabulary, not an expression language. Two reasons, both in design
// §4: standard.yaml has to stay readable by the humans who trust it, and it is
// read OVER THE NETWORK from volundr — a general expression language evaluated
// on a remotely fetched file is a far larger security surface than three typed
// predicates.
export const CHECK_TYPES = [
  'file-contains',
  'workflow-job-uses',
  'pages-source-branch',
] as const;

export type CheckType = (typeof CHECK_TYPES)[number];

export interface Check {
  type: CheckType;
  value: string;
}

export interface Trial {
  id: string;
  rule: string;
  artifact: string;
  factSource: string;
  // Optional: the mock security standard declares no checks, and its trials
  // resolve to unmeasured{no-resolver} rather than being rejected outright.
  check?: Check;
  remediation: string;
}

export interface Block {
  id: string;
  appliesTo: string[];
  trials: Trial[];
}

export interface Standard {
  id: string;
  aspect: string;
  owner?: string;
  filter?: { kind?: string };
  // spec.type -> default facets, overridable per component by the
  // siliconsaga.org/facets annotation.
  facetDefaults?: Record<string, string[]>;
  blocks: Block[];
}
```

- [ ] **Step 2: Export from the package surface**

Add to `components/leidangr/plugins/gildi-common/src/index.ts`:

```ts
export { CHECK_TYPES } from './standard';
export type { Block, Check, CheckType, Standard, Trial } from './standard';
```

- [ ] **Step 3: Write the failing validator test**

Add to `components/leidangr/scripts/lib/standard-shape.test.ts`, inside the existing top-level `describe`:

```ts
  it('rejects a check type outside the closed vocabulary', () => {
    // The whole point of a closed enum is that a typo is caught here rather
    // than becoming unmeasured{no-resolver} silently at evaluation time.
    const dir = mkdtempSync(join(tmpdir(), 'standard-'));
    writeFileSync(join(dir, 'fix.md'), 'fix');
    const path = join(dir, 'standard.yaml');
    writeFileSync(
      path,
      [
        'standard:',
        '  blocks:',
        '    - id: b',
        '      trials:',
        '        - id: t',
        '          rule: r',
        '          artifact: a',
        '          factSource: repo-files',
        '          check: { type: file-contins, value: x }',
        '          remediation: ./fix.md',
      ].join('\n'),
    );
    expect(validateStandard(path)).toEqual([
      { trial: 't', problem: 'unknown check type file-contins' },
    ]);
  });

  it('accepts a trial with no check at all', () => {
    // The mock security standard has none. Those trials become
    // unmeasured{no-resolver} at evaluation, which is not a shape error.
    const dir = mkdtempSync(join(tmpdir(), 'standard-'));
    writeFileSync(join(dir, 'fix.md'), 'fix');
    const path = join(dir, 'standard.yaml');
    writeFileSync(
      path,
      [
        'standard:',
        '  blocks:',
        '    - id: b',
        '      trials:',
        '        - id: t',
        '          rule: r',
        '          artifact: a',
        '          factSource: ci-pipeline-results',
        '          remediation: ./fix.md',
      ].join('\n'),
    );
    expect(validateStandard(path)).toEqual([]);
  });
```

If `mkdtempSync`, `writeFileSync`, `join`, or `tmpdir` are not already imported in that file, add them from `node:fs`, `node:path`, and `node:os` to match the existing tests' imports.

- [ ] **Step 4: Let Jest resolve the new package from `scripts/`**

The package's `main` is `src/index.ts` — raw TypeScript. Yarn symlinks it into `node_modules`, and Jest's default `transformIgnorePatterns` skips `node_modules`, so importing it from `scripts/` fails on unstripped type syntax. Map the name straight at the source instead, which keeps it under `rootDir` where the existing `@swc/jest` transform already applies.

Add to `components/leidangr/jest.envelope.config.cjs`, inside the exported object:

```js
  // The shared package ships TypeScript source rather than a build, and Jest
  // will not transform through the node_modules symlink yarn creates for a
  // workspace. Resolving the name to the source keeps it inside rootDir, where
  // the transform below already applies.
  moduleNameMapper: {
    '^@siliconsaga/plugin-gildi-common$': '<rootDir>/plugins/gildi-common/src/index.ts',
  },
```

- [ ] **Step 5: Run it to verify it fails**

Run: `make -C components/leidangr test`
Expected: FAIL on "rejects a check type outside the closed vocabulary" — the unknown check type produces `[]` because nothing validates it yet. If it instead fails on module resolution, step 4 did not take.

- [ ] **Step 6: Implement the check-type validation**

In `components/leidangr/scripts/lib/standard-shape.ts`:

Add the import at the top, beside the existing imports. `CHECK_TYPES` is a value, not a type — importing `CheckType` alongside it would be unused and trip lint:

```ts
import { CHECK_TYPES } from '@siliconsaga/plugin-gildi-common';
```

Replace the local `RawTrial` interface's `check` gap by adding this field to it:

```ts
  check?: { type?: unknown; value?: unknown };
```

Then, inside the `trials.forEach` callback, after the `required('factSource')` line, add:

```ts
      // A check is optional — the mock security standard declares none, and
      // those trials resolve to unmeasured rather than being a shape error.
      // But a check that IS present must name a type from the closed
      // vocabulary, or a typo becomes a silent unmeasured at evaluation time.
      const check = trial?.check;
      if (check !== undefined && check !== null) {
        const type = text(check.type as unknown);
        if (!type) {
          issues.push({ trial: name, problem: 'check missing type' });
        } else if (!(CHECK_TYPES as readonly string[]).includes(type)) {
          issues.push({ trial: name, problem: `unknown check type ${type}` });
        }
        if (!text(check.value as unknown)) {
          issues.push({ trial: name, problem: 'check missing value' });
        }
      }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `make -C components/leidangr test`
Expected: PASS, including the two new cases and every pre-existing validator test.

Note that `scripts/` is outside `tsconfig.json`'s `include`, so this import is stripped by `@swc/jest` at test time and never type-checked. The runtime behaviour is what the tests above prove — do not expect `tsc` to catch a mistake here.

- [ ] **Step 8: Run the full gate**

Run: `bash scripts/ws test leidangr`
Expected: PASS. This runs `make test` and `make test-app` together, so it covers both the new package's tests and the validator's.

- [ ] **Step 9: Commit**

Create `.commits/standard-shape-types.md`:

```markdown
---
message: "feat(gildi-common): own the standard shape, and validate check types"
add:
  - plugins/gildi-common/src/standard.ts
  - plugins/gildi-common/src/index.ts
  - scripts/lib/standard-shape.ts
  - scripts/lib/standard-shape.test.ts
  - jest.envelope.config.cjs
---

The validator restated the standard's shape independently, which is a second place that has to stay right — the same class of fault as a hand-copied fixture reporting green against a palette that no longer ships.

Consolidating pays for itself immediately: the validator can now reject a check type outside the closed vocabulary, so a typo is a shape error at authoring time rather than a silent unmeasured at evaluation time.
```

Run: `bash scripts/ws commit leidangr .commits/standard-shape-types.md`

---

## Task 5: volundr — declare what makes each trial pass

**This is a separate repository.** Branch, commit, and open a CR in `components/volundr`.

**Files:**
- Modify: `aspect/standard.yaml`
- Modify: `aspect/catalog-info.yaml`
- Modify: `aspect/template.yaml:134`

**Interfaces:**
- Consumes: the `CHECK_TYPES` vocabulary from Task 4 — the values written here must match it exactly.
- Produces: a `standard.yaml` every trial of which declares a machine-readable predicate, and module release 1.1.

- [ ] **Step 1: Create the branch**

Run: `git -C components/volundr checkout -b feat/trial-check-predicates`

- [ ] **Step 2: Add a `check:` block to each of the four trials**

In `components/volundr/aspect/standard.yaml`, add one `check:` line to each trial, immediately after its `factSource:` line:

- `gemfile-present` → `          check: { type: file-contains, value: github-pages }`
- `deploy-stub-points-at-volundr` → `          check: { type: workflow-job-uses, value: SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@main }`
- `pages-source-is-gh-pages` → `          check: { type: pages-source-branch, value: gh-pages }`
- `preview-stub-points-at-volundr` → `          check: { type: workflow-job-uses, value: SiliconSaga/volundr/.github/workflows/pr-preview.yml@main }`

Then extend the file's header comment, after the paragraph about `artifact`:

```yaml
# `check` is the machine-readable half of `rule`. The prose stays, because a
# human has to trust this file, but prose alone is what left the fact source
# with nothing to compute. The vocabulary is CLOSED — file-contains,
# workflow-job-uses, pages-source-branch — rather than an expression language:
# this file is read over the network by another service, and a general
# evaluator over remotely fetched input is a much larger surface than three
# typed predicates.
```

- [ ] **Step 3: Add the standard annotation and bump the release**

In `components/volundr/aspect/catalog-info.yaml`, add beneath the existing `siliconsaga.org/visir` line:

```yaml
    # Where the standard lives, resolved against this entity's own source
    # location so it travels with the module. Previously the standard was
    # reachable only through a links[] entry with a free-text title, which is
    # display metadata — nothing could find it mechanically.
    siliconsaga.org/standard: './standard.yaml'
```

Change `siliconsaga.org/module-release: '1.0'` to `'1.1'`.

Update that annotation's existing comment, which lists two other places, to list three — adding the leidangr smoke assertion is not new but the count in the prose must match reality:

```yaml
    #   1. aspect/template.yaml  → steps.descriptor.input.values.moduleRelease
    #   2. leidangr scripts/smoke-catalog.sh → the module-release assertion
    #   3. leidangr docs/plans/2026-08-29-aspect-fact-source-design.md §11
```

- [ ] **Step 4: Bump the template's copy**

In `components/volundr/aspect/template.yaml`, line 134, change `moduleRelease: '1.0'` to `moduleRelease: '1.1'`.

- [ ] **Step 5: Verify the edited standard still validates**

`validateStandard` has no CLI entry point — its only caller is its own test — so point it at the real file from there. This is the step that catches a `check.type` typo before it ships, so do not skip it.

Add temporarily to `components/leidangr/scripts/lib/standard-shape.test.ts`:

```ts
  it('TEMPORARY: the real volundr standard validates clean', () => {
    // Cross-repo, so this only works with volundr cloned as a sibling
    // component. Remove before committing — a permanent test coupling one
    // repo's suite to another repo's working tree fails for reasons that have
    // nothing to do with either.
    expect(
      validateStandard('../volundr/aspect/standard.yaml'),
    ).toEqual([]);
  });
```

Run: `make -C components/leidangr test`
Expected: PASS with an empty issue list. A `check.type` typo surfaces here as `unknown check type <typo>`.

**Then delete the temporary case** and re-run `make -C components/leidangr test` to confirm the suite is still green without it.

- [ ] **Step 6: Confirm all three release copies moved together**

Run: `grep -rn "1\.0\|1\.1" components/volundr/aspect/catalog-info.yaml components/volundr/aspect/template.yaml`
Expected: no remaining `'1.0'` on a `module-release` or `moduleRelease` line.

- [ ] **Step 7: Commit**

Create `.commits/volundr-check-predicates.md`:

```markdown
---
message: "feat(aspect): trials declare what makes them pass, at release 1.1"
add:
  - aspect/standard.yaml
  - aspect/catalog-info.yaml
  - aspect/template.yaml
---

The standard claimed its trials were predicates over named artifacts and declared only prose, so a fact source could fetch the Gemfile and still not know it must contain `github-pages`. `check:` closes that with a three-kind vocabulary rather than an expression language — this file is read over the network by another service, and a general evaluator over remotely fetched input is a far larger surface than three typed predicates.

`siliconsaga.org/standard` makes the standard mechanically findable. It was previously reachable only through a links[] entry with a free-text title, which is display metadata.

Release goes to 1.1 because both change the module contract. Nothing has ever exercised `behind` — adopters recording 1.0 will now read as behind against a live 1.1, which is the currency model finally doing its job.
```

Run: `bash scripts/ws commit volundr .commits/volundr-check-predicates.md`

- [ ] **Step 8: Push and open the CR**

Run: `bash scripts/ws push volundr`

Then open a CR with `bash scripts/ws cr volundr "feat(aspect): trials declare what makes them pass, at release 1.1" <bodyfile>`, using `templates/change.md`.

**Do not merge yet** — see the ordering note in Task 6.

---

## Task 6: leidangr — follow the release bump

**Ordering hazard, and it is real.** `smoke-catalog` reads volundr's `main` over the network and asserts the module release **exactly**. Between volundr's 1.1 merging and this change landing, a local `make smoke-catalog` fails. leidangr has **no CI workflows**, so this is an inconsistency window for anyone running the smoke by hand, not a broken pipeline — but merge Task 5's CR first and this one immediately after.

**Files:**
- Modify: `scripts/smoke-catalog.sh`

**Interfaces:**
- Consumes: volundr module release 1.1 from Task 5.
- Produces: nothing downstream.

- [ ] **Step 1: Create the branch**

Run: `git -C components/leidangr checkout -b fix/module-release-1-1`

- [ ] **Step 2: Update the assertion**

In `components/leidangr/scripts/smoke-catalog.sh`, change the module-release check from `'"siliconsaga.org/module-release":"1.0"'` to `'"siliconsaga.org/module-release":"1.1"'`, and update the check's label from `"Website practice module release 1.0"` to `"Website practice module release 1.1"`.

Leave the surrounding comment intact — it explains why the assertion is exact rather than a presence check, and that reasoning is exactly what makes this step necessary.

- [ ] **Step 3: Confirm volundr 1.1 is merged before running**

Run: `bash scripts/ws gh pr list --repo SiliconSaga/volundr --state merged --limit 3 --json number,title,mergedAt`
Expected: the Task 5 CR appears as merged. If it does not, stop — the smoke will fail for the right reason and prove nothing.

- [ ] **Step 4: Run the smoke**

Run: `make -C components/leidangr smoke-catalog`
Expected: PASS, all checks, including `Website practice module release 1.1` and both `read from volundr` source assertions.

If the backend fails to boot with `IPC request 'DevDataStore.load' timed out`, that is a known transient startup flake on a loaded machine — re-run once before investigating.

- [ ] **Step 5: Commit**

Create `.commits/smoke-release-1-1.md`:

```markdown
---
message: "test(smoke): follow the module release to 1.1"
add:
  - scripts/smoke-catalog.sh
---

The assertion is deliberately exact rather than a presence check, so it fails loudly when the release moves in one of its places and not the others. This is that mechanism working as designed rather than a maintenance cost — volundr moved, so this follows.
```

Run: `bash scripts/ws commit leidangr .commits/smoke-release-1-1.md`

- [ ] **Step 6: Push and open the CR**

Run: `bash scripts/ws push leidangr`

Then open a CR with `bash scripts/ws cr leidangr "test(smoke): follow the module release to 1.1" <bodyfile>`.

---

## Done when

- `@siliconsaga/plugin-gildi-common` exists, builds, and exports `medalFor`, the `Outcome` union, `verdictFor`, and the standard shape types.
- `bash scripts/ws test leidangr` passes.
- The verdict negative control has been **proven to fail** when its guard is disabled.
- `scripts/lib/standard-shape.ts` imports its shape from the shared package and rejects an unknown `check.type`.
- All four trials in volundr's `standard.yaml` declare a `check:`.
- Module release reads 1.1 in volundr's `catalog-info.yaml` and `template.yaml`, and in leidangr's smoke assertion.
- `make -C components/leidangr smoke-catalog` passes end to end.

## Not in this plan

Stages 3 and 4 of design §13 — `gildi-backend` (store, migration, resolver registry, the two resolvers, evaluator, scheduler, router) and the `gildi` `useComponentTrials` hook. They follow in a second plan, written against the signatures these tasks actually ship and against the Backstage backend service APIs as installed, rather than against predicted ones.
