# Aspect is a module, practices are institutions; adoption has two doors; standards block by facet

- Status: accepted
- Date: 2026-07-14
- Deciders: Cervator, Claude (Fable 5)

## Context and Problem Statement

ADR 0009's model left three seams, surfaced by using it: "practice" and "aspect" were near-synonyms (which confused even the designers); aspects were inert — declared and measured against, but nothing ever *applied* them (AOP's soul is the weaver); and a real aspect wraps several tools (SonarQube-alikes, vuln scanners) not all appropriate for every component, with no layer to organize them.

## Considered Options

- Aspect as the abstract concern; practice as its synonym/display name (status quo).
- Practice as a formalized umbrella entity containing aspects (plural).
- **Aspect as a module** (AOP-strict), practice as the living institution around it; per-tool structure inside the standard.

## Decision Outcome

Chosen, third option. An **aspect is a module** — exactly as in AspectJ, where an aspect is a concrete artifact, not the abstract concern: a versioned repo holding the standard(s), the paved road, the adoption templates, and the remediation vísar. The **practice is the living institution** around it — people (the gildi is its embodiment: *the gildi runs the practice*), tradition, judgment. The aspect is the book; the practice is the author. One practice, one concern; possibly several **editions/variants** of the module. The three-part split: *crafts are what people do; aspects are what components adopt; standards are what they must then uphold.*

**Adoption** makes aspects applicable: applicators living inside the module, **two front doors reading the same source** — a typed scaffolder `Template` (`spec.type: aspect`, vanilla kind, renders on the Create page) for portal users, and a `SKILL.md` for CLI agents. Agents are first-class practitioners and can pre-flight trials locally before a CR exists. The enrollment annotation is the record of application; hand-enrollment stays legal.

**Standards organize on two orthogonal axes**: **blocks** (tool/sub-concern groups of trials, carrying **facet** applicability — `spec.type` suggests default facets, a `siliconsaga.org/facets` annotation overrides, solving the multi-natured monolith) and **tiers** (the maturity ladder referencing trials across blocks; non-applicable trials skip, never punish). This resolves the design's open ordered-vs-thematic question as "both, different axes," and is the day-job Grid/Block/Check lineage landing intact.

### Consequences

- Good: still **no new custom kinds** — the module is a repo, the practice's catalog face is a `type: practice` Component in the module's own `catalog-info.yaml` (live per-repo topology), and the adoption's portal door is the vanilla `Template` kind.
- Good: every artifact already named "practice" (the Component, its type) was institutional and stays; everything named "aspect" (enrollment annotation, standard's field) was module-ish and stays — the rule was latent in the naming.
- Ravenline demonstrates the whole ladder: `repos/security-aspect/` (blocked standard, two paved-road templates, both adoption doors), per-repo `catalog-info.yaml` for it and `tracking-api` (with a facets override — the monolith case), and pristine `label-service` as the adoption target.
- Adoption execution, trial evaluation, and facet resolution remain **designed, not implemented** — the mock Template logs its weave plan instead of opening PRs.

See ADR [0009](0009-guildhall-practice-model.md) and the design doc §3.1/§3.6/§3.7.
