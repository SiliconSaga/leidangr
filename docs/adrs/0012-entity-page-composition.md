# Entity pages are composed by filtered layout for narrow types, appended cards for broad ones

- Status: accepted
- Date: 2026-08-10
- Deciders: Cervator, Claude (Opus 5)

## Context and Problem Statement

ADRs 0009 and 0010 fixed the Guildhall model as plain annotations and entity links, with no new custom kinds. That held, but left the model *invisible*: a guild looked like any other Group, a practice like any other Component, and an enrolled component showed nothing at all. Reading the relationships back onto entity pages is the `gildi` plugin's job — and the first attempt got it wrong in a way worth recording.

Slice 6 appended three cards to the stock Group page. They rendered correctly and manual acceptance still rejected the result: the composition was wrong, with Backstage's entity graph leading and our Charter buried below it. Appending had no say in *position*. The obvious correction — always own the layout — is equally wrong in the other direction, and the third slice proved it.

## Considered Options

- **Always append cards.** Cheap, zero blast radius, no control over placement. Rejected at acceptance for guild pages.
- **Always own the layout** via a filtered `EntityContentLayoutBlueprint`. Full control, but the owner must hand-reproduce every stock card for that kind, and any Backstage improvement to the stock page stops arriving.
- **Choose per breadth.** Chosen.

## Decision Outcome

Chosen: **the type's breadth decides the mechanism.**

- **Narrow types own their layout.** `Group`/`spec.type: guild` and `Component`/`spec.type: practice` get a filtered `EntityContentLayoutBlueprint` that hand-composes the grid. The filter is what makes this safe — every other Group and Component falls through to the stock layout untouched. Worth it because these pages were thin, so reproducing them costs little and the composition carries real meaning.
- **Broad types get appended cards.** `Component` at large is every service and website in the catalog, and its stock overview is rich: about, links, subcomponents, depends-on, APIs, graph. Owning it would mean copying all of it, freezing it against upstream improvement, and making adopters diverge from their neighbours over concerns unrelated to adoption. Instead, `EntityCardBlueprint` with `type: 'info'` — the stock `DefaultEntityContentLayout` partitions cards into an info rail and a content column, so declaring `info` buys deliberate placement without owning the page.

Both mechanisms take a **predicate filter**, which is the only thing keeping these surfaces off unrelated entities and is therefore tested directly rather than only through a rendered app.

Two rules follow:

- **Complementary filters over internal branching.** The enrolled and unenrolled component cards are two extensions with opposite predicates, not one card branching on state. The call to action is then disabled through Backstage's native `app.extensions` surface with no custom config schema, and never mounts rather than mounting to render nothing.
- **No data lives outside annotations.** Every card reads the same annotations the model already defined. Where a card cannot answer honestly it says so — an aspect with no practice reads *enrolled* with no verdict rather than a guess, and the tier badge reserves its grid cell while trial evaluation stays unbuilt.

### Consequences

- Good: one relationship is now visible from both ends — the practice's Adopters card and the component's Aspects card read the same edge in opposite directions, computed rather than maintained.
- Good: broad-type pages keep inheriting upstream Backstage work, because we never took ownership of them.
- Cost: two mechanisms to know. The breadth test is the guide — if reproducing the stock page by hand would be a chore, that is the signal to append instead.
- Currency comparison is **equality, not ordering**: a component reads *behind* but never by how far, because module release tags carry no committed ordering scheme.
- MUI v4 traps worth knowing before writing another card: `Button`/`clickable Chip` stamp `role="button"` on the anchors they render, and `core-components`' `Link` appends a hidden ", Opens in a new window" to external ones. Both change how a card is queried in tests.

See ADR [0011](0011-instance-as-system-of-cornerstones.md), and the design docs `2026-07-27-gildi-guild-page-layout-design.md`, `2026-08-01-gildi-practice-page-and-type-themes-design.md` and `2026-08-06-gildi-component-adoption-card-design.md` for each slice.
