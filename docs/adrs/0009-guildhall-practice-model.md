# Guildhall: the practice model — aspects hold standards, guilds are people, no new kinds

- Status: accepted
- Date: 2026-07-11
- Deciders: Cervator, Claude (Fable 5)

## Context and Problem Statement

Spotify's premium **Skill Exchange** (skills on user profiles, opportunity marketplace) and **Soundcheck** (facts → checks → levels → tracks, bronze/silver/gold) ship as unconnected products, and "practice" — the concept that would unify them — reads as a verb half the time. We need one model covering skills, staffing bundles, communities of practice, maturity measurement, and procedure docs, for both the community domain and software, without inventing catalog machinery.

## Considered Options

- Two independent systems (skills marketplace + maturity engine), linked by convention — the Spotify shape.
- A practice-as-hub model where one "guild" concept owns people, processes, and measurement.
- The hub model **split by role**: fellowship vs. cross-cutting concern as distinct concepts.

## Decision Outcome

Chosen: the split hub model, named the **Guildhall** (norse kenning skin *Gildaskáli*; "practice layer" was rejected for its verb reading). Concepts: **Skill** (unowned shared vocabulary on people, have/learning axis) · **Craft** (demand-side skill bundle a muster calls for) · **Gildi** (the fellowship — purely people, craft- or aspect-aligned) · **Aspect** (the cross-cutting concern, AOP sense — it **holds the Standards** and ships both the bar and the paved road to clear it) · **Standard → Trials** (tiered checks; every trial declares a remediation **vísir**) · **Vísir** (procedure doc; teaching grade in `/docs`, operational parameterized grade in `/runbooks`). The split that carries the model: *crafts are what people do; aspects are what things must uphold.*

Mapping introduces **no new custom kinds**: gildi = `Group` with `spec.type: guild`; skills/crafts/aspects = vocabularies; standards = Git-backed YAML for the future scorecard plugin (Tech Insights evaluated first); vísar = annotation-referenced Git markdown; enrollment = `siliconsaga.org/aspects` annotation. A **kennings layer** maps canonical technical terms to per-instance display lexicons (norse/plain/custom — e.g. corporate "Practice Hub"), which keeps parent-facing surfaces on plain language by construction.

### Consequences

- Good: the Ravenline seed (`examples/mock-org/`) ingests with zero new code — the no-new-kinds claim is demonstrated, and the vocabulary/standard files are frozen fixtures for Phase 6.
- Trial evaluation, skill profiles, scorecards, and the runbooks plugin are **not built** — this ADR fixes vocabulary and shapes only.
- Open items live in the design doc §8: aspect kenning skin (*þáttr* rejected — Danish false-friend), vísir grade term split, tier ordering, runbooks-plugin parameter safety.

See the design: [`../plans/2026-07-10-guilds-skills-standards-design.md`](../plans/2026-07-10-guilds-skills-standards-design.md), and ADRs [0007](0007-cycle-custom-kind.md)/[0008](0008-saga-git-backed-kind.md) for the kinds it builds on.
