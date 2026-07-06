# Architecture Decision Records

Decisions for the Leiðangr Backstage component, in [MADR v3](https://adr.github.io/madr/) format.

These are written as files from the first decision. The Backstage ADR plugin
(`@backstage-community/plugin-adr`) is **deferred**: as of mid-2026 it reads ADRs
only through the GitHub integration (GitLab is an open RFC; Gitea is unsupported),
and this skeleton's catalog source is Gitea. Once the component has a GitHub-readable
source, the plugin can surface these on the entity page via a `backstage.io/adr-location`
annotation. Until then they live here as plain Markdown.

| ADR | Decision |
|-----|----------|
| [0001](0001-modern-backstage-and-corepack.md) | Modern Backstage systems + Corepack toolchain |
| [0002](0002-zero-secret-stub-mode-default.md) | Zero-secret stub mode is the default |
| [0003](0003-provider-agnostic-secrets-openbao-oidc.md) | Provider-agnostic secrets via dev-secrets (OpenBao OIDC) |
| [0004](0004-gitea-catalog-source.md) | Gitea as the catalog source (overlay; GitHub deferred) |
| [0005](0005-guest-auth-first.md) | Guest auth first; Keycloak sign-in deferred |
| [0006](0006-bdd-from-day-one.md) | BDD from day one over TDD'd tooling |
| [0007](0007-cycle-custom-kind.md) | Cycle: a custom catalog kind for bounded groupings |
