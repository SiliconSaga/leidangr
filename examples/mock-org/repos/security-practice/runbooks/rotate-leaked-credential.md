# Runbook: rotate a leaked credential

<!-- Operational vísir (design §3.5): a parameterized template, not a static
page. Placeholders are filled at read time by the future runbooks plugin,
e.g. ?service=carrier-gateway&secret_path=shipping/carrier-api-key — so every
command below copy-pastes exactly right for the incident at hand. -->

**When:** secret scanning flags a credential in `{{service}}`'s history, or one is reported leaked.

1. Revoke the credential at its source immediately — before cleanup, before comms.
2. Issue the replacement and store it:

   ```
   bao kv put secret/{{secret_path}} value=<new-credential>
   ```

3. Restart the consuming workload so it picks up the new value:

   ```
   kubectl --context {{cluster}} -n {{namespace}} rollout restart deploy/{{service}}
   ```

4. Verify the old credential is dead (a request using it must fail), then note the incident in `#security-gildi`.
5. If the leak was in Git history: the scrub procedure is a separate escalation — page the security gildi steward rather than improvising it.
