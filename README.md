# Leiðangr (Backstage)

The Backstage control-plane for the Leiðangr community-coordination stack. This is the Phase 2 **skeleton**: a fresh, modern Backstage instance with a strong local DevEx envelope. It runs entirely on your machine — with **zero secrets** by default — and can optionally pull a real secret from OpenBao to authenticate a Gitea-backed software catalog.

> `leidangr` is a working codename for this component; it may be renamed later.

## What's here

- A modern Backstage app (new frontend + backend systems, Yarn 4 via Corepack).
- A thin **DevEx envelope** — one `make` command per workflow.
- Two run modes: **stub** (no secrets, the default) and **Gitea** (catalog sourced from an in-cluster Gitea repo, authenticated by a token fetched from OpenBao).
- Tests: TDD'd envelope tooling + BDD acceptance specs (jest-cucumber).
- Architecture decisions in [`docs/adrs/`](docs/adrs/).

## Prerequisites

- **Node** Active LTS — 22 or 24 (see `.nvmrc`). Corepack ships with Node, so you do **not** need a global Yarn install; the `make` targets run Yarn through Corepack.
- **GNU Make** (the command entry points).
- *(Gitea mode only)* `kubectl` with access to the cluster running OpenBao/Keycloak/Gitea, and the **`bao`** CLI — see [`docs/development/openbao-setup.md`](docs/development/openbao-setup.md).
- *(Optional)* Docker, only if you want the prod-like Postgres instead of the default in-memory SQLite.

Run `make doctor` to check your toolchain.

## Quickstart (stub mode — zero secrets)

```sh
make deps     # install dependencies (Corepack-managed Yarn)
make dev      # start Backstage
```

Open http://localhost:3000. You're signed in as a guest and the example catalog is populated. No secrets, no cluster, no network required.

## Run modes

| Mode | Command | What it is |
|---|---|---|
| **Stub** (default) | `make dev` | SQLite, guest auth, generated example catalog. Offline, zero secrets — the CI/contributor path. |
| **Gitea** | `make secrets` then `make dev-gitea` | Fetches a Gitea token from OpenBao (browser OIDC login via Keycloak) into a gitignored `.env.local`, then loads the Gitea catalog overlay so the catalog is sourced from a real Gitea repo. |
| **Deployed** | — | Future: in-cluster via External-Secrets-projected secrets. Out of scope for the skeleton. |

Gitea mode needs one-time setup (unseal OpenBao, seed the repo + KV) — see [`docs/development/openbao-setup.md`](docs/development/openbao-setup.md).

### Secrets

Secrets are **never** committed and **never** hand-edited into config. `make secrets` is the only supported path: it logs you into OpenBao via your browser and renders a gitignored `.env.local`. The app reads only `${ENV}` references, so it never knows (or cares) which OpenBao — local or remote — the secret came from. Non-secret personal overrides go in `app-config.local.yaml` (copy from the `.example`).

## Commands

| Command | Does |
|---|---|
| `make doctor` | Check Node, Corepack, `bao`, dev ports (never prints secret values) |
| `make deps` | Install dependencies |
| `make dev` | Start Backstage in stub mode |
| `make dev-gitea` | Start with the Gitea catalog overlay (after `make secrets`) |
| `make secrets` | Render `.env.local` from OpenBao (browser OIDC) |
| `make test` | Envelope tooling + BDD acceptance tests |
| `make test-app` | The generated app/backend unit tests |
| `make lint` | Lint the app workspaces |
| `make config-check` | Validate `app-config.yaml` |
| `make ci` | `config-check` + `lint` + `test` |

## Testing

`make test` runs the **envelope** suite — the TDD'd tooling (`scripts/lib/*.ts`) and the BDD acceptance specs (`tests/acceptance/*.feature`, via jest-cucumber). It's a separate jest config from Backstage's own tests (`make test-app`). See [`docs/development/testing.md`](docs/development/testing.md) for how the two stacks fit together and how to add a test.

## Layout

```text
Makefile               # DevEx entry points
app-config.yaml        # base = zero-secret stub config
app-config.gitea.yaml  # Gitea catalog overlay (Gitea mode only)
packages/app           # frontend
packages/backend       # backend
scripts/               # envelope tooling (doctor, dev-secrets) + lib tests
tests/acceptance/      # BDD feature files + step definitions
docs/adrs/             # architecture decision records (MADR)
docs/development/      # setup + testing guides
```

## Using it in the GDD workspace (optional)

Inside the Yggdrasil/GDD workspace, `ws test leidangr` and `ws lint leidangr` run the same suites (allowlisted). Nothing here *depends* on the workspace, though — every command above works from a plain clone of this repo.
