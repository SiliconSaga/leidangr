---
name: apply-security-aspect
description: Agent-side graft for the Security aspect — enroll a target component, adopt the paved road, scaffold stewardship stubs, and pre-flight the trials before opening the CR. The portal-side door is this repo's template.yaml; both read the same module.
---

# Apply the Security aspect (agent graft)

You are grafting this aspect onto a target component. Same steps as the scaffolder template — you are the other front door (design §3.7: some users never leave their CLI, and neither do you).

1. **Read the module.** `standard.yaml` in this repo is the source of truth: blocks, facet applicability, trials, tier ladder. Determine which blocks apply to the target (its `spec.type` sets default facets — service→api, website→web-ui; a `siliconsaga.org/facets` annotation overrides).
2. **Enroll.** In the target's `catalog-info.yaml`, add `security` to the `siliconsaga.org/aspects` annotation (create it if absent). Add a `siliconsaga.org/facets` annotation only if the type defaults are wrong.
3. **Adopt the paved road.** Add the applicable pipeline includes from `pipeline-templates/` (dependency-scan for dependency-hygiene, sast-scan for static-analysis) to the target's CI config.
4. **Scaffold stewardship.** Add the `siliconsaga.org/security-contact` annotation (ask the owning team, do not guess) and a `threat-models/` stub if gold is in scope.
5. **Pre-flight the trials.** Before opening the CR, evaluate what you can locally: does the pipeline config actually include the templates? Does secret scanning pass on the working tree? This is the shift-left pass — the central scorecard will agree with you later.
6. **Open the CR** with a body that names the aspect, the blocks applied, and the tier the component should reach once CI runs. Link the remediation vísar for anything you could not satisfy.

Never weaken the standard to make a trial pass — if a trial is wrong for this target, that is a facet/applicability conversation with the steward gildi (`#security-gildi`), recorded in the aspect repo, not a silent skip.
