# The Saga of Parcel Tracking 2026.2

*Skald: Runa · April–June 2026*

The 2026.2 release set out to ship webhook-based tracking events and retire the polling API. It shipped both, one week late, and the lateness taught us more than the shipping did.

Bjorn captained the release. The mid-cycle surprise was the queue backlog incident of May 14th: consumer lag on `parcel-events` hit four hours before anyone noticed, and the recovery was slowed by the fact that the scaling commands lived in Egil's head. The queue-backlog runbook in `tracking-api/runbooks/` exists because of that afternoon — the next person gets copy-paste commands, not archaeology.

The security silver certification held through the release: dependency scanning caught a vulnerable transitive dependency in week two, and the paved-road template meant the fix was a version bump, not a scramble. The `dependency-scanning-drive` was running in parallel — `carrier-gateway` is the last service still at bronze, and Sigrid has the include-line change queued.

**What worked:** the paved road; the release captain's guide (Bjorn onboarded Runa as co-captain mid-cycle with zero meetings). **What broke:** queue observability — the lag alert now pages at 20 minutes. **Next cycle:** retire the polling API's last two consumers, and get carrier-gateway to silver so the drive can close.
