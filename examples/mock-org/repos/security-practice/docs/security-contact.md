# Declare a security contact — how to satisfy the trial

*Teaching vísir (static, docs-homed). Remediation target of the `security-contact-declared` trial.*

Add the contact annotation to your component's `catalog-info.yaml`:

```yaml
metadata:
  annotations:
    siliconsaga.org/security-contact: group:default/team-shipping # or a User ref
```

Point it at whoever should hear about findings first — usually the owning team, sometimes a named individual. The trial is designed to flip green on the next catalog refresh (evaluation ships with the future scorecard plugin — see the mock-org README). If nobody obvious exists, ask in `#security-gildi`: naming a reluctant contact beats having none.
