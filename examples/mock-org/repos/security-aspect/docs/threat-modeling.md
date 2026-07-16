# Threat modeling — how to satisfy the trial

*Teaching vísir (static, docs-homed). Remediation target of the `threat-model-current` trial.*

The gold-tier bar: a threat model on file in this aspect repo (`threat-models/<component>.md`), reviewed within the last year.

**The review-date contract** (what the trial's checker reads): each threat-model file carries YAML front matter with `last_reviewed: YYYY-MM-DD`. The trial passes when that date is within 365 days — nothing else counts, not commit dates, not prose.

```yaml
---
component: component:default/tracking-api
last_reviewed: 2026-04-12
---
```

1. Book a one-hour session with a security gildi member (`#security-gildi`) — the gildi facilitates, your team brings the system knowledge.
2. Work the four questions: what are we building, what can go wrong, what are we doing about it, did we do enough?
3. Commit the result to `threat-models/` with the front matter above, and link it from your component's docs.
4. Reviews are yearly and lightweight — a diff of what changed, not a redo. Bump `last_reviewed` when the review happens; that is the act the trial observes.
