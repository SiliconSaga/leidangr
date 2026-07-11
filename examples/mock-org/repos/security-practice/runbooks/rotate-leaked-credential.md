# Runbook: rotate a leaked credential

<!-- Operational vísir (design §3.5): a parameterized template, not a static
page. Placeholders are filled at read time by the future runbooks plugin,
e.g. ?service=carrier-gateway&secret_path=shipping/carrier-api-key — so every
command below copy-pastes exactly right for the incident at hand.
Plugin requirement (design §8): placeholder values come from URLs, so the
renderer MUST allowlist-validate and shell-escape them before interpolation —
a crafted link must not be able to turn a copied command into an injection. -->

**When:** secret scanning flags a credential in `{{service}}`'s history, or one is reported leaked.

1. Revoke the credential at its source immediately — before cleanup, before comms.
2. Issue the replacement and store it — via stdin, so the new secret never lands in shell history or the process list:

   ```bash
   read -rs NEW_CREDENTIAL
   [ -n "$NEW_CREDENTIAL" ] || { echo "empty input — aborting, nothing stored"; unset NEW_CREDENTIAL; exit 1; }
   printf %s "$NEW_CREDENTIAL" | bao kv put secret/{{secret_path}} value=-
   unset NEW_CREDENTIAL
   ```

3. Restart the consuming workload so it picks up the new value:

   ```bash
   kubectl --context {{cluster}} -n {{namespace}} rollout restart deploy/{{service}}
   ```

4. Verify the old credential is dead (a request using it must fail), then note the incident in `#security-gildi`.
5. If the leak was in Git history: the scrub procedure is a separate escalation — page the security gildi steward rather than improvising it.
