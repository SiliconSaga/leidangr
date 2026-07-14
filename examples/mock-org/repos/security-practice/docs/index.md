# The Security Practice

Welcome to the Security practice's home. Everything the practice holds lives in this one repo, with one steward (the Security guild):

- **The standard** — [`standard.yaml`](https://github.com/SiliconSaga/leidangr/blob/main/examples/mock-org/repos/security-practice/standard.yaml): the checks, in tiers (bronze/silver/gold), each linking its remediation page here.
- **The paved road** — [`pipeline-templates/dependency-scan.yml`](https://github.com/SiliconSaga/leidangr/blob/main/examples/mock-org/repos/security-practice/pipeline-templates/dependency-scan.yml): adopt it with a one-line include, and the dependency-scanning check satisfies itself.
- **Remediation guides** — one per check (see the nav): each failing check on your scorecard links straight to the fix.
- **Runbooks** — operational vísar followed under pressure. *Interim note:* these render here as a docs subsection until the dedicated runbooks plugin (parameterized placeholders filled via URL) exists; the top-level `/runbooks` convention returns with it.

Questions → `#security-gildi`. If your service isn't enrolled yet, add `security` to its `siliconsaga.org/aspects` annotation and start at bronze.
