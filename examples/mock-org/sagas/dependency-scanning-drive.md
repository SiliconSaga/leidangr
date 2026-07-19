# The Saga of the Dependency Scanning Drive

*Skald: Astrid · May 2026 – (mid-run report, written mid-July)*

The guild shipped module 1.4 in April: a refreshed dependency-scan pipeline template and the 30-day clock on critical findings. The drive opened May 1 with one goal — every enrolled service green on the `dependency-scanning` trial before August — and one rule: nobody gets a ticket telling them to "improve security"; they get a one-line include and a doc that fits on a screen.

`shipping-orchestrator` went first. Sigrid's team ran the graft from the Create page, the PR was a one-line pipeline include plus stewardship stubs, merged in a day; the next pipeline run reported facts and the trial went green. That is the whole pitch, and it happened in week three.

Then Foxholm arrived. The acquisition onboarding could have meant a second security review culture; instead Dagny joined the guild, ran the same graft against `refund-service`, and had it green in two pipeline runs — same standard, same remediation docs, not a single new document written. `intake-scanner` is the holdout: its build image predates the acquisition and the include won't run there, so the graft needs an image bump first. Dagny has it scoped.

`carrier-gateway` remains the oldest debt: enrolled back in the 1.2 days when pipeline config was hand-rolled, and it shows. Sigrid's include-line change has been queued since June — the drive closes when it merges and the run goes green.

**Tally at mid-July: three of five enrolled services green, two to go, twelve days left.** What worked: the paved road sells itself when the fix is smaller than the excuse. What to fix next drive: enrollments that predate the paved road need a migration pass, not reminders — and `label-service` is still unenrolled, a candidate for whoever wants to see the graft run fresh.
