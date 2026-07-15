# The Security Practice

Welcome to the Security practice's **aspect** — the module holding everything the practice applies, in one repo with one steward (the Security guild). The practice is the living institution; this repo is its current material expression.

- **The standard** — [`standard.yaml`](https://github.com/SiliconSaga/leidangr/blob/main/examples/mock-org/repos/security-aspect/standard.yaml): the checks, grouped in **blocks** by tool/sub-concern (each block carries facet applicability — what kind of component it applies to), tiered bronze/silver/gold across them. Every check links its remediation page here.
- **The paved road** — [`pipeline-templates/`](https://github.com/SiliconSaga/leidangr/blob/main/examples/mock-org/repos/security-aspect/pipeline-templates/dependency-scan.yml): adopt with a one-line include and the matching check satisfies itself.
- **The grafts** — how the aspect gets applied: `template.yaml` (the portal door — a scaffolder Template on the Create page) and `SKILL.md` (the agent door, for practitioners who never leave their CLI). Both read this same module.
- **Remediation guides** — one per check (see the nav): each failing check on your scorecard links straight to the fix.
- **Runbooks** — operational vísar followed under pressure. *Interim note:* these render here as a docs subsection until the dedicated runbooks plugin (parameterized placeholders filled via URL) exists; the top-level `/runbooks` convention returns with it.

Questions → `#security-gildi`. If your service isn't enrolled yet, run the graft — or add `security` to its `siliconsaga.org/aspects` annotation by hand and start at bronze.
