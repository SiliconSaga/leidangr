# Dependency Scanning — how to satisfy the trial

*Teaching vísir (static, docs-homed). Remediation target of the `dependency-scanning` trial.*

Add the paved-road template to your pipeline:

```yaml
include:
  - project: ravenline/security-aspect
    file: pipeline-templates/dependency-scan.yml
```

That is the entire change. The template runs on your default branch, reports results to the practice's collector, and the trial flips green on your next pipeline run — no ticket, no review meeting.

If the scan finds something: criticals fail the pipeline immediately; anything else appears on your component's scorecard with a 30-day clock (the `no-critical-vulns-30d` trial at silver). Questions → `#security-gildi`.
