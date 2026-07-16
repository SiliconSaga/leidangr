# Runbook: parcel-events queue backlog

<!-- Operational vísir (design §3.5): parameterized template. The {{cluster}}
and {{namespace}} placeholders WILL be filled at read time (e.g.
?cluster=prod-eu&namespace=tracking) by the future runbooks plugin — until it
exists, TechDocs renders them literally: substitute your values by hand. Born
from the May 2026 incident where these commands lived in one engineer's head. -->

**When:** consumer lag on `parcel-events` alerts (sustained growth ≥ 20 min).

1. Confirm it's consumption, not a poison message — check the consumer error rate:

   ```bash
   kubectl --context {{cluster}} -n {{namespace}} logs deploy/tracking-consumer --since=10m
   ```

   Repeating crash on one offset → poison message: skip to step 4.

2. Capture the current scale before touching it, then scale out:

   ```bash
   kubectl --context {{cluster}} -n {{namespace}} get deploy tracking-consumer -o jsonpath='{.spec.replicas}'
   kubectl --context {{cluster}} -n {{namespace}} scale deploy/tracking-consumer --replicas=6
   ```

3. Watch lag drain; once under 1 minute, restore the replica count you captured in step 2. If the deployment is HPA-managed, hand control back to the HPA instead of setting a number.
4. Poison message: park it to the dead-letter topic and file the bug — do not delete it.
5. Note the event in the release Cycle's channel; if customer-visible, the incident-commander craft call goes out.
