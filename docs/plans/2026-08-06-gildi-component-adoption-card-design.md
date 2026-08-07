# Gildi — Component adoption decoration (design)

**Date:** 2026-08-06
**Status:** Designed
**Arc:** leidangr-guildhall (follows the practice page + type themes, PR #14)
**Predecessors:** `2026-08-01-gildi-practice-page-and-type-themes-design.md` (§6 deferred this slice), `2026-07-27-gildi-guild-page-layout-design.md` (the layout pattern), `2026-07-20-gildi-guildhall-hub-design.md` (§8, the aspect ladder and the component badge).

## 1. Scope

The component-side half of the adoption relationship: what a component's own entity page says about the aspects it has adopted. This is the flip side of the practice page's Adopters card — the same edge read from the other end.

Two cards, both in the stock right rail of the Component overview:

1. **Aspects** — on components carrying `siliconsaga.org/aspects`: which aspects they adopted, at which version, whether that version is current, who maintains it, and the record of application.
2. **Adopt an aspect** — on components carrying none: a call to action pointing at the Create-page door. Config-gated, default on.

## 2. Why appended cards here, when the guild page rejected them

The guild and practice slices both replaced the stock overview with a hand-composed `EntityContentLayoutBlueprint`. That was right there and is wrong here.

A `Group`/`spec.type: guild` and a `Component`/`spec.type: practice` are narrow types whose stock pages were thin — hand-composing them cost little and every card on the page was ours to place. A `Component` is every service and website in the catalog, and its stock overview is rich: about, links, subcomponents, depends-on-components, depends-on-resources, APIs, graph. Owning that layout means reproducing all of it by hand, and adopter components would silently lose cards their unenrolled neighbours keep — a divergence with nothing to do with adoption.

The unlock that makes an appended card good enough is in the stock `DefaultEntityContentLayout`: it partitions cards by `EntityCardType` into an `info` area (right rail, `1fr`) and a `content` area (main, `2fr`). An `EntityCardBlueprint` declaring `type: 'info'` therefore lands in the **right rail** by construction. We get deliberate placement without owning the page — which is precisely what the 2026-07-26 acceptance feedback was missing when appended cards felt wrong on the guild page.

Blast radius is zero: non-adopters and every stock card are untouched, and Backstage upgrades to the Component overview flow through to us instead of being frozen into a copy.

## 3. Two extensions, not one card with a config schema

The unenrolled call to action is gated so a real organisation can switch off what is, outside a demo, a nag on every unenrolled component.

Rather than one card branching internally on enrollment behind a custom `config.schema`, ship **two card extensions** whose predicate filters are complements:

| | `component-aspects` | `component-adopt` |
|---|---|---|
| Filter | `kind: Component` and a non-empty `siliconsaga.org/aspects` | `kind: Component` and no such annotation |
| Type | `info` | `info` |

The gate is then native — the same `app.extensions` surface the app already uses to remount the catalog at `/`:

```yaml
app:
  extensions:
    - entity-card:gildi/component-adopt: false
```

No custom config schema, no `config.d.ts` entry, and the disabled card never mounts rather than mounting and rendering nothing. Each card keeps one clear purpose and one focused test file. The cost is one extra `EntityCardBlueprint.make()` call.

Documented in `plugins/gildi/README.md` so the knob is discoverable without reading this doc.

## 4. Making currency computable

`aspects.yaml` records the aspect registry's current release (`security: version '1.4'`), and the whole narrative of an adoption drive is the gap between that number and what a component actually adopted — `carrier-gateway` sits at 1.2, `intake-scanner` at 1.3. But the registry is a raw YAML file, not a catalog entity, so the frontend cannot see it.

**Seed change (one line):** the `security-practice` Component gains

```yaml
siliconsaga.org/module-release: '1.4'
```

making the practice the catalog face of its module's current release, alongside the `siliconsaga.org/aspect` id it already carries. This is consistent with how the practice already works — it is the catalog face of the living institution, and the module's release number is a fact about that institution. The term is not invented here: `aspects.yaml` already annotates this very field as *"Current module release."*

### Why not `aspect-version`

The obvious name — `siliconsaga.org/aspect-version`, singular against the component's plural `aspect-versions` — was rejected. Singular-vs-plural is the wrong axis, and one character of difference between two annotations with different owners and different meanings is a trap in a metadata block.

The real distinction is **shape**, and it follows from the model:

- A **component** adopts many aspects, each at one version. Its `siliconsaga.org/aspect-versions` is therefore a **map**, `<id>@<version>` per enrolled aspect, and every consumer reads it one entry at a time — the card resolves `security → 1.2` for the `security` row and never looks at the set as a whole.
- A **practice** maintains exactly one aspect (`siliconsaga.org/aspect`, singular). Its release is therefore a **scalar**, and can never become a map.

`module-release` carries that: a different noun and a different unit from `aspect-versions`, sharing no prefix, and "module" is singular by nature for a practice — so the name cannot be misread as keyed by anything.

Like every other guildhall annotation, both stay inert to the backend; only the frontend reads them. The practice page's Adopters card can reuse `module-release` later to flag which of its adopters are behind — unblocked here, not built here.

## 5. Architecture

```text
plugins/gildi/src/entity/
  aspects.ts                  NEW   pure annotation parsing — no React, no API
  useComponentAspects.ts      NEW   one catalog query + the join
  ComponentAspectsCard.tsx    NEW
  AdoptAspectCard.tsx         NEW
  useAdopters.ts              EDIT  consume aspects.ts instead of inlining the parse
  index.tsx                   EDIT  +2 EntityCardBlueprint extensions
plugins/gildi/src/plugin.tsx  EDIT  register both
plugins/gildi/README.md       EDIT  document the disable knob
examples/mock-org/repos/security-aspect/catalog-info.yaml
                              EDIT  +1 annotation (§4)
```

`aspects.ts` is a targeted cleanup of code this slice touches, not new scope. `useAdopters` already inlines the comma-split and `<id>@<version>` parse that this card needs from the other direction; two copies of that parser will drift. Extracting it gives both sides one implementation with one set of tests, and the parse is the part most likely to meet malformed real-world input.

## 6. Data flow

```text
component entity annotations
  siliconsaga.org/aspects          'security, operational-readiness'
  siliconsaga.org/aspect-versions  'security@1.4'
  siliconsaga.org/adoption-record  'security: https://…/pull/412'
                    │
                    ▼
  one query: getEntities({ kind: Component, spec.type: practice })
             fields: metadata.name/title/annotations, spec.owner
                    │
        index practices by siliconsaga.org/aspect
        each carrying siliconsaga.org/module-release  → currentRelease
                    │
                    ▼
  per aspect id → { adoptedVersion?, currentRelease?, status,
                    practiceRef?, guildName?, recordUrl? }
```

`status` is `current` | `behind` | `unknown`, and is `unknown` whenever either version is missing. The card never guesses: an unversioned enrollment reads "enrolled", not "current".

**Comparison is equality, not ordering.** `behind` means "the adopted version differs from the current one" — the card does not compute *how far* behind, and must not claim to. Version strings here are opaque module release tags; ordering them would mean picking a scheme (semver? lexicographic?) that the registry has never committed to, and getting it wrong reads as authoritative. So the wording is "behind · current 1.4", never "one release behind". If a component's adopted version is somehow *ahead* of the practice's, that is also `behind` under equality — an acceptable inaccuracy today, and a real signal that something is out of step either way.

The practice query mirrors the one `useGuilds` already makes. It stays separate — a different page, one cheap field-limited query, and coupling the two hooks to share it would buy nothing.

## 7. States, and the seed component that exercises each

| Component | State |
|---|---|
| `shipping-orchestrator` | adopted 1.4, current → `current`, plus an adoption-record link |
| `carrier-gateway` | adopted 1.2, current 1.4 → `behind`, no record annotation |
| `intake-scanner` | adopted 1.3 → `behind` from a different starting version |
| `tracking-api` | two aspects; `operational-readiness` has **no practice entity** (`steward: null` in the registry) → id only, no practice link, no currency |
| `label-service` | unenrolled → the call-to-action card |

The `tracking-api` row is the load-bearing one: an aspect can exist before a guild forms a practice around it (design §3.2), so the practice link and the currency verdict must degrade **independently**. A row must not assume that having an aspect id means having a practice to link to.

Loading renders `Progress`, error renders `ResponseErrorPanel` — matching `AdoptersCard`.

## 8. Rendering

Each aspect is one row on a **three-column grid** — `[identity] [body] [badge]`:

```text
┌─ Aspects ─────────────────────────┐
│                                   │
│  ⬡   security        v1.2    [  ] │
│      behind · current 1.4         │
│      Security practice · record → │
│  ─────────────────────────────────│
│  ⬡   operational-readiness   [  ] │
│      enrolled · no version        │
│                                   │
└───────────────────────────────────┘
```

- **Identity (leading, fixed width).** The stewarding guild's `Crest`, seeded by the guild's name exactly as `PracticeCard`'s "Run by" line seeds it, so one guild shows the same arms on every page in the app. This is the identity-mark rule from the hub design §"card family": the guild stewarding the aspect is the actor on that row. The column keeps its fixed width when no crest resolves, so rows stay aligned down the card.
- **Body.** Aspect id, adopted-version chip, the currency line, then the practice link and — when the `adoption-record` annotation carries a URL for that aspect — a record link.
- **Badge (trailing).** Reserved for the earned tier badge. Per hub design §8 the badge belongs on the component, not the aspect, so this card is its eventual home.

**The badge cell renders nothing today.** Tier data does not exist — bronze/silver/gold is prose in `metadata.description`, and inventing a tier annotation would seed fiction as though it were real. Rendering a visible empty placeholder on every row would read as a broken card, so the slot is structural: the grid column exists and the row component has the cell, so adding the badge later is a change inside the row with no re-layout of the card and no re-acceptance of the surrounding page.

The call-to-action card uses a react-router `Link` rather than `<a href>`, avoiding the full-page reload the 2026-07-22 whole-branch review flagged on the Actions panel. Its target is the Create page filtered to aspect templates; the exact filter query-parameter form is verified against the running app at implementation rather than assumed here, and the plain `/create` path is the fallback if the filter form does not hold.

## 9. Testing

- **`aspects.ts`** — parse, dedupe, and malformed input for both annotation shapes, plus the `<id>@<version>` pairing. The most valuable tests in the slice: pure functions, and the code most exposed to bad input.
- **`ComponentAspectsCard`** — the five §7 states plus loading and error.
- **`AdoptAspectCard`** — renders the call to action and links to the Create page.
- **Both filter predicates, tested directly** — enrolled, unenrolled, empty-string annotation, wrong kind. This also delivers most of the deferred `renderInTestApp` filter-gating item carried on the arc since 2026-07-29.
- Gate: `ws test leidangr` + `ws lint leidangr`.
- Human visual acceptance across the five §7 components — the rail placement, crest alignment with and without a practice, and the currency wording.

## 10. Out of scope

- **Tier / badge rendering** — no data (§8). The slot is reserved; the badge is not built.
- **Practice-side "N adopters behind" rollup** — unblocked by §4's annotation, not built here.
- **Guild-level maturity rollup** ("its components at bronze/silver/gold", hub design §8) — depends on tier data that does not exist.
- **Component overview layout ownership** — explicitly rejected in §2.
- **Aspect `Template` entity-page decoration** — still intentionally none, per the practice-page design §1.
- **Normalising the component's parallel per-aspect maps** — see below. Observed here, deliberately not fixed here.

### Known shape problem: parallel per-aspect maps

A component carries three annotations that are all keyed by aspect id — rows are aspects, columns are per-aspect facts:

```text
siliconsaga.org/aspects           'security, operational-readiness'   the rows
siliconsaga.org/aspect-versions   'security@1.4'                      column: adopted version
siliconsaga.org/adoption-record   'security: https://…/pull/412'      column: record of application
```

Each new per-aspect fact means another flat annotation with its own ad-hoc encoding, and the two that exist already disagree on separator — `@` in one, `: ` in the other. Every consumer has to know both.

Not fixed in this slice, on purpose: this ships a card, and collapsing the maps would touch the seed, `useAdopters`, the aspect repo's `SKILL.md` and `template.yaml`, and the design docs that specify the shapes. Those shapes are already recorded as tentative until the scorecard engine consumes them, and that engine is the right forcing function for the decision. `aspects.ts` (§5) parses both encodings cleanly in the meantime, which is what keeps the cost of deferring low — one module knows about the inconsistency, not every caller.
