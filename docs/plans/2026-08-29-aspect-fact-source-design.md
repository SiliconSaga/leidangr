# The Fact Source — Computing Trials (Design)

**Date:** 2026-08-29
**Status:** Draft
**Scope:** Sub-project 3 of the website-hygiene arc, plus the minimum facet resolution (sub-project 2) it needs to know which trials apply. Reads an adopting repo, answers each trial, and stores the run. Nothing renders yet.
**Arc:** leidangr-guildhall (follows the aspect module and its real adoption, PR #21)
**Related:** `2026-08-11-website-hygiene-aspect-design.md` (§1 names this sub-project and its unknowns), `2026-07-10-guilds-skills-standards-design.md` (§5 "evaluate tech-insights first"), ADR 0010, ADR 0013, proposed ADR 0014

---

## 1. What this is

The 2026-08-11 design deferred trial evaluation with a sentence: *"facts read live from the API, published by the workflows, or refreshed by a processor."* It also predicted that the choice *"will be far better informed once a real repo has actually adopted."* One has — `SiliconSaga/hygiene-testsite` carries the Gemfile, both caller stubs, and a `catalog-info.yaml` — so this design is written against a repo that exists rather than against a hypothetical.

It covers acquisition, evaluation, and storage. It does **not** cover rendering: the badge cell in `ComponentAspectsCard` stays empty, and the chart stays unbuilt. What this design does owe them is a contract they can be built against without re-deciding anything, which §9 provides.

## 2. The three mechanisms, decided

| Mechanism | Verdict |
|---|---|
| Read live from the API on render | **No.** No scheduled refresh is possible, and every page view spends a rate-limited call per viewer. |
| Published by the workflows | **No.** The trials ask whether the workflows are correctly wired, so letting those workflows self-report is circular — and a repo that adopted incorrectly cannot report at all, making "no facts" ambiguous between "not adopted" and "workflow did not run". |
| Refreshed by a scheduled process | **Yes**, with an explicit manual re-check so a fresh adoption can be proven without waiting for a tick. |

### Tech Insights was evaluated, as §5 of the 2026-07-10 design directed

`@backstage-community/plugin-tech-insights` models `FactRetriever` as `{id, version, schema, handler, entityFilter}`, checks as `json-rules-engine` rules over `factIds`, and cadence as cron through `SchedulerService`. Two findings decide it against us.

**Its default storage is in-memory** — persistence requires a custom `TechInsightCheckRegistry`. And its frontend advertises *"default boolean checks in a form of Scorecards"*. So adopting it would buy scheduling we already have from `SchedulerService`, storage it does not actually provide, and a scorecard UI we cannot use because `ComponentAspectsCard` already owns that surface. Blocks, facet applicability, and derived medals remain our model either way.

This is the branch that design anticipated: *"fall back to a custom grouped-checks plugin if it constrains."*

For calibration, Spotify's Soundcheck — the commercial product this practice is repeatedly compared against — has exactly three check states: passed, failed, and not applicable, with no attestation and no pending state. Three states is roughly the industry floor.

## 3. The outcome model

A trial outcome is a discriminated union, never a boolean. The boolean is the trap the `artifact:` field was added to avoid: it reads fine and cannot express what you later need.

```
Outcome =
  | { state: 'pass' }
  | { state: 'fail',       detail?: string }
  | { state: 'unmeasured', reason: 'no-resolver' | 'error' | 'no-source', detail?: string }
```

`error` and `no-resolver` are deliberately *sub-flavours of unmeasured* rather than peers of `fail`. Both mean the same thing to a reader — nobody knows whether this trial holds — and collapsing them into `fail` would blame a component for our missing resolver.

**A missing artifact is `fail`, not `unmeasured`.** This is the distinction most likely to be got wrong. No `Gemfile` means `gemfile-present` fails: absence is the answer, not an obstacle to finding one. `unmeasured` is reserved for when we could not look at all — `no-source` when the component's repository cannot be determined, `error` when the lookup itself broke, `no-resolver` when nothing here knows how to answer the trial (an unregistered `factSource` or an unknown `check.type`).

**`not applicable` is not an outcome.** Soundcheck models it as a third result state; we model it as an applicability verdict that happens *before* evaluation. A non-applicable trial is excluded from the applicable set entirely, which is what `medalFor` already assumes, so that function does not change shape.

### Medals, amending ADR 0013

ADR 0013 defines gold as every applicable trial passing. An unmeasured trial makes that claim unprovable, so:

**Any applicable trial in `unmeasured` suppresses the medal, and the reason is surfaced in its place.**

Suppression is not a medal value. `none` already means "measured, and nothing passed", which is a real verdict about a component. Suppression means "we cannot say", which is a statement about us. Rendering them identically would be the same failure ADR 0013 set out to end — a medal that does not mean what it says.

This warrants **ADR 0014**, amending 0013 with the third state.

### Attestation, considered and deferred

Some trials can never be computed — "threat model current" has no artifact a machine can read. The honest shape for those is an annotation a human sets, and it has a different outcome axis: `attested | todo`, with no `fail`, because nobody claimed the thing was done. `todo` is not a failure; it is an acknowledged intent, and it is the neutral starting state a scaffolder template would write.

Prior art exists — the Oriflame score-card plugin sources per-entity data from a `scorecard/jsonDataUrl` annotation, runs on team self-assessment, and attaches an explicit TODO to each score.

**Not built now**, because adding a `verification:` field to `standard.yaml` that nothing reads is fiction. What keeps the door open costs nothing: **the aggregation layer consumes outcomes, never resolvers.** Attestation then arrives as a new outcome producer rather than a change to medal logic. When it does, `todo` counts toward applicable and not toward passing — it does not suppress, because its state is known.

## 4. The predicate gap

The 2026-08-11 design claims each trial is *"phrased as a predicate over a named artifact rather than as prose"*. The file does not deliver that:

```yaml
- id: gemfile-present
  rule: a Gemfile at the repo root declares the github-pages gem   # English
  artifact: Gemfile                                                # what to read
  factSource: repo-files                                           # how to fetch
```

`factSource` says how to acquire and `artifact` says what to read, but **nothing says what makes it pass**. A resolver can fetch the Gemfile and still not know it must contain `github-pages`. `deploy-stub-points-at-volundr` is worse: it needs a job whose `uses:` is *exactly* a given string, which is structural YAML matching rather than a substring scan.

Trials gain a `check:` block with a **closed vocabulary**, not an expression language:

| `check.type` | Params | Used by |
|---|---|---|
| `file-contains` | `value` | `gemfile-present` |
| `workflow-job-uses` | `value` | both stub trials |
| `pages-source-branch` | `value` | `pages-source-is-gh-pages` |

```yaml
- id: gemfile-present
  rule: a Gemfile at the repo root declares the github-pages gem
  artifact: Gemfile
  factSource: repo-files
  check: { type: file-contains, value: github-pages }
  remediation: ./docs/adopting.md
```

A closed enum rather than a DSL, for two reasons. It keeps `standard.yaml` readable by the humans who have to trust it, and it bounds what a standard read over the network can ask our backend to do — a general expression language evaluated on data fetched from a URL is a much larger security surface than three typed predicates.

The alternative — predicates in leidangr keyed by trial id — was rejected because it breaks the module's central claim. The aspect lives inside volundr so that *"a workflow change and the change to the trial describing it land in the same reviewed pull request."* If computing that trial also needs a leidangr code change, the property is gone.

An unknown `check.type` is `unmeasured{no-resolver}`, never a pass — the same reason an unregistered `factSource` uses, because to a reader they are the same statement: nothing here knows how to answer this trial.

## 5. Finding the standard, and finding the repo

**The standard is not currently discoverable.** The practice descriptor carries `siliconsaga.org/aspect` and `siliconsaga.org/module-release`, but `standard.yaml` appears only in `links[]` behind a free-text title. Parsing display metadata would be fragile.

The practice gains one annotation, mirroring the `siliconsaga.org/visir: './docs/pages-source.md'` convention already in that file:

```yaml
siliconsaga.org/standard: './standard.yaml'
```

Resolved against the entity's own source location, so it travels with the module.

**The adopter's repo needs no new annotation.** `AnnotateLocationEntityProcessor` sets `backstage.io/source-location` to the containing directory, and `catalog-model` exports `getEntitySourceLocation()` to read it back. A component registered from its own repo therefore already says where it lives.

One trap worth recording, found by running the smoke rather than by reading config: **GitHub location targets are stored in `tree` form even when `app-config.yaml` declares `blob`**, because `GithubIntegration.resolveUrl` rewrites every GitHub URL through `replaceGithubUrlType(..., 'tree')`. Anything comparing against a configured URL must expect `tree`.

### Facet resolution — the minimum from sub-project 2

```
facets(entity) = parseList(annotations['siliconsaga.org/facets'])
                 || facetDefaults[entity.spec.type]
                 || []
block applies  = appliesTo includes '*' or intersects facets
```

Roughly fifteen lines reusing the existing `parseList`, and already exercised — the smoke asserts `tracking-api facets override (api, batch)`. Full facet resolution stays sub-project 2.

## 6. Packaging

| Package | Holds | Status |
|---|---|---|
| `plugins/gildi-common` | Outcome union, standard shape types, `medalFor`, outcomes→medal aggregation | New |
| `plugins/gildi-backend` | Resolver registry, two resolvers, facet filter, evaluator, store, scheduler, router | New |
| `plugins/gildi` | `useComponentTrials` hook, read-only | Exists |

`medals.ts` moves into `gildi-common`. It has no caller today, so this is the cheapest moment it will ever be moved — after sub-project 4 renders it, the move costs a refactor of the render path too.

`scripts/lib/standard-shape.ts` shares `gildi-common`'s **vocabulary** rather than its types. The distinction matters: a validator's input is by definition unvalidated, so it cannot take `Standard` as a parameter type — its local raw shape, where every field is optional and untrusted, is correct and stays. What it must not do is keep a *second copy of the rules*, so `CHECK_TYPES` is imported rather than restated. A validator whose idea of the vocabulary can drift from the code that consumes it reports green while checking the wrong thing — the same class of fault as the hand-copied palette fixture.

The types in `gildi-common` are the **post-validation** contract: what a consumer may assume once `validateStandard` returns no issues. That makes the two halves complementary rather than duplicated, and it is why the validator also has to check the standard-level fields those types declare non-optional.

A backend **plugin**, not a catalog module: `modules/cycle` and `modules/saga` extend the catalog with entity kinds, whereas this owns its own storage and HTTP surface.

## 7. Data flow

1. Find Components carrying `siliconsaga.org/aspects`
2. Join each adopted aspect id to its practice via `siliconsaga.org/aspect`
3. Read that practice's `standard.yaml` through the new annotation
4. Resolve facets, filter blocks, produce the applicable trial set
5. Group applicable trials by `factSource`, dispatch to resolvers
6. Append one run row

Two resolvers ship. `repo-files` reads artifacts through `UrlReaderService`, so integration credentials and caching are handled for us. `github-pages-api` reads the repository's Pages configuration. Any other `factSource` — `ci-pipeline-results`, `catalog-annotations`, `aspect-repo`, all of which exist only in `examples/mock-org/` — resolves to `unmeasured{no-resolver}`. Writing resolvers against fictional artifacts would be inventing evidence.

**Failure is isolated per resolver.** A throwing resolver marks only its own trials `unmeasured{error}`, so one broken resolver never blanks the others.

**A standard that will not load is a run-level failure, not an empty trial set.** This distinction is load-bearing and easy to get backwards. If `standard.yaml` cannot be read we do not know what the trials *are*, so there is nothing to mark unmeasured — the applicable set is **unknown**, not zero. Conflating the two is a real hazard, because an empty applicable set is a legitimate state that derives medal `none` per ADR 0013, and `none` means "measured, and nothing passed". A run that never got as far as reading the standard would otherwise publish a verdict about a component on the strength of our own failure.

So a run takes one of two shapes:

```ts
Run = { kind: 'evaluated';   outcomes: Outcome[] }   // applicable set known, possibly empty
    | { kind: 'unevaluated'; reason: 'no-standard'; detail?: string }
```

An `unevaluated` run stores `medal: null` with `applicable` and `passing` **null rather than zero**, so a chart shows a gap where the ladder could not be computed instead of a drop to the bottom.

**Bounded from day one:** a concurrency limit across entities and a per-run timeout. Cheap now, and it is exactly what keeps the in-process runner viable up to the scale where §10 becomes interesting.

## 8. Storage — append-only

One row **per run**, not per entity. The upsert design was considered and dropped, because append-only answers three questions at once rather than one.

| Column | Purpose |
|---|---|
| `entity_ref`, `aspect_id` | Subject |
| `run_at` | Ordering |
| `module_release` | The standard's release at evaluation time |
| `kind` | `evaluated` or `unevaluated` — which shape the rest of the row takes |
| `outcomes` | JSON, one entry per applicable trial. Null on an `unevaluated` run |
| `applicable`, `passing` | Denormalised for cheap charting. **Null, not zero, on an `unevaluated` run** |
| `medal`, `suppressed_reasons` | Derived at write time. `medal` is null when suppressed or unevaluated |
| `unevaluated_reason`, `unevaluated_detail` | Why the run never evaluated. Null on an `evaluated` run |

A JSON blob for outcomes rather than a row per trial: we never query by trial, and a blob avoids schema churn while the union is young.

**The unevaluated cause is stored, not just the fact of it.** Without `unevaluated_reason` and `unevaluated_detail` the row records that we could not say, and then cannot say why either — which is the same silence the state was introduced to break. The detail is where a `404` on the standard URL is distinguishable from a parse error, and that distinction is the whole value of the row to whoever is debugging a component whose medal vanished.

**Medals are frozen per run.** Deriving at write time means a later change to the medal rules does not retro-apply to stored history. That is the right default for an audit trail — a chart should show what the ladder said at the time, not what it would say now — but it does mean an ADR 0014 amendment needs a deliberate backfill rather than taking effect silently.

What falls out for free:

- **"Keep last-good or overwrite on error" stops being a storage policy.** An errored run is simply another row, the previous good row still exists, and the reader chooses. That question dissolves rather than needing an answer.
- **Version changes are visible** without a separate event log, because `module_release` is on every row.
- **"First earned" and "re-earned" medal moments** are derivable by scanning the series.

**Retention** is required, since append-only grows without bound. Tech Insights offers either `maxItems` or a TTL and that precedent is worth copying — configurable, with a default that keeps enough history to be worth charting.

## 9. The chart contract

Sub-project 4 renders this. Events are derived **server-side** so every client agrees on the semantics and no consumer re-implements them.

```
GET /api/gildi/trials/:entityRef/history?aspect=<id>&from=&to=

runs:   [{ runAt, moduleRelease, kind: 'evaluated' | 'unevaluated',
           medal | null, suppressedReasons?,
           applicable | null, passing | null,
           outcomes: [{ trialId, state, reason?, detail? }] | null,
           unevaluatedReason?, unevaluatedDetail? }]
events: [{ type: 'release-changed', at, from, to },
         { type: 'medal-earned',    at, medal, first: boolean }]
```

`suppressedReasons` is **plural**: several trials can be unmeasured for different reasons in the same run, and collapsing them loses the one thing the field exists to say. It is the distinct set, sorted, so the value is stable across runs and can be compared to decide whether anything actually changed.

`medal: null` covers both suppression and an `unevaluated` run, which `kind` distinguishes. Keeping either distinct from `'none'` is the whole reason the union exists, and flattening them here would make it invisible exactly where it matters most — neither should read as a drop to zero when both are really a gap in the line.

Reads: `GET /api/gildi/trials/:entityRef` for the latest run, and `POST /api/gildi/trials/:entityRef/refresh` for the manual re-check, which evaluates one entity synchronously and returns the fresh run.

## 10. Deferred: offloading the runner and the store

The TechDocs split — build locally or read what CI already built, via a `publisher` contract — is the right shape to grow into. At scale you would want the checks running outside the Backstage process and the history in a time-series store, with the entity page reading results or embedding a Grafana panel. Treating trials as SLOs and medal loss as an incident is a genuinely novel framing.

**Prometheus is not the store of record**, for one decisive reason: portability. The aspect's own pitch is that it runs on *"any Backstage instance"* and that *"the evaluation engine is the only real build"*. Requiring an observability stack to render a medal breaks that. Three smaller mismatches reinforce it — `reason` and `detail` become a label-cardinality problem, Prometheus is lossy by design where we want an audit trail, and its pull model fits badly with expensive scheduled GitHub calls.

It is a fine **export**. An optional metrics endpoint over the same append-only table gives Grafana charting and SLO framing to anyone who has the stack, without making it a dependency for anyone who does not.

Three seams now make that future cheap, and they are the only concessions this design makes to it:

1. **A `TrialResultStore` interface** — read latest, read history, append. Knex-backed today; a remote implementation slots in behind it. This is TechDocs' `PublisherBase`.
2. **The evaluator is not owned by the scheduler.** `evaluate(entity, standard, resolvers) → outcomes` is a pure-ish function the scheduler merely calls, so an external runner can reuse it or bypass it.
3. **The run payload is a versioned contract**, not an internal detail. TechDocs' external builder works because the artifact format is defined. Defining ours is free — it is the shape the store already persists.

Deliberately **not** done: no ingest endpoint, and no `runner`/`store.type` config keys with a single legal value. Both are fiction until an external runner exists, and the interfaces above are what actually make the swap possible.

## 11. The release bump

`module-release` goes to **1.1**. Adding the `standard` annotation and the `check:` blocks changes the module contract, and the 2026-08-11 design argues *"the second release is worth more than a bigger first one"* — nothing has ever exercised `behind`. hygiene-testsite stays at 1.0 and will render `behind` against a live 1.1, proving the currency model end to end for the first time.

The descriptor's own comment warns that three places repeat this value and must move together:

1. `aspect/catalog-info.yaml` — `siliconsaga.org/module-release`
2. `aspect/template.yaml` — `steps.descriptor.input.values.moduleRelease`
3. leidangr `scripts/smoke-catalog.sh` — the module-release assertion, which is deliberately exact and currently pins `1.0`

## 12. Testing

- **`gildi-common`** — table-driven aggregation tests mirroring `medals.test.ts`: suppression when any applicable trial is unmeasured, `none` versus suppressed, and the `A == 0` case.
- **Negative control: an unevaluated run must not look like `none`.** A standard that failed to load has no trials, so the tempting call is `verdictFor([])` — which returns a confident `none` meaning "measured, and nothing passed". The test pins that the two are distinguishable, because the mistake produces a plausible verdict rather than an error.
- **`gildi-backend`** — resolvers against a fake `UrlReaderService`, registry dispatch, facet filtering, and per-resolver error isolation.
- **Negative control: a missing resolver must yield `no-resolver`, never a pass.** This is the failure that would silently inflate every medal in the catalog, and it is invisible without a test that asserts it.
- **Negative control: a near-miss `uses:` must fail.** `@v1` instead of `@main`, or a different repo. Without it a lazy substring match passes everything, and the trial looks green while checking nothing.
- **Live integration against `SiliconSaga/hygiene-testsite`**, network-gated like `smoke-catalog`. The repo is a known-good adopter, so the expected medal is knowable in advance — and `pages-source-is-gh-pages` is the one trial that should *fail* there until someone flips the setting by hand, which makes it the most useful assertion in the suite.

## 13. Build order

Four stages, each independently reviewable and each leaving the tree green. The order is chosen so the parts with no external dependencies land first and the network-dependent work lands against something already proven.

1. **`gildi-common`** — the outcome union, standard shape types, the `medals.ts` move, aggregation with suppression, and `scripts/lib/standard-shape.ts` re-pointed at the shared types. Pure functions, no I/O, fully unit-testable. Nothing else can be built confidently until the vocabulary is fixed.
2. **volundr** — the `siliconsaga.org/standard` annotation, `check:` blocks on all four trials, and the 1.1 bump across its three places plus the leidangr smoke assertion. Data only, no code, and it must land before a resolver has anything to read.
3. **`gildi-backend`** — store and migration, resolver registry, the two resolvers, evaluator, scheduler, router. The bulk of the work, and the stage carrying both negative controls.
4. **`gildi`** — `useComponentTrials`, read-only. Deliberately last and deliberately small, so nothing renders before the data underneath it is trustworthy.

Stages 1 and 2 are independent of each other and can go in either order or in parallel.

## 14. Out of scope

- The tier badge and the history chart — sub-project 4, built against §9.
- Full facet resolution — sub-project 2 beyond the §5 minimum.
- Resolvers for the three mock-only fact sources.
- Attestation and `todo`, per §3.
- The metrics export and external runner, per §10.
