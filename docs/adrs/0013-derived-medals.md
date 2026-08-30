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

An aspect offering two checks awards silver for one and gold for both. An aspect offering one check awards gold for passing it. A standard therefore declares only its blocks and trials; the ladder falls out of them, and `tiers:` disappears from the schema entirely.

Two edges are stated rather than left to a future evaluator. `A == 0` — nothing applies to this component — is `none`, not a vacuous gold: an aspect that asked nothing of you has not awarded you anything. And `P > A` clamps to gold rather than falling through, because a miscounting caller producing *silver* out of more passes than there are trials would read as a real verdict.

The rule lives in `plugins/gildi-common/src/medals.ts` rather than in prose here, because two standards now depend on it. It moved out of the `gildi` frontend plugin when the fact source arrived, since the backend that computes trial outcomes and the card that renders the medal both need it and neither should import the other.

### Consequences

- Good: no unreachable medals, at any standard size. Small aspects are complete rather than permanently bronze.
- Good: adding a trial is a modelling decision, not also a placement decision. It raises the bar for gold automatically, which is the honest outcome — see the drift section of the website-hygiene design.
- Cost: **every trial weighs the same.** That suits four tightly-scoped website checks and is arguable for security, where "no secrets in repo" and "threat model current" are not peers. Explicit weighting stays available as a later amendment; it is deliberately not built now, because no standard yet has enough trials for the difference to matter.
- `security-aspect/standard.yaml` drops its `tiers:` block. Its bronze/silver/gold narrative was demo prose, so nothing real is lost.

See ADR [0010](0010-aspect-module-adoption-blocks.md) for the two-axis model this amends, and `2026-08-11-website-hygiene-aspect-design.md` for the aspect that prompted it.
