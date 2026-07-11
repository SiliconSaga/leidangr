# Runbook: parcel-events queue backlog

<!-- Operational vísir (design §3.5): parameterized — placeholders filled at
read time, e.g. ?cluster=prod-eu&namespace=tracking. Born from the May 2026
incident where these commands lived in one engineer's head. -->

**When:** consumer lag on `parcel-events` alerts (sustained growth ≥ 20 min).

1. Confirm it's consumption, not a poison message — check the consumer error rate:

   ```
   kubectl --context {{cluster}} -n {{namespace}} logs deploy/tracking-consumer --since=10m
   ```

   Repeating crash on one offset → poison message: skip to step 4.

2. Scale out the consumers:

   ```
   kubectl --context {{cluster}} -n {{namespace}} scale deploy/tracking-consumer --replicas=6
   ```

3. Watch lag drain; scale back to 2 replicas once under 1 minute.
4. Poison message: park it to the dead-letter topic and file the bug — do not delete it.
5. Note the event in the release Cycle's channel; if customer-visible, the incident-commander craft call goes out.
