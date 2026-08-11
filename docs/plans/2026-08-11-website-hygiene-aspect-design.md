# Website Hygiene — the First Real Aspect (Design)

**Date:** 2026-08-11
**Status:** Draft
**Scope:** The first aspect that is not seed data. Wraps the reusable GitHub Actions workflows in [volundr](https://github.com/SiliconSaga/volundr) so a website component can adopt PR previews, visual diffing, and deploy-through-the-forge — with adoption that really opens a pull request.
**Arc:** leidangr-guildhall (follows the hub retirement and instance modelling, PR #17)
**Related:** ADR 0010 (aspect is a module, adoption has two doors, standards block by facet), `2026-07-10-guilds-skills-standards-design.md` (§3.4/§3.6 the standard's two axes), `examples/mock-org/repos/security-aspect/` (the shape this mirrors)

---

## 1. What this is, and what it is not

Every aspect in the catalog today is mock data under `examples/mock-org/`. This one is real: a real module in a real repo, describing real workflows, adopted by real sites. That is the whole point of building it.

It is **not** the whole model. Trial evaluation, facet resolution, and the scorecard badge stay unbuilt. This design covers the module, its standard, and adoption that genuinely writes files. The standard is written so the fact source can compute it later without the standard changing.

The full arc, for context — each piece is independently useful and gets its own design:

| # | Piece | Status |
|---|---|---|
| 1 | The aspect module and real adoption | **this design** |
| 2 | Facet resolution — `spec.type` + `siliconsaga.org/facets` to a resolved facet set | later |
| 3 | Fact source — reads an adopting repo and answers each trial | later |
| 4 | Scorecard surface — the tier badge in the slot `ComponentAspectsCard` already leaves empty | later |

Sub-project 3 carries the real unknowns (facts read live from the API, published by the workflows, or refreshed by a processor) and will be far better informed once a real repo has actually adopted.

## 2. Where the module lives, and why

The module is a thin `aspect/` directory **inside volundr**, beside the workflows it describes.

The alternative — its own `website-hygiene-aspect` repo — matches ADR 0010's "an aspect is a versioned repo" more literally, and was rejected for one reason: two repos means two release clocks, and the standard would be free to describe a workflow volundr does not have. Co-located, a volundr tag *is* the `module-release`, and that class of drift is unrepresentable. The cost is Guildhall vocabulary living in a CI repo, which is a small and honest price.

Seeding it under `examples/mock-org/` was rejected outright: a mock that references real workflows is the most confusing of both worlds.

## 3. Module layout

```text
volundr/
  .github/workflows/          # the paved road — already exists
    jekyll-deploy.yml
    pr-preview.yml
    flyer-export.yml
  aspect/
    catalog-info.yaml         # the practice's catalog face
    standard.yaml             # blocks and derived medals
    template.yaml             # adoption, Create-page door
    SKILL.md                  # adoption, agent door
    mkdocs.yml
    docs/                     # vísar
      index.md
      adopting.md
      pages-source.md
      local-preview.md
```

`catalog-info.yaml` is a `Component` with `spec.type: practice`, owned by `group:default/team-devex`, carrying `siliconsaga.org/aspect: website-hygiene`, `siliconsaga.org/module-release`, `siliconsaga.org/visir`, and `backstage.io/techdocs-ref: dir:.`. It mirrors `security-practice` field for field, so the practice page renders it with no new frontend work.

**Owner note.** Guilds steward practices and teams own software, but every guild in the catalog today is Ravenline mock data. `team-devex` is the only real group, so it stewards this until a real guild exists. Worth revisiting when one does.

## 4. The standard

Four trials across three blocks, all on the `web-ui` facet — which `standard.yaml` already maps from `spec.type: website` via `facetDefaults`.

| Block | Trial | Passes when |
|---|---|---|
| `build-inputs` | `gemfile-present` | `Gemfile` exists at the repo root and declares the `github-pages` gem |
| `deploy` | `deploy-stub-points-at-volundr` | `.github/workflows/deploy.yml` has a job whose `uses:` is exactly `SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@main` |
| `deploy` | `pages-source-is-gh-pages` | the repo's GitHub Pages configuration has `source.branch == gh-pages` |
| `preview` | `preview-stub-points-at-volundr` | `.github/workflows/pr-preview.yml` has a job whose `uses:` is exactly `SiliconSaga/volundr/.github/workflows/pr-preview.yml@main` |

Each is phrased as a predicate over a named artifact rather than as prose, because sub-project 3 has to compute it. Today's security standard says things like "no critical finding older than 30 days" with a `factSource:` label and nothing behind it; that is cheap to write and expensive to retrofit. Every trial carries its remediation vísir, so a failing check stays one click from the fix.

`pages-source-is-gh-pages` is deliberately the odd one out: a repository setting, not a file, so no pull request can satisfy it. It stays a documented manual step — which is useful rather than unfortunate, because it means the ladder does real work from the first adopter, holding them at silver until a human flips the switch.

### Medals are derived, not assigned

Let A be the applicable trials after facet filtering, and P the passing ones:

| Medal | Condition |
|---|---|
| gold | `P == A` |
| silver | `P == A - 1` |
| bronze | `1 <= P < A - 1` |
| none | `P == 0` |

An aspect offering two checks awards silver for one and gold for both; an aspect offering one check awards gold for passing it. The top medal always means "everything applicable passes", so an aspect is complete at any size.

This replaces the hardcoded `tiers: [{name: bronze, trials: [...]}]` shape. Assigned tiers produce unreachable medals — security's gold currently hangs on a single trial that many components have no path to — and they force every new trial to be slotted into a rung by hand. **ADR 0013 records the change, and `security-aspect/standard.yaml` drops its `tiers:` block entirely**, so the future scorecard implements one rule rather than two shapes. Nothing replaces that block: with medals derived, a standard declares only its blocks and trials, and the ladder falls out of them.

Known limitation, recorded in the ADR: derived medals weight every trial equally. That is right for four tightly-scoped website checks and arguable for security, where "no secrets in repo" and "threat model current" are not peers. Explicit weighting stays available as a later amendment.

### Out of the standard on purpose

- **Branch protection**, despite volundr's trust model depending on it. It is Git-provider hygiene, not "can this team ship a website well", and belongs to a different aspect.
- **`flyer-export`**, volundr's third workflow. Too unrelated to website hygiene, and it may move.

## 5. Adoption

Both doors reach the same end state. The Create-page door writes four files:

```text
+ Gemfile                            github-pages gem
+ .github/workflows/deploy.yml       caller stub
+ .github/workflows/pr-preview.yml   caller stub
~ catalog-info.yaml                  created or updated
    siliconsaga.org/aspects: website-hygiene
    siliconsaga.org/aspect-versions: website-hygiene@<module-release>
```

The template gathers the target repo and, when creating a `catalog-info.yaml`, the owner and system; it writes via `fetch:template` and opens the pull request with the stock `publish:github:pull-request` action. No custom scaffolder actions.

**The fourth file is what closes the loop.** Without the enrollment annotations nothing reaches the catalog; with them, adopt → pull request → merge → ingest → `ComponentAspectsCard` renders the enrollment in the card that already ships. The `gh-pages` component template carries no `catalog-info.yaml`, so for tutorial sites this step creates one.

Flipping the Pages source from `main` to `gh-pages` remains a manual step, documented in `docs/pages-source.md` and reported by `pages-source-is-gh-pages`.

The agent door in `SKILL.md` reaches the same end state without Backstage: pre-flight checks (is this a Jekyll site, does a `Gemfile` already exist, is a stub already present), the same four edits, then the Pages instruction. This is the path a GDD tutorial can use, where an audience mostly has no Backstage instance to hand.

## 6. Drift is a feature of this aspect

`module-release` on the practice and `siliconsaga.org/aspect-versions` on the adopter already model currency, and `adoptionStatus` already renders `current` against `behind`. Nothing exercises them, because nothing has ever shipped a second release.

This aspect will. Adding a fifth trial in a later volundr tag bumps `module-release`, and every component still recording the older version reads as `behind` in the card — without any component changing. That makes the drift story testable end to end, and it is the strongest reason to prefer a small standard now over a complete one: **the second release is worth more than a bigger first one.**

Comparison stays equality-only. `behind` never claims how far, because release tags are opaque and no ordering scheme is committed.

## 7. Registration in leidangr

Two locations in `app-config.yaml`, mirroring the `type: file` pair that registers `security-aspect`:

```yaml
- type: url
  target: https://github.com/SiliconSaga/volundr/blob/main/aspect/catalog-info.yaml
  rules:
    - allow: [Component]
- type: url
  target: https://github.com/SiliconSaga/volundr/blob/main/aspect/template.yaml
  rules:
    - allow: [Template]
```

The GitHub integration is already configured with `${GITHUB_TOKEN}`, and volundr must stay public under its own trust model, so no new auth work is needed.

## 8. The GDD side

`templates/components/gh-pages/README.md` gains a section under Chapter 3+, covering what the volundr extras give you, the two prerequisites a site needs, and a pointer at the agent door. Prose only: no Backstage vocabulary, no pre-wired workflows, no new component flavor. The base template stays agnostic, and adoption stays a real step rather than something the scaffold did for you.

A `gh-pages-advanced` flavor was considered and dropped. `ws component init` resolves flavors only from yggdrasil's `templates/components/`, so a Backstage-aware flavor would put stack-specific material in the agnostic layer. Letting realms ship flavors is a `ws` feature and its own arc.

One consequence to document: the base README's local-preview section assumes no `Gemfile` and prescribes plain `jekyll serve`. Adoption adds one, so the note must point at the existing `bundle exec` guidance a few lines below it — the template already anticipates a `Gemfile` arriving later.

## 9. Testing

- **`standard.yaml` shape** — a validator in leidangr's `scripts/lib/` asserting every trial has an id, a rule, a `factSource`, and a remediation path that resolves to a file in its module. It takes a path, so it runs in CI against the security standard that lives in this repo, and can be pointed at volundr's once that component is cloned locally. Volundr has no test harness of its own, and giving it one is not worth it for five data files.
- **Medal derivation** — a pure function with a table of cases: one trial, two trials, and a facet-filtered set where a non-applicable trial must not count against the total. It has no caller until sub-project 4, and exists anyway because removing the `tiers:` blocks deletes the only current statement of what a medal means. A rule two standards depend on should be executable rather than prose in an ADR.
- **`smoke-catalog`** — new assertions that the practice ingests as `type: practice` with its aspect annotation, and the template as `type: aspect`. This makes the smoke suite require network for the first time, which is accepted; offline and online variants are on the backlog.
- **The template** — a scaffolder dry-run in the dev instance, plus one real adoption against a throwaway site repo. Opening a real pull request is the acceptance test, and it is human-gated.

## 10. Deferred

- Automating `pages-source-is-gh-pages` through the GitHub Pages API. The trial ships in the standard now; computing it belongs to sub-project 3.
- Offline and online variants of `smoke-catalog`, likely alongside better test categorisation generally.
- A real guild to steward this practice, replacing `team-devex`.
- Explicit trial weighting, if equal-weight medals prove wrong for a larger standard.

## 11. ADRs

- **ADR 0013 — medals are derived from applicable trials.** Records the rule, why assigned tiers produced unreachable medals, and the equal-weight limitation.
