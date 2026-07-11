# tracking-api on-call primer

*Teaching vísir (static, docs-homed): read before your first rotation — this explains the system; the runbooks next door are what you follow at 3am.*

tracking-api ingests carrier webhook events onto the `parcel-events` queue and serves tracking queries. The two things that actually page: **queue backlog** (consumer lag — see `../runbooks/queue-backlog.md`) and **carrier webhook auth failures** (usually a carrier rotated a signing key). Dashboards live on the component's Backstage page; the lag alert pages at 20 minutes of sustained growth (tightened after the May 2026 incident — see the 2026.2 Saga).
