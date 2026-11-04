# CI publishes an image, CD pulls its own secrets

- Status: accepted
- Date: 2026-11-03
- Deciders: Cervator, Claude (Opus 5)

## Context and Problem Statement

Leiðangr has had no pipeline: images were built on a workstation, and there was nowhere for a cluster to pull one from. Standing that up forces a decision that is costly to reverse, because the predecessor made the opposite one and it worked.

`CervTest/backstage-infra` deployed Backstage from a Jenkinsfile that held six credentials (`backstage-backend-secret`, `backstage-postgres-password`, `backstage-github-token`, two GitHub OAuth values, a plugin licence), `sed`-substituted them into `backstage-secrets.yaml`, `kubectl apply`-ed that with a cluster kubeconfig, and then `helm upgrade`-ed the release. Adding a secret was genuinely easy: paste it into Jenkins credentials, add one `sed` line. The ease is real and is the reason to write this down rather than assume the answer.

The cost is also real: that build server held every production secret and a write path into the cluster, the plaintext passed through a shell substitution on disk, and nothing but the Jenkins job knew what was deployed or from which commit.

This repo already decided where secrets come from (ADR 0003: `dev-secrets` → OpenBao for local; "the ESO-projected-Secret approach is the future *deployed* path"). What it had not decided is what the pipeline is allowed to hold, and who moves an image into a cluster.

## Considered Options

- **Push model** — the pipeline builds, holds the secrets, and applies to the cluster (the backstage-infra/Jenkins shape).
- **Pull model** — the pipeline builds and publishes only; the cluster reconciles the manifest and pulls its own secrets.
- **Split** — pipeline publishes the image, but still applies the Secret, since that is the awkward part.

## Decision Outcome

Chosen: the **pull model**, in two halves.

**CI (this change).** Two GitHub Actions workflows, following the SiliconSaga house pattern (ting, skipta, xenforo-k8s) rather than vordu's Jenkins + Google Artifact Registry, which is the outlier and is the component that *is* the Jenkins library:

- `ci.yml` runs `make ci` — the contributor's own gate, not a copy of it.
- `image.yml` builds `packages/backend/Dockerfile` and pushes `ghcr.io/siliconsaga/leidangr`, tagged by full commit sha plus `latest` on `main`.

Its only credential is the automatic `GITHUB_TOKEN`. GHCR over GAR specifically because of that: GAR needs a long-lived JSON key to exist somewhere.

**CD (next, not in this change).** ArgoCD already reconciles this platform, so delivery is a manifest change, not a pipeline step. A nidavellir Application deploys the image by sha; app-config arrives as a ConfigMap carrying a final `app-config.production.yaml` layer; secrets arrive as an ExternalSecret that the cluster resolves from OpenBao, never as values a pipeline knew.

What survives from backstage-infra, nearly unchanged, is the *config* shape: a ConfigMap holding an extra app-config layered last, with `${ENV}` references resolved at runtime from a secret-sourced environment. That worked, this repo already builds that way (AGENTS.md: "the app reads only `${ENV}` references"), and ADR 0002/0004's additive-overlay rule is the same idea. Only the secret *delivery* changes: ESO resolves the references the pipeline used to substitute.

The split option was rejected for being the worst of both — the pipeline keeps the kubeconfig and the plaintext, and gains a second place where deployment state lives.

### Consequences

- Good: a compromised build has no cluster credential and no application secret to leak; the blast radius is a published image.
- Good: the deployed sha is in git, so what runs is answerable without reading a build log.
- Good: adding a secret stays a one-line change — a key in OpenBao and a `data` entry in the ExternalSecret — but it is made where the secret already lives, by someone who can read it, rather than pasted into a build server.
- Bad: **the easy part got slower.** A new secret now needs OpenBao reachable and a policy that permits it; in the Jenkins shape it needed a browser and a text box. That is the price being paid deliberately, and it is only acceptable because the OpenBao path is already built and verified (ADR 0003, as-built).
- Bad: a rebuild of an unchanged commit produces a new image for the same sha tag. `type=sha,format=long` plus the weekly base-image rebuild means the tag tracks source, not bytes. Acceptable for a platform with one deployer; not a supply-chain guarantee.
- Deferred: pinning action `uses:` to commit SHAs. It is the stronger supply-chain position — a movable tag can be repointed, as `tj-actions/changed-files` demonstrated — but pinning one repo while ting, skipta, xenforo-k8s and mimir stay on tags buys little and creates two patterns. If adopted it should be adopted platform-wide, with Dependabot keeping the pins fresh, since a pin nobody updates is a security fix nobody gets.
- Deferred: image signing/attestation, arm64 (`isolated-vm` and `better-sqlite3` compile from source, so emulated builds cost more than a currently-nonexistent arm64 node is worth), and `make smoke-catalog` as a gate — it is the right end-to-end check but currently flakes on a `DevDataStore.load` IPC timeout, and a gate that fails half the time teaches people to ignore gates.
