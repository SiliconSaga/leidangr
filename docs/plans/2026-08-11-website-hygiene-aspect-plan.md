# Website Hygiene Aspect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first aspect that is not seed data — a module inside volundr wrapping its reusable workflows, adopted through a scaffolder template that opens a real pull request.

**Architecture:** Three repos with one seam. **volundr** owns the module (`aspect/`) beside the workflows it describes, so a volundr tag is the `module-release` and the standard cannot describe a workflow that is not there. **leidangr** registers that module over two `type: url` catalog locations and owns the shared semantics — medal derivation and standard validation — because that is where the future scorecard lives. **yggdrasil** gains prose only.

**Tech Stack:** YAML (catalog entities, scaffolder templates, standards), TypeScript + jest (leidangr's `scripts/lib/` envelope suite and the `gildi` plugin suite), bash (`smoke-catalog`), MkDocs (vísar).

## Global Constraints

- Design doc: `docs/plans/2026-08-11-website-hygiene-aspect-design.md`. Read it before starting.
- **All work lands on the existing leidangr branch `docs/website-hygiene-aspect-design`**, alongside the design. volundr and yggdrasil each get their own branch, since they are separate repos.
- **No hard-wrapped prose** in any Markdown added or edited — one line per paragraph and per bullet. Code blocks, tables and YAML frontmatter are exempt. If you edit a file that is already wrapped, ask before reflowing it.
- Commit with `ws commit <component> <bodyfile>`; push with `ws push <component>`. Never raw `git commit` / `git push`.
- One shell command per tool call. No `&&`, `;` or pipes — the PreToolUse hook denies shell composition.
- The aspect id is exactly `website-hygiene` everywhere it appears.
- The initial `module-release` is exactly `1.0`.
- The practice is owned by `group:default/team-devex` until a real guild exists.
- volundr is declared in the realm ecosystem as tier `supporting` but is **not cloned**. Run `ws clone volundr` before Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `leidangr/plugins/gildi/src/entity/medals.ts` | Medal derivation. In the plugin, not `scripts/lib/`, because the eventual consumer is the tier badge in `ComponentAspectsCard`. |
| `leidangr/plugins/gildi/src/entity/medals.test.ts` | Table-driven cases for the derivation rule. |
| `leidangr/docs/adrs/0013-derived-medals.md` | Records the rule replacing assigned tiers. |
| `leidangr/examples/mock-org/repos/security-aspect/standard.yaml` | Loses its `tiers:` block; gains an `artifact:` per trial. |
| `leidangr/scripts/lib/standard-shape.ts` | Validates any `standard.yaml`. Takes a path, so it serves both repos. |
| `leidangr/scripts/lib/standard-shape.test.ts` | Runs the validator over the in-repo standard plus malformed fixtures. |
| `volundr/aspect/*` | The module: catalog face, standard, both doors, vísar. |
| `leidangr/app-config.yaml` | Two `type: url` locations. |
| `leidangr/scripts/smoke-catalog.sh` | Asserts the module ingests; header corrected about network. |
| `yggdrasil/templates/components/gh-pages/README.md` | A "going further" section. |

---

## Task 1: Medal derivation

**Files:**
- Create: `plugins/gildi/src/entity/medals.ts`
- Test: `plugins/gildi/src/entity/medals.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type Medal = 'gold' | 'silver' | 'bronze' | 'none'` and `export function medalFor(applicable: number, passing: number): Medal`. Task 2's ADR describes this rule in prose; no later task in this plan calls it.

- [ ] **Step 1: Write the failing test**

`plugins/gildi/src/entity/medals.test.ts`:

```ts
import { medalFor } from './medals';

describe('medalFor', () => {
  // The rule in one line: gold means every applicable trial passes, at any
  // standard size. Silver is one short. Everything else that passes something
  // is bronze.
  it.each([
    // applicable, passing, medal
    [1, 1, 'gold'],
    [1, 0, 'none'],
    [2, 2, 'gold'],
    [2, 1, 'silver'],
    [2, 0, 'none'],
    [3, 3, 'gold'],
    [3, 2, 'silver'],
    [3, 1, 'bronze'],
    [4, 4, 'gold'],
    [4, 3, 'silver'],
    [4, 2, 'bronze'],
    [4, 1, 'bronze'],
  ])('applicable %i, passing %i is %s', (applicable, passing, expected) => {
    expect(medalFor(applicable as number, passing as number)).toBe(expected);
  });

  it('awards gold to a one-trial standard, so a small aspect is still complete', () => {
    // This is the case assigned tiers could not express: with bronze/silver/gold
    // hardcoded, an aspect offering one check could never reach the top.
    expect(medalFor(1, 1)).toBe('gold');
  });

  it('counts only applicable trials, so a skipped trial never blocks gold', () => {
    // A standard with four trials where facet filtering leaves two: passing both
    // is gold, not silver. Non-applicable trials skip, they never count against.
    expect(medalFor(2, 2)).toBe('gold');
  });

  it('returns none when a standard has nothing applicable', () => {
    expect(medalFor(0, 0)).toBe('none');
  });

  it('does not exceed gold if a caller passes more than it declared applicable', () => {
    expect(medalFor(2, 3)).toBe('gold');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `ws test leidangr`
Expected: FAIL — `Cannot find module './medals'`.

- [ ] **Step 3: Write the implementation**

`plugins/gildi/src/entity/medals.ts`:

```ts
// Medals are DERIVED from how many applicable trials pass, never assigned to
// named rungs in the standard. Gold always means "everything applicable
// passes", so an aspect is complete at any size — a one-trial standard awards
// gold for that trial. Assigned tiers could not do this: they produced medals
// no component had a path to, and every new trial had to be slotted into a rung
// by hand. See ADR 0013.
export type Medal = 'gold' | 'silver' | 'bronze' | 'none';

export function medalFor(applicable: number, passing: number): Medal {
  if (applicable <= 0 || passing <= 0) return 'none';
  if (passing >= applicable) return 'gold';
  if (passing === applicable - 1) return 'silver';
  return 'bronze';
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `ws test leidangr`
Expected: PASS, with 16 new tests — the 12 parameterised rows plus the 4 named cases.

- [ ] **Step 5: Commit**

Write `.commits/medals.md` in the workspace root:

```markdown
---
message: "feat(gildi): derive medals from applicable trials"
add:
  - plugins/gildi/src/entity/medals.ts
  - plugins/gildi/src/entity/medals.test.ts
---

Gold means every applicable trial passes, whatever the standard's size, so an aspect offering one check is a complete aspect rather than one permanently short of the top.
It has no caller until the scorecard badge exists. It is written now because ADR 0013 removes the tiers blocks that were the only statement of what a medal means, and a rule two standards depend on should be executable rather than prose.
```

Run: `ws commit leidangr .commits/medals.md`

---

## Task 2: ADR 0013, and security-aspect follows the new rule

**Files:**
- Create: `docs/adrs/0013-derived-medals.md`
- Modify: `docs/adrs/README.md` (add the table row)
- Modify: `examples/mock-org/repos/security-aspect/standard.yaml` (remove `tiers:`, add `artifact:` per trial)

**Interfaces:**
- Consumes: the rule implemented in Task 1.
- Produces: a `standard.yaml` with no `tiers:` key and an `artifact:` on every trial — the shape Task 3's validator enforces.

- [ ] **Step 1: Write the ADR**

`docs/adrs/0013-derived-medals.md`, matching the MADR v3 shape of `0012-entity-page-composition.md`:

```markdown
# Medals are derived from applicable trials, not assigned to rungs

- Status: accepted
- Date: 2026-08-11
- Deciders: Cervator, Claude (Opus 5)

## Context and Problem Statement

ADR 0010 gave a standard two axes: blocks carrying facet applicability, and tiers naming a maturity ladder. Tiers were expressed by listing trial ids under each rung, which reads naturally and fails in two ways once a second aspect exists.

It produces medals nobody can reach. The security standard's gold hangs on a single trial, `threat-model-current`, so a component with no threat model is permanently short of the top no matter how much else it satisfies. And it makes every new trial a manual placement decision: add a check, then argue about which rung owns it.

The website-hygiene aspect forced the question, because it offers four checks and had no obvious three-way split.

## Considered Options

- **Keep assigned tiers.** Familiar, already shipped. Rejected: the unreachable-gold problem is structural, not an authoring mistake.
- **Assigned tiers with a completeness escape hatch.** Two rules to implement and explain. Rejected as the worst of both.
- **Derive medals from the count of passing applicable trials.** Chosen.

## Decision Outcome

Chosen: **the top medal always means "every applicable trial passes"**, with the rest derived.

Let A be the applicable trials after facet filtering and P the passing ones: gold when `A > 0 and P >= A`, silver when `P == A - 1`, bronze when `1 <= P < A - 1`, none when `P == 0` or `A == 0`.

Two edges are stated rather than left to the reader. `A == 0` — nothing applies to this component — is `none`, not a vacuous gold: an aspect that asked nothing of you has not awarded you anything. And `P > A` clamps to gold rather than falling through, because a miscounting caller producing *silver* out of more passes than trials would read as a real verdict.

An aspect offering two checks awards silver for one and gold for both. An aspect offering one check awards gold for passing it. A standard therefore declares only its blocks and trials; the ladder falls out of them, and `tiers:` disappears from the schema entirely.

The rule lives in `plugins/gildi/src/entity/medals.ts` rather than in prose here, because two standards now depend on it.

### Consequences

- Good: no unreachable medals, at any standard size. Small aspects are complete rather than permanently bronze.
- Good: adding a trial is a modelling decision, not also a placement decision. It raises the bar for gold automatically, which is the honest outcome — see the drift section of the website-hygiene design.
- Cost: **every trial weighs the same.** That suits four tightly-scoped website checks and is arguable for security, where "no secrets in repo" and "threat model current" are not peers. Explicit weighting stays available as a later amendment; it is deliberately not built now, because no standard yet has enough trials for the difference to matter.
- `security-aspect/standard.yaml` drops its `tiers:` block. Its bronze/silver/gold narrative was demo prose, so nothing real is lost.

See ADR [0010](0010-aspect-module-adoption-blocks.md) for the two-axis model this amends, and `2026-08-11-website-hygiene-aspect-design.md` for the aspect that prompted it.
```

- [ ] **Step 2: Add the ADR to the index**

In `docs/adrs/README.md`, append a row to the table:

```markdown
| [0013](0013-derived-medals.md) | Medals are derived from applicable trials, not assigned to rungs |
```

- [ ] **Step 3: Update the security standard**

In `examples/mock-org/repos/security-aspect/standard.yaml`, delete the whole `tiers:` block — the final seven lines of the file, beginning with the line whose content is `tiers:` followed by the comment `# the maturity ladder — orthogonal to blocks, references trial ids`, and ending with the line whose content is `trials: [threat-model-current]`.

Then add an `artifact:` line to each of the six trials, naming what a fact source would inspect. Insert each immediately after that trial's `rule:` line:

| Trial | `artifact:` value |
|---|---|
| `dependency-scanning` | `ci-pipeline-config` |
| `no-critical-vulns-30d` | `dependency-scan-results` |
| `no-secrets-in-repo` | `secret-scan-results` |
| `sast-scan-clean` | `sast-results` |
| `security-contact-declared` | `catalog-info.yaml` |
| `threat-model-current` | `threat-models/<component>.md` |

Finally, update the header comment. Replace the two lines describing the TIERS axis:

```yaml
#   TIERS  — the maturity ladder (bronze/silver/gold), referencing trial ids
#            across blocks. A tier completes when all its APPLICABLE trials
#            pass; non-applicable trials skip, they never block.
```

with:

```yaml
#   MEDALS — derived, never listed here (ADR 0013): gold is every APPLICABLE
#            trial passing, silver is one short, bronze is any. Non-applicable
#            trials skip, so they never count against the total.
```

- [ ] **Step 4: Verify nothing read the tiers block**

Run: `ws test leidangr`
Expected: PASS. Nothing parses `standard.yaml` yet, so this is a regression check rather than a proof.

Run the Grep tool for `tiers` across `plugins/` and `scripts/` to confirm no code referenced it. Expected: no matches.

- [ ] **Step 5: Commit**

Write `.commits/adr-0013.md`:

```markdown
---
message: "docs(adr): medals derive from applicable trials"
add:
  - docs/adrs/0013-derived-medals.md
  - docs/adrs/README.md
  - examples/mock-org/repos/security-aspect/standard.yaml
---

Listing trial ids under bronze, silver and gold produced medals nobody could reach: security's gold hangs on one trial, so a component with no threat model is permanently short of the top however much else it satisfies. It also made every new check a placement argument.
Gold now means every applicable trial passes, at any size, and a standard declares only blocks and trials. The security standard drops its tiers block accordingly — that ladder was demo prose, so nothing real is lost.
Each trial also gains an artifact field naming what a fact source would inspect. It is what lets the shape validator insist a trial is computable rather than merely well-formed.
Recorded cost: derived medals weight every trial equally, which is right for four website checks and arguable for security. Explicit weighting is left for when a standard is big enough to need it.
```

Run: `ws commit leidangr .commits/adr-0013.md`

---

## Task 3: The standard shape validator

**Files:**
- Modify: `package.json` (add `yaml` to `devDependencies`)
- Create: `scripts/lib/standard-shape.ts`
- Test: `scripts/lib/standard-shape.test.ts`

**Interfaces:**
- Consumes: the `artifact:` field added in Task 2.
- Produces: `export interface StandardIssue { trial: string; problem: string }` and `export function validateStandard(path: string): StandardIssue[]` — returns an empty array for a well-formed standard. Task 4 runs it against volundr's standard.

- [ ] **Step 1: Add the YAML dependency**

Neither `yaml` nor `js-yaml` is a direct dependency — both are only transitive, and importing a transitive package breaks the moment the tree shifts. Add `"yaml": "^2.8.1"` to `devDependencies` in the root `package.json`, alphabetically after `typescript`.

Run: `corepack yarn install --mode update-lockfile`
Then run: `make deps`
Expected: `make deps` runs an immutable install and passes. If it fails, the lockfile did not sync — re-run the update-lockfile command.

- [ ] **Step 2: Write the failing test**

`scripts/lib/standard-shape.test.ts`:

```ts
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateStandard } from './standard-shape';

const SECURITY = join(
  __dirname, '..', '..', 'examples', 'mock-org', 'repos', 'security-aspect', 'standard.yaml',
);

// Writes a standard.yaml plus any remediation files it references, so the
// path-resolution check has something real to resolve against.
function fixture(body: string, remediationFiles: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'standard-'));
  writeFileSync(join(dir, 'standard.yaml'), body, 'utf8');
  for (const rel of remediationFiles) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, '# fix it\n', 'utf8');
  }
  return join(dir, 'standard.yaml');
}

const WELL_FORMED = `
standard:
  id: demo
  aspect: demo
  blocks:
    - id: only
      appliesTo: ['*']
      trials:
        - id: a-trial
          rule: the thing is present
          artifact: thing.txt
          factSource: repo-files
          remediation: ./docs/fix.md
`;

describe('validateStandard', () => {
  it('passes the standard that actually ships', () => {
    // Guards the real file, not a fixture — a validator only tested against
    // fixtures drifts away from the thing it is supposed to protect.
    expect(validateStandard(SECURITY)).toEqual([]);
  });

  it('accepts a well-formed standard', () => {
    expect(validateStandard(fixture(WELL_FORMED, ['docs/fix.md']))).toEqual([]);
  });

  it('rejects a trial with no artifact, which is what makes it computable', () => {
    const body = WELL_FORMED.replace('          artifact: thing.txt\n', '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'missing artifact' },
    ]);
  });

  it('rejects a remediation path that does not resolve to a file', () => {
    // A vísir nobody can open is worse than none: the promise is that a failing
    // check is one click from the fix.
    expect(validateStandard(fixture(WELL_FORMED))).toEqual([
      { trial: 'a-trial', problem: 'remediation ./docs/fix.md does not resolve' },
    ]);
  });

  it('rejects a trial with no rule', () => {
    const body = WELL_FORMED.replace('          rule: the thing is present\n', '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'missing rule' },
    ]);
  });

  it('rejects a trial with no factSource', () => {
    const body = WELL_FORMED.replace('          factSource: repo-files\n', '');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'missing factSource' },
    ]);
  });

  it('names an unidentified trial by position rather than throwing', () => {
    // A trial with no id still has to be reportable, or the run that was meant
    // to diagnose the standard dies on it instead.
    const body = WELL_FORMED.replace('        - id: a-trial\n', "        - id: ''\n");
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'only[0]', problem: 'missing id' },
    ]);
  });

  it('reports a standard with no blocks rather than passing it silently', () => {
    expect(validateStandard(fixture('standard:\n  id: empty\n'))).toEqual([
      { trial: '(standard)', problem: 'no blocks' },
    ]);
  });

  it('treats a non-string id as missing instead of throwing on it', () => {
    // YAML gives a number for `id: 1.4`, and .trim() on that throws — killing
    // the run that was supposed to explain the file.
    const body = WELL_FORMED.replace('        - id: a-trial\n', '        - id: 1.4\n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'only[0]', problem: 'missing id' },
    ]);
  });

  it('treats a non-string remediation as missing', () => {
    const body = WELL_FORMED.replace('          remediation: ./docs/fix.md\n', '          remediation: 7\n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'missing remediation' },
    ]);
  });

  it('rejects a remediation that points at a directory', () => {
    // A directory satisfies "exists" and renders as a broken link.
    const body = WELL_FORMED.replace('          remediation: ./docs/fix.md\n', '          remediation: ./docs\n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'remediation ./docs does not resolve' },
    ]);
  });

  it('reports a block that declares no trials', () => {
    const body = `
standard:
  id: demo
  blocks:
    - id: hollow
      appliesTo: ['*']
`;
    expect(validateStandard(fixture(body))).toEqual([
      { trial: 'hollow', problem: 'no trials' },
    ]);
  });

  it('rejects a remediation that escapes the module directory', () => {
    // A vísir is part of the aspect. One outside it will not travel when the
    // module is extracted or read over a URL.
    const body = WELL_FORMED.replace('          remediation: ./docs/fix.md\n', '          remediation: ../elsewhere.md\n');
    expect(validateStandard(fixture(body, ['docs/fix.md']))).toEqual([
      { trial: 'a-trial', problem: 'remediation ../elsewhere.md escapes the module' },
    ]);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `ws test leidangr`
Expected: FAIL — `Cannot find module './standard-shape'`.

- [ ] **Step 4: Write the implementation**

`scripts/lib/standard-shape.ts`:

```ts
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { parse } from 'yaml';

export interface StandardIssue {
  trial: string;
  problem: string;
}

interface RawTrial {
  id?: string;
  rule?: string;
  artifact?: string;
  factSource?: string;
  remediation?: string;
}

/**
 * Structural check on a standard.yaml, run over any module's file by path so
 * one validator serves every aspect repo.
 *
 * The artifact and remediation checks are the load-bearing ones. A trial with
 * no named artifact is prose the fact source cannot compute, which is the trap
 * the security standard fell into — rules like "no critical finding older than
 * 30 days" read fine and check nothing. A remediation that does not resolve
 * breaks the promise that a failing trial is one click from its fix.
 */
export function validateStandard(path: string): StandardIssue[] {
  const root = parse(readFileSync(path, 'utf8'))?.standard;
  const blocks = root?.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [{ trial: '(standard)', problem: 'no blocks' }];
  }

  const base = dirname(path);
  const issues: StandardIssue[] = [];

  for (const block of blocks) {
    const trials: RawTrial[] = Array.isArray(block?.trials) ? block.trials : [];
    // A block with no trials defines no checks, so a standard made entirely of
    // them would validate clean while asking nothing of anybody. Coercing the
    // missing array to [] is what would hide it.
    if (trials.length === 0) {
      issues.push({ trial: `${block?.id ?? '?'}`, problem: 'no trials' });
      continue;
    }
    trials.forEach((trial, i) => {
      // Every field is checked for being a non-empty STRING, not merely
      // present. YAML happily produces a number for `id: 1.4`, and calling
      // .trim() on it throws — crashing the run that exists to diagnose the
      // file. Fall back to a positional name so a malformed trial is still
      // reportable.
      const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      const name = text(trial?.id) || `${block?.id ?? '?'}[${i}]`;
      const require = (field: keyof RawTrial) => {
        if (!text(trial?.[field])) {
          issues.push({ trial: name, problem: `missing ${field}` });
          return false;
        }
        return true;
      };

      if (!text(trial?.id)) issues.push({ trial: name, problem: 'missing id' });
      require('rule');
      require('artifact');
      require('factSource');
      if (require('remediation')) {
        const rel = text(trial.remediation);
        const target = resolve(base, rel);
        // Must stay inside the module: a vísir is part of the aspect, and a
        // remediation escaping its directory points at something that will not
        // travel with the module when it is extracted or read over a URL.
        const contained = target === base || target.startsWith(base + sep);
        if (!contained) {
          issues.push({ trial: name, problem: `remediation ${rel} escapes the module` });
        } else if (!statSync(target, { throwIfNoEntry: false })?.isFile()) {
          // isFile rather than existsSync: a directory satisfies "exists" and
          // renders as a broken link, which is the failure this check exists
          // to prevent.
          issues.push({ trial: name, problem: `remediation ${rel} does not resolve` });
        }
      }
    });
  }
  return issues;
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `ws test leidangr`
Expected: PASS. If the first case fails, Task 2's `artifact:` additions are incomplete — the error names the offending trial.

- [ ] **Step 6: Lint and commit**

Run: `ws lint leidangr`
Expected: clean.

Write `.commits/standard-shape.md`:

```markdown
---
message: "feat(scripts): validate that a standard's trials are computable"
add:
  - package.json
  - yarn.lock
  - scripts/lib/standard-shape.ts
  - scripts/lib/standard-shape.test.ts
---

A standard whose trials are prose passes any schema check and computes nothing. This asserts each trial names an artifact, a rule, a fact source, and a remediation path that resolves to a real file next to the standard.
It takes a path rather than assuming one location, so the same validator covers the security standard here and the website-hygiene standard in volundr once that component is cloned. Giving volundr a test harness of its own is not worth it for five data files.
The first case runs against the standard that actually ships rather than a fixture, because a validator tested only against fixtures drifts away from the file it exists to protect.
yaml becomes a direct devDependency. It was already in the tree transitively, which works until the tree shifts.
```

Run: `ws commit leidangr .commits/standard-shape.md`

---

## Task 4: The volundr aspect module — catalog face, standard, vísar

**Files (in the volundr repo):**
- Create: `aspect/catalog-info.yaml`, `aspect/standard.yaml`, `aspect/mkdocs.yml`
- Create: `aspect/docs/index.md`, `aspect/docs/adopting.md`, `aspect/docs/pages-source.md`, `aspect/docs/local-preview.md`

**Interfaces:**
- Consumes: the shape Task 3's validator enforces.
- Produces: `component:default/website-hygiene-practice` with `siliconsaga.org/aspect: website-hygiene` and `siliconsaga.org/module-release: '1.0'`. Task 5's template and Task 7's registration both reference these exact values.

- [ ] **Step 1: Clone volundr and branch**

Run: `ws clone volundr`
Then run: `git -C components/volundr checkout -b feat/website-hygiene-aspect`

- [ ] **Step 2: Write the catalog face**

`components/volundr/aspect/catalog-info.yaml`:

```yaml
# The practice's catalog face. The Component is the PRACTICE (the living
# institution); this directory is its ASPECT (the module that gets applied),
# and the workflows one level up are the paved road the module describes.
#
# The module lives inside volundr on purpose: a volundr tag IS the
# module-release, so this standard can never claim a workflow that is not
# next door. See the leidangr design doc 2026-08-11-website-hygiene-aspect.
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: website-hygiene-practice
  title: Website hygiene practice
  description: 'The Website hygiene practice: its aspect module — standard, paved-road workflows, adoption doors, and remediation vísar'
  annotations:
    siliconsaga.org/aspect: 'website-hygiene'
    # THE release number for this module. Bump it when a trial is added or a
    # workflow contract changes; adopters recording an older value then read as
    # `behind` until they re-adopt, which is the whole point of recording it.
    #
    # Two other places repeat it and must move together — there is no way to
    # make a scaffolder template read this file, so the coupling is managed by
    # saying so rather than by hoping:
    #   1. aspect/template.yaml       → steps.descriptor.input.values.moduleRelease
    #   2. leidangr scripts/smoke-catalog.sh → the module-release assertion
    # The smoke assertion is deliberately exact rather than a presence check:
    # it is the thing that fails loudly when only one of the three was bumped.
    siliconsaga.org/module-release: '1.0'
    siliconsaga.org/visir: './docs/pages-source.md'
    backstage.io/techdocs-ref: dir:.
  links:
    - url: https://github.com/SiliconSaga/volundr/blob/main/aspect/standard.yaml
      title: The standard — blocks of trials, medals derived from what passes
    - url: https://github.com/SiliconSaga/volundr/blob/main/.github/workflows/jekyll-deploy.yml
      title: Paved road — reusable Jekyll deploy workflow
    - url: https://github.com/SiliconSaga/volundr/blob/main/.github/workflows/pr-preview.yml
      title: Paved road — reusable PR preview and visual diff workflow
    - url: https://github.com/SiliconSaga/volundr/blob/main/aspect/template.yaml
      title: Adoption (Create-page door) — Apply the Website hygiene aspect
    - url: https://github.com/SiliconSaga/volundr/blob/main/aspect/SKILL.md
      title: Adoption (agent door) — SKILL.md
spec: { type: practice, lifecycle: production, owner: group:default/team-devex }
```

- [ ] **Step 3: Write the standard**

`components/volundr/aspect/standard.yaml`:

```yaml
# The website-hygiene standard — lives in the ASPECT MODULE beside the paved
# road it describes and the vísar it references.
#
# BLOCKS carry facet applicability; MEDALS are derived, never listed here
# (leidangr ADR 0013): gold is every APPLICABLE trial passing, silver is one
# short, bronze is any. Non-applicable trials skip, so they never count
# against the total.
#
# Every trial names an `artifact` — the concrete thing a fact source inspects.
# Prose rules read fine and compute nothing, which is the trap worth avoiding
# while the fact source is still unbuilt.
standard:
  id: website-hygiene
  aspect: website-hygiene
  owner: group:default/team-devex
  filter: { kind: Component }
  facetDefaults:
    website: [web-ui]
  blocks:
    - id: build-inputs
      appliesTo: [web-ui]
      trials:
        - id: gemfile-present
          rule: a Gemfile at the repo root declares the github-pages gem
          artifact: Gemfile
          factSource: repo-files
          remediation: ./docs/adopting.md
    - id: deploy
      appliesTo: [web-ui]
      trials:
        - id: deploy-stub-points-at-volundr
          rule: a job in .github/workflows/deploy.yml uses SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@main
          artifact: .github/workflows/deploy.yml
          factSource: repo-files
          remediation: ./docs/adopting.md
        - id: pages-source-is-gh-pages
          rule: the repository's GitHub Pages source branch is gh-pages
          artifact: github-pages-settings
          factSource: github-pages-api
          remediation: ./docs/pages-source.md
    - id: preview
      appliesTo: [web-ui]
      trials:
        - id: preview-stub-points-at-volundr
          rule: a job in .github/workflows/pr-preview.yml uses SiliconSaga/volundr/.github/workflows/pr-preview.yml@main
          artifact: .github/workflows/pr-preview.yml
          factSource: repo-files
          remediation: ./docs/adopting.md
```

- [ ] **Step 4: Write the vísar**

`components/volundr/aspect/mkdocs.yml`:

```yaml
site_name: Website hygiene aspect
docs_dir: docs
plugins:
  - techdocs-core
```

`components/volundr/aspect/docs/index.md`:

```markdown
# Website hygiene

This aspect gives a static site the CI hygiene the org's other sites already have: every pull request gets its own preview URL and a visual diff against main, and production deploys run through one shared, reviewed pipeline rather than a copy of it per repo.

The work is done by the reusable workflows one level up in this repo. Adopting is mostly a matter of pointing at them — plus two prerequisites the workflows assume, which are the interesting part.

- [Adopting](adopting.md) — what lands in your repo and why.
- [Pages source](pages-source.md) — the one step no pull request can do for you.
- [Local preview](local-preview.md) — what changes once a Gemfile exists.

Both adoption doors read this same module: the Create-page template for anyone with a Backstage instance to hand, and `SKILL.md` for anyone working from a CLI with an agent.
```

`components/volundr/aspect/docs/adopting.md` (note the four-backtick fence — this body contains its own code blocks):

````markdown
# Adopting

Adoption adds four files to your site repo. Three are the mechanism, and the fourth is what makes the adoption visible in the catalog.

## Gemfile

The workflows build with the `github-pages` gem, which is what supplies `jekyll-sitemap` — the visual diff's CI overlay enables it to enumerate pages. Without a checked-in Gemfile the build has no pinned toolchain and the diff has nothing to walk.

```ruby
source "https://rubygems.org"
gem "github-pages", group: :jekyll_plugins
```

## The two caller stubs

Each is a thin file whose only real content is the `uses:` line. The workflows take no inputs — they derive the repository and its URL from `GITHUB_REPOSITORY` — so there is nothing to configure and nothing to keep in sync.

`.github/workflows/deploy.yml` calls `jekyll-deploy.yml`; `.github/workflows/pr-preview.yml` calls `pr-preview.yml`.

Two things about those stubs are worth understanding before you merge them, because both are choices rather than accidents.

**They follow `@main`, not a pinned SHA.** You are granting `contents: write` to a workflow that tracks a branch in another repository, which is a real trust relationship and not a small one. Pinning per caller would reinstate exactly the copy drift this shared repo exists to remove, so the trade is made the other way: volundr's `main` is branch-protected, and a human merge there is the gate. If your site cannot accept that, do not adopt — the [trust model](https://github.com/SiliconSaga/volundr#trust-model) is the place to argue with it, not your stub.

**The deploy stub triggers on `main`.** GitHub Actions does not allow expressions in an `on:` trigger, so the branch is named literally and cannot be derived. A repository whose default branch is something else must edit that line.

## catalog-info.yaml

Two annotations record the adoption:

```yaml
siliconsaga.org/aspects: website-hygiene
siliconsaga.org/aspect-versions: website-hygiene@1.0
```

The first enrolls the component; the second records which release of this module it adopted. When this module gains a trial and its release bumps, a component still recording the older value reads as *behind* — that is the drift signal, and it is why the version is worth recording even though nothing enforces it yet.

If your repo has no `catalog-info.yaml`, adoption creates one. If it already has one, add the two annotations to it by hand — the Create-page door creates files and cannot merge them, so it will not touch an existing descriptor.

## Then two steps adoption cannot do for you

**Switch the Pages source.** See [Pages source](pages-source.md). Until it is done the site still builds and previews, but the deploy has nowhere to publish.

**Register the repository with the catalog, once.** The descriptor being merged does not by itself put your site in Backstage: the instance reads an explicit list of locations and has no discovery provider watching the org. Use the **Register an existing component** flow on the Create page, pointing at your `catalog-info.yaml`. Skip it and everything is correct while nothing appears — the most confusing failure of the three.
````

`components/volundr/aspect/docs/pages-source.md`:

````markdown
# Pages source

The deploy workflow publishes the built site to a `gh-pages` branch. A repository serving Pages from `main` will therefore keep serving whatever is on `main` and quietly ignore everything the workflow produces.

Switch it once, in the repository's own settings:

1. **Settings → Pages** in the repo on GitHub.
2. Under **Source**, choose **Deploy from a branch**.
3. Set the branch to `gh-pages` and the folder to `/ (root)`. **Save**.

Or in one call — note the path has no leading slash, which Windows Git Bash would otherwise rewrite as a filesystem path:

```bash
gh api -X PUT repos/<owner>/<repo>/pages --raw-field 'source[branch]=gh-pages' --raw-field 'source[path]=/'
```

This is a repository *setting*, not a file, which is why no pull request can do it for you and why the `pages-source-is-gh-pages` trial exists. It is also why a freshly adopted site sits at silver until someone acts: the ladder is doing its job.

The first deploy creates the `gh-pages` branch. If you flip the setting before that branch exists, GitHub will accept it and show nothing until the first run finishes.
````

`components/volundr/aspect/docs/local-preview.md`:

````markdown
# Local preview after adopting

If your site had no Gemfile before, plain `jekyll serve` was the right command. Adoption adds one, so local preview now goes through Bundler and matches what CI builds:

```bash
bundle install
bundle exec jekyll serve
```

Avoid the `wdm` gem, or pin it above 0.1.1 — `wdm 0.1.1` fails to compile on Ruby 3.3 and later, and it is only a file-watching optimisation the preview works fine without.

Nothing about publishing depends on a working local preview; GitHub builds the site remotely on every push either way.
````

- [ ] **Step 5: Validate the standard with the leidangr validator**

This is the cross-repo check the validator was built to allow. Write `components/leidangr/.tmp/check-volundr-standard.ts` (`.tmp/` is gitignored):

```ts
import { validateStandard } from '../scripts/lib/standard-shape';

const issues = validateStandard('../volundr/aspect/standard.yaml');
if (issues.length === 0) {
  console.log('volundr standard: OK');
} else {
  for (const i of issues) console.log(`  ${i.trial}: ${i.problem}`);
  process.exitCode = 1;
}
```

Run from `components/leidangr`: `npx --yes tsx .tmp/check-volundr-standard.ts`

Expected: `volundr standard: OK`. A `remediation ./docs/... does not resolve` line means a vísir file is missing or misnamed; a `missing artifact` line means a trial was written as prose.

Then run: `rm -f .tmp/check-volundr-standard.ts`

- [ ] **Step 6: Commit in volundr**

Write `.commits/aspect-module.md` in the yggdrasil workspace root:

```markdown
---
message: "feat(aspect): the website-hygiene aspect module"
add:
  - aspect/catalog-info.yaml
  - aspect/standard.yaml
  - aspect/mkdocs.yml
  - aspect/docs/index.md
  - aspect/docs/adopting.md
  - aspect/docs/pages-source.md
  - aspect/docs/local-preview.md
---

The standard, the catalog face and the vísar for adopting this repo's reusable workflows. The adoption doors follow in their own commits.
The module lives here rather than in its own repo so that a volundr tag is the module release, which makes it impossible for the standard to describe a workflow that is not next door.
Four trials, each naming the artifact a fact source would inspect rather than describing the intent in prose. One of them reads a repository setting instead of a file, so no pull request can satisfy it — that is deliberate, and it is what holds a freshly adopted site at silver until a human flips the Pages source.
```

Run: `ws commit volundr .commits/aspect-module.md`

---

## Task 5: The Create-page door

**Files (in the volundr repo):**
- Create: `aspect/template.yaml`
- Create: `aspect/skeleton-workflows/.github/workflows/deploy.yml`, `aspect/skeleton-workflows/.github/workflows/pr-preview.yml`
- Create: `aspect/skeleton-gemfile/Gemfile`
- Create: `aspect/skeleton-catalog/catalog-info.yaml`

**Interfaces:**
- Consumes: `siliconsaga.org/module-release: '1.0'` from Task 4's catalog face.
- Produces: `template:default/apply-website-hygiene-aspect` with `spec.type: aspect` — the exact ref Task 7's smoke assertions check.

**Why three skeleton directories, each behind its own flag:** `fetch:template` renders a whole directory and overwrites whatever it renders onto. It cannot read the target first — `publish:github:pull-request` builds a pull request from a workspace, never a merge — so **the Create-page door is create-only by construction**, and the only way to express that is to split the skeleton by file and gate each one.

- **`skeleton-workflows/`** — the two caller stubs.
- **`skeleton-gemfile/`** — a site may pin gems deliberately; the `gh-pages` README even talks a reader through adding a Gemfile.
- **`skeleton-catalog/`** — a real descriptor carries ownership, links and annotations this template knows nothing about.

My first draft rendered the workflows unconditionally, reasoning that a repo already holding files at those paths must already be adopted. **That is wrong**, and it is wrong in exactly the way the Gemfile case is: a site can perfectly well have its own hand-rolled `.github/workflows/deploy.yml` and never have heard of volundr. Publishing over it would drop its CI inside a pull request titled "adopt an aspect". Every file gets a flag.

When a file already exists, the honest paths are a hand edit or the agent door, which reads before it writes and can merge a gem into an existing Gemfile. The template says so in each parameter's description rather than leaving it to be discovered from a bad diff.

- [ ] **Step 1: Write the skeleton files**

`components/volundr/aspect/skeleton-gemfile/Gemfile`:

```ruby
source "https://rubygems.org"
gem "github-pages", group: :jekyll_plugins
```

`components/volundr/aspect/skeleton-workflows/.github/workflows/deploy.yml`. Note `branches: [main]`: GitHub Actions does not allow expressions in an `on:` trigger, so the branch cannot be derived and every caller stub in the org names it literally. A site whose default branch is not `main` must edit this line — the agent door checks the default branch for exactly this reason, and the template's description says so.

```yaml
name: Deploy site

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: gh-pages-write
  cancel-in-progress: false

jobs:
  deploy:
    uses: SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@main
```

`components/volundr/aspect/skeleton-workflows/.github/workflows/pr-preview.yml`:

```yaml
name: PR preview

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: gh-pages-write
  cancel-in-progress: false

jobs:
  preview:
    uses: SiliconSaga/volundr/.github/workflows/pr-preview.yml@main
```

`components/volundr/aspect/skeleton-catalog/catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${{ values.repoName }}
  annotations:
    siliconsaga.org/aspects: website-hygiene
    siliconsaga.org/aspect-versions: website-hygiene@${{ values.moduleRelease }}
spec:
  type: website
  lifecycle: production
  owner: ${{ values.owner }}
```

- [ ] **Step 2: Write the template**

`components/volundr/aspect/template.yaml`:

```yaml
# The Create-page door for this aspect (design §3.7). Unlike the seeded
# security template, this one really writes files and opens a pull request —
# running it IS the adoption. The agent-side door is this module's SKILL.md;
# both read the same standard.
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: apply-website-hygiene-aspect
  title: Apply the Website hygiene aspect
  description: Adopt PR previews, visual diffing and deploy-through-the-forge for a static site — opens a pull request adding the Gemfile, both caller stubs, and the enrollment annotations.
  annotations:
    siliconsaga.org/aspect: 'website-hygiene'
  links:
    - url: https://github.com/SiliconSaga/volundr/blob/main/aspect/standard.yaml
      title: The standard this adoption works toward
    - url: https://github.com/SiliconSaga/volundr/blob/main/aspect/docs/pages-source.md
      title: The manual step adoption cannot do for you
spec:
  owner: group:default/team-devex
  type: aspect
  parameters:
    - title: Target site
      required: [repoUrl, owner]
      properties:
        repoUrl:
          title: Site repository
          type: string
          ui:field: RepoUrlPicker
          ui:options:
            allowedHosts: [github.com]
        owner:
          title: Owning group
          type: string
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: Group
        createWorkflows:
          title: This repo has no deploy.yml or pr-preview.yml yet
          type: boolean
          default: true
          description: Uncheck if either workflow file already exists at those paths. This door creates files, it cannot merge them — a site with its own hand-rolled deploy workflow would have it replaced.
        createGemfile:
          title: This repo has no Gemfile yet
          type: boolean
          default: true
          description: Uncheck if the site already has one. An existing Gemfile is never overwritten — it may pin gems deliberately — so instead add `gem "github-pages", group: :jekyll_plugins` to it by hand, or let the agent door do it.
        createCatalogInfo:
          title: This repo has no catalog-info.yaml yet
          type: boolean
          default: false
          description: Leave unchecked if the site is already in the catalog — an existing descriptor is never overwritten, and you add the two annotations by hand instead.
  steps:
    - id: stubs
      name: Render the caller stubs
      if: ${{ parameters.createWorkflows }}
      action: fetch:template
      input:
        url: ./skeleton-workflows
        values: {}

    - id: gemfile
      name: Render the Gemfile
      if: ${{ parameters.createGemfile }}
      action: fetch:template
      input:
        url: ./skeleton-gemfile
        values: {}

    - id: descriptor
      name: Render a catalog descriptor
      if: ${{ parameters.createCatalogInfo }}
      action: fetch:template
      input:
        url: ./skeleton-catalog
        values:
          repoName: ${{ (parameters.repoUrl | parseRepoUrl).repo }}
          owner: ${{ parameters.owner }}
          # Must equal siliconsaga.org/module-release in this module's
          # catalog-info.yaml. Bumping one without the other makes every new
          # adopter record a release that does not exist.
          moduleRelease: '1.0'

    - id: pr
      name: Open the adoption pull request
      action: publish:github:pull-request
      input:
        repoUrl: ${{ parameters.repoUrl }}
        branchName: adopt-website-hygiene
        title: 'Adopt the website-hygiene aspect'
        description: |
          Adopts the shared CI workflows from [volundr](https://github.com/SiliconSaga/volundr).

          - `Gemfile` — the `github-pages` gem, which supplies the `jekyll-sitemap` the visual diff walks
          - `.github/workflows/deploy.yml` — builds and publishes to `gh-pages`
          - `.github/workflows/pr-preview.yml` — per-PR preview site, sticky comment, visual diff against main

          **One step remains after merging, and no pull request can do it:** switch this repository's Pages source to the `gh-pages` branch. See [pages-source](https://github.com/SiliconSaga/volundr/blob/main/aspect/docs/pages-source.md).

          Two assumptions worth checking before merging: the deploy stub triggers on pushes to `main`, so edit that line if this repo's default branch differs; and the stubs follow volundr's `main` rather than a pinned SHA, which is [volundr's recorded trust trade-off](https://github.com/SiliconSaga/volundr#trust-model) — branch protection there in exchange for no per-caller drift.

  output:
    links:
      - title: Adoption pull request
        url: ${{ steps.pr.output.remoteUrl }}
      - title: What to do next
        url: https://github.com/SiliconSaga/volundr/blob/main/aspect/docs/pages-source.md
```

- [ ] **Step 3: Verify the template parses as the catalog will read it**

The template is only exercised end-to-end by a human running it, so this step checks the mechanical part. Start the dev instance and confirm the Template ingests once Task 7 registers it — until then, validate the YAML parses and the `spec.type` is right.

Run: `ws exec volundr node -e "const {parse}=require('yaml');const y=parse(require('fs').readFileSync('aspect/template.yaml','utf8'));console.log(y.kind, y.spec.type, y.metadata.name)"`
Expected: `Template aspect apply-website-hygiene-aspect`

- [ ] **Step 4: Commit**

Write `.commits/aspect-create-door.md`:

```markdown
---
message: "feat(aspect): the Create-page adoption door"
add:
  - aspect/template.yaml
  - aspect/skeleton-workflows/.github/workflows/deploy.yml
  - aspect/skeleton-workflows/.github/workflows/pr-preview.yml
  - aspect/skeleton-gemfile/Gemfile
  - aspect/skeleton-catalog/catalog-info.yaml
---

Running this template is the adoption: it renders the Gemfile and both caller stubs and opens a real pull request, rather than logging a plan the way the seeded security template does.
Three skeletons rather than one, split by what fetch:template would destroy. It renders whole directories and overwrites, so the only way to express create-when-absent is to keep the destructible files apart and gate them. The Gemfile and the catalog descriptor both carry content this template cannot reconstruct — a site may pin gems deliberately, and a real descriptor holds ownership and links — so each sits behind a flag and neither is ever clobbered. The caller stubs render unconditionally, because identical content is an empty diff and differing content is drift a reviewer should see.
Editing either existing file stays a hand edit or the agent door's job, since that door reads before it writes.
The pull request body carries the Pages-source step, because that is the part no pull request can perform and the part that decides whether the deploy has anywhere to publish.
```

Run: `ws commit volundr .commits/aspect-create-door.md`

---

## Task 6: The agent door

**Files (in the volundr repo):**
- Create: `aspect/SKILL.md`

**Interfaces:**
- Consumes: the standard from Task 4, and the same four files Task 5's template writes.
- Produces: nothing other tasks read.

- [ ] **Step 1: Write the skill**

`components/volundr/aspect/SKILL.md`:

```markdown
---
name: apply-website-hygiene-aspect
description: Agent-side adoption for the Website hygiene aspect — add the Gemfile and both volundr caller stubs to a static site, record the enrollment, pre-flight the trials, and hand back the one step a pull request cannot perform. The Create-page door is this module's template.yaml; both read the same standard.
---

# Apply the Website hygiene aspect (agent door)

You are adopting this aspect for a target site repository. This is the other front door — same module, same end state as the scaffolder template, no Backstage required.

1. **Check the target is actually a Jekyll site**, and check its default branch. Look for `_config.yml` at the repo root; if there is none, stop and say so, because these workflows build Jekyll and pointing them at anything else produces a confusing CI failure rather than a useful one. Then read the default branch (`gh repo view <owner>/<repo> --json defaultBranchRef`): the deploy stub triggers on pushes to `main`, and GitHub Actions forbids expressions in an `on:` trigger, so a repo on any other default branch needs that line edited by hand. The Create-page door cannot make this check, which is one reason to prefer this door for unfamiliar repos.
2. **Read the standard.** `standard.yaml` in this module is the source of truth for what adoption means. Its trials are what you are working toward, and each names the artifact it inspects.
3. **Add the Gemfile** if absent, declaring `gem "github-pages", group: :jekyll_plugins`. If one exists without that gem, add the gem rather than replacing the file — the site may pin other things deliberately.
4. **Add both caller stubs**, copying them verbatim from `skeleton/.github/workflows/`. Do not pin a SHA in place of `@main`: per-caller pinning reinstates the copy drift this shared repo exists to remove, and volundr's `main` is branch-protected in exchange.
5. **Record the enrollment.** In the target's `catalog-info.yaml`, add `website-hygiene` to `siliconsaga.org/aspects` and `website-hygiene@<module-release>` to `siliconsaga.org/aspect-versions`, reading the release from this module's `catalog-info.yaml`. Create the descriptor if there is none. Unlike the Create-page door, you can edit an existing one safely — do that rather than replacing it.
6. **Pre-flight the trials.** Three of the four are checkable from the working tree: is the Gemfile there with the right gem, does each stub's `uses:` resolve to the volundr workflow at `@main`. Check them before opening anything. The fourth reads a repository setting you cannot see from a checkout.
7. **Open the pull request**, and say plainly in the body what still has to happen after merge: the Pages source must move to `gh-pages` (link `docs/pages-source.md`), and if the site is not already in the catalog someone must register it, because this instance reads an explicit location list and has no discovery provider. A site that merges and stops will keep serving its old content and look like the workflows did nothing.

Tell the human which medal the site should reach once the Pages source is flipped, and which trial is holding it short if one is. Never weaken a trial to make it pass — if a trial is wrong for this target, that is a conversation with the steward, recorded in this module, not a silent skip.
```

- [ ] **Step 2: Commit and push volundr**

Write `.commits/aspect-agent-door.md`:

```markdown
---
message: "feat(aspect): the agent adoption door"
add:
  - aspect/SKILL.md
---

The CLI-side path to the same end state, for the many people who have no Backstage instance to hand — including the GDD tutorial audience.
It does two things the Create-page door cannot. It pre-flights the three file-based trials before opening anything, and it edits an existing catalog-info.yaml in place rather than declining to touch it.
It also opens with a check the template has no way to make: that the target is a Jekyll site at all. Pointing these workflows at something else fails in CI in a way that reads as a broken workflow rather than a wrong target.
```

Run: `ws commit volundr .commits/aspect-agent-door.md`
Then run: `ws push volundr`

Open a CR against volundr with `ws cr volundr "feat: the website-hygiene aspect module" <bodyfile>`, using `templates/change.md` as the starting shape.

---

## Task 7: Register the module in leidangr

**Files:**
- Modify: `app-config.yaml` (two locations after the `security-aspect` pair, around line 170)
- Modify: `scripts/smoke-catalog.sh` (header comment, two entity fetches, three assertions)

**Interfaces:**
- Consumes: `component:default/website-hygiene-practice` and `template:default/apply-website-hygiene-aspect` from Tasks 4 and 5. **Both must be merged to volundr's `main`** before this task's smoke run can pass, because the locations reference `@main`.
- Produces: nothing later tasks read.

- [ ] **Step 1: Add the catalog locations**

In `app-config.yaml`, immediately after the `security-aspect/template.yaml` location (the block ending `allow: [Template]` around line 170), add:

```yaml
    # The first REAL aspect module: it lives in volundr beside the reusable
    # workflows it describes, so a volundr tag is its module-release. Unlike
    # every location above, these read over the network — see the note in
    # scripts/smoke-catalog.sh.
    - type: url
      target: https://github.com/SiliconSaga/volundr/blob/main/aspect/catalog-info.yaml
      rules:
        - allow: [Component]
    - type: url
      target: https://github.com/SiliconSaga/volundr/blob/main/aspect/template.yaml
      rules:
        - allow: [Template]
```

- [ ] **Step 2: Correct the smoke header, which now makes a false claim**

In `scripts/smoke-catalog.sh`, the header says the check *"needs nothing external, so it is safe to run anywhere — including CI."* That stops being true. Replace that sentence with:

```bash
# Run: `make smoke-catalog`. Unlike smoke-gitea (@live, needs OpenBao+Gitea), this
# needs no cluster and no secrets — but it DOES need network since the volundr
# aspect module is registered over `type: url`. Offline runs will fail those
# three assertions and pass the rest. GITHUB_TOKEN is used if present; volundr
# is public, so an unauthenticated read works but shares the low anonymous rate
# limit. Splitting offline and online variants is on the backlog.
```

- [ ] **Step 3: Add the assertions**

Alongside the other `byname` fetches near the top of the assertion section, add:

```bash
WEBPRACTICE="$(byname component/default/website-hygiene-practice)"
WEBADOPT="$(byname template/default/apply-website-hygiene-aspect)"
```

Then with the other aspect checks:

```bash
check     "Website practice ingested (type practice)" "$WEBPRACTICE" '"type":"practice"'                    || pass=0
# Exact, not a presence check: this is the assertion that fails loudly when the
# release was bumped in the module but not in template.yaml, or vice versa.
check     "Website practice module release 1.0"       "$WEBPRACTICE" '"siliconsaga.org/module-release":"1.0"' || pass=0
check     "Website adoption Template (type aspect)"   "$WEBADOPT"    '"type":"aspect"'                       || pass=0
```

- [ ] **Step 4: Run the smoke check**

Run: `make smoke-catalog` from `components/leidangr`.
Expected: PASS with 35 checks. If the three new ones fail, read `.dev/backend.log` for a `UrlReader` error — the usual causes are volundr's branch not yet merged to `main`, or an anonymous rate limit, which reads as HTTP 403.

- [ ] **Step 5: Run the full gate and commit**

Run: `ws test leidangr`
Run: `ws lint leidangr`
Expected: both clean.

Write `.commits/register-aspect.md`:

```markdown
---
message: "feat(catalog): register the website-hygiene aspect module"
add:
  - app-config.yaml
  - scripts/smoke-catalog.sh
---

Two type: url locations pointing at the module in volundr — the practice's catalog face and its adoption template — mirroring the type: file pair that registers the seeded security aspect. The GitHub integration was already configured and volundr is public under its own trust model, so no auth work was needed.
smoke-catalog's header claimed the check needs nothing external and is safe to run anywhere including CI. That stops being true with these locations, so the header now says so rather than quietly becoming wrong. Three assertions cover the practice, its module release, and the template's type.
```

Run: `ws commit leidangr .commits/register-aspect.md`

---

## Task 8: The GDD template's "going further" section

**Files:**
- Modify: `yggdrasil/templates/components/gh-pages/README.md` (Chapter 3+ section, around line 340)

**Interfaces:**
- Consumes: nothing. This task can run at any point.
- Produces: nothing.

**Note on wrapping:** this README is hard-wrapped throughout. Per the convention, ask before reflowing it — and write the new section unwrapped regardless, since new prose always follows the rule.

- [ ] **Step 1: Add the section**

In `templates/components/gh-pages/README.md`, in the Chapter 3+ bullet list, add a final bullet after the "Comments / analytics / search" item:

```markdown
- **Shared CI: previews and visual diffs.** [volundr](https://github.com/SiliconSaga/volundr) holds reusable workflows the SiliconSaga sites share, giving every pull request its own preview URL and a screenshot diff against `main`. Your repo carries two thin caller stubs rather than a copy of the CI logic. Two things have to change first: the site needs a checked-in `Gemfile` using the `github-pages` gem, and Pages has to serve from a `gh-pages` branch instead of `main` as set up in Ch 1 — the deploy workflow publishes there. Adding the Gemfile also switches local preview to `bundle exec jekyll serve`, as noted under **Local preview** below. Ask your agent to walk you through it: the adoption steps live in volundr's `aspect/SKILL.md`, and it can apply them for you.
```

- [ ] **Step 2: Verify no other part of the README now contradicts it**

Read the **Local preview (optional)** section. It says the scaffold ships no Gemfile and already explains what changes if one is added later, so it stays accurate — confirm that is still the case and change nothing if so.

- [ ] **Step 3: Commit and push**

Run: `git -C . checkout -b docs/gh-pages-volundr-extras` from the yggdrasil root.

Write `.commits/gh-pages-volundr.md`:

```markdown
---
message: "docs(gh-pages): point at the volundr CI extras from going-further"
add:
  - templates/components/gh-pages/README.md
---

The template stays deliberately minimal and Ch 3+ is where the optional upgrades live, so shared CI belongs there as prose rather than pre-wired scaffolding — adoption should stay a real step the reader takes.
Names both prerequisites plainly, because they contradict what Ch 1 sets up: the scaffold ships no Gemfile and points Pages at main, while the workflows need a Gemfile and publish to gh-pages. Better to say so here than to have someone discover it from a CI failure.
Nothing Backstage-flavored: the pointer is at the agent door, which needs no instance. That keeps this template usable by the tutorial audience, most of whom have none.
```

Run: `ws commit yggdrasil .commits/gh-pages-volundr.md`
Then run: `ws push yggdrasil`

---

## Final verification

- [ ] `ws test leidangr` — clean, no console output.
- [ ] `ws lint leidangr` — clean.
- [ ] `make smoke-catalog` — 35 checks pass.
- [ ] `bash scripts/with-mkdocs.sh mkdocs build --strict --site-dir .tmp/site-check` in leidangr — passes; delete `.tmp/site-check` afterwards.
- [ ] **Human acceptance, and the real proof.** Run the adoption template from the Create page in `ws run leidangr` against a throwaway GitHub Pages repo, in this order:
  1. Confirm a pull request opens carrying the Gemfile, both caller stubs and a `catalog-info.yaml`. Merge it.
  2. Flip the Pages source to `gh-pages` (see the vísir) and confirm the next push deploys.
  3. **Register the repo** at `/catalog-import`. This instance has no discovery provider, so the merged descriptor is inert until something points at it — skipping this step is what would make adoption look broken when it is not.
  4. Open the site's entity page and confirm `ComponentAspectsCard` shows the enrollment at release 1.0.
  5. Open a pull request against that repo and confirm it gets a preview comment with a visual diff.

  Nothing short of running all five establishes that adoption works. Step 3 in particular is the one most likely to be assumed rather than done.

---

## Deviation from the design, for the record

The design says the adoption pull request writes `catalog-info.yaml` "created or updated". Task 5 creates it when absent and declines to touch an existing one, because `fetch:template` overwrites and a real site's descriptor holds ownership, links and annotations this template cannot reconstruct. **The same reasoning extends to the `Gemfile`**, which the design did not call out and which is the more dangerous of the two: a site may pin gems deliberately, and the naive reading — "no Gemfile means not adopted" — is what makes clobbering one easy to ship. Both sit behind flags; the caller stubs do not, because re-rendering identical files is a no-op and a differing one is drift a reviewer should see.

Updating either existing file is a hand edit or the agent door's job, since that door reads before it writes. If in-place update through the Create-page door is wanted later, it needs a custom scaffolder action that reads the file first — worth its own decision rather than being smuggled in here.
