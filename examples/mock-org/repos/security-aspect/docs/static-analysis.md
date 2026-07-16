# Static analysis — how to satisfy the trial

*Teaching vísir (static, docs-homed). Remediation target of the `sast-scan-clean` trial (static-analysis block).*

Add the paved-road SAST template to your pipeline:

```yaml
include:
  - project: ravenline/security-aspect
    ref: v2.0.0 # pin the module edition — aspects version (ADR 0010); never ride HEAD
    file: pipeline-templates/sast-scan.yml
```

The scan runs on your default branch and reports to the practice's collector. High findings appear on your scorecard; criticals fail the pipeline. The block applies to `api` and `web-ui` facets — batch-only components skip it automatically (no opt-out needed, no badge penalty).

Tuning suppressions or excluding generated code → `#security-gildi`, and put the decision in your repo's docs, not in a comment nobody will find.
