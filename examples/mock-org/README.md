# Mock Org: Ravenline — the Guildhall Running Example

Ravenline is a fictional small parcel-logistics SaaS (~20 people) used as the running example for the Guildhall design (`docs/plans/2026-07-10-guilds-skills-standards-design.md`). It exists to demo the model end to end and to test future Guildhall features against. Everything here uses **built-in kinds plus the shipped `Cycle`/`Saga`** — the design introduces no new custom kinds, and this seed is the proof.

## The cast

- **Org tree** (`org.yaml`): `ravenline` (organization) → two departments: `rl-engineering` (→ `team-tracking`, `team-shipping`, `team-platform`, `team-devex`) and `foxholm` (→ `team-returns`) — the returns-logistics line acquired in 2026, there to make practice reuse across an org boundary concrete. Eight users spread across them; Dagny of Foxholm sits in the security gildi, so the guild spans departments.
- **Two gildi** (`org.yaml`), one of each form from the design:
  - `security-gildi` — **aspect-aligned** (stewards the `security` aspect). Members: Astrid, Leif, and Foxholm's Dagny (cross-department).
  - `release-captains-gildi` — **craft-aligned** (stewards the `release-captain` craft). Members: Bjorn, Runa.
- **Software graph** (`software.yaml` + per-repo catalog-info): systems `parcel-tracking`, `shipping`, and Foxholm's `returns-logistics`; components `tracking-web`, `shipping-orchestrator`, `carrier-gateway`, `label-service` (pristine and unenrolled — **the graft's demo target**), `refund-service`, `intake-scanner`, and the `prod-cluster` Resource. Two components live where real ones would: `tracking-api` and `security-practice` are declared in **their own repos' `catalog-info.yaml`** (`repos/tracking-api/`, `repos/security-aspect/`) — the live topology, registered directly here in place of provider discovery.
- **The practice and its aspect**: `security-practice` (`spec.type: practice`) is the *institution's* catalog face; `repos/security-aspect/` is its **aspect — the module**: the blocked standard, the paved road, the remediation vísar, and **two grafts** — `template.yaml` (scaffolder door, visible on the Create page) and `SKILL.md` (agent door). Entity links tie it all together one click from the catalog.
- **The instance itself** (root `catalog-info.yaml` — moved there so its TechDocs `dir:.` resolves): `guild-hall`, type `hub`, owned by `team-devex` — the one **non-fiction** entity in the seed: it is this very Backstage instance, and its vísir is the demo/onboarding grand tour (`docs/demo-visir.md` — start there).
- **Cycles + Sagas** (`cycles.yaml`): a `release` Cycle (`tracking-2026-2`), a `drive` Cycle (`dependency-scanning-drive` — the Soundcheck-Campaign analog), and two Sagas — Runa's release retrospective (`sagas/tracking-2026-2.md`) and Astrid's **mid-run drive report** (`sagas/dependency-scanning-drive.md`), a Saga narrated while its Cycle is still open.

## The story the data tells

`tracking-api` is enrolled in both aspects (`siliconsaga.org/aspects` annotation) and sits at **silver** on the security standard. `carrier-gateway` is enrolled in security only and is stuck at **bronze** with the `dependency-scanning` trial failing — its remediation doc says, in full: *add the one-line include of the paved-road pipeline template.* That is the paved-road loop from design §3.4, frozen as demo data. Meanwhile the `dependency-scanning-drive` Cycle is the security gildi's time-bound push to get every service's scanning green, and the release Saga cites how the release went.

**The update loop (why the drive exists):** the aspect registry (`guildhall/aspects.yaml`) pins the security module at **1.4**; each enrolled component records what it actually adopted in `siliconsaga.org/aspect-versions`, and past grafts keep their PR in `siliconsaga.org/graft-record` (both inert — shapes tentative until the scorecard engine consumes them; `.example` hosts mark the PR links as fiction). The gap between the registry version and a component's adopted version is what a drive closes: `shipping-orchestrator` (grafted May, 1.4, green), `refund-service` (grafted during Foxholm onboarding, 1.4, green — the reuse beat: same standard, same guild, zero new documents), `intake-scanner` (1.3, bronze — legacy build image), `carrier-gateway` (1.2, pre-paved-road, the oldest debt). Astrid's mid-run Saga narrates exactly this tally; `label-service` stays untouched as the live-graft target.

## Guildhall files (mostly not catalog entities — future plugin input)

The `guildhall/` tree and most of `repos/` are **plain YAML/markdown, deliberately not ingested** — fixtures documenting the exact shapes design §5 assigns to vocabularies and Git-backed standards. Three per-repo files ARE intentionally ingested (registered in `app-config.yaml`, standing in for provider discovery): `repos/tracking-api/catalog-info.yaml`, `repos/security-aspect/catalog-info.yaml`, and `repos/security-aspect/template.yaml` (the graft — vanilla `Template` kind). Paths inside the fixtures are file-relative:

- `guildhall/skills.yaml` — the skill vocabulary + mock profile selections (in the real system, profiles live in the plugin store and decorate `User` entities).
- `guildhall/crafts.yaml` — `release-captain` (skills + a teaching vísir) and `incident-commander` (skills only — vísar are optional).
- `guildhall/aspects.yaml` — the **registry** (aspect id → `module`): `security` (steward gildi + module + standard) and `operational-readiness` (**no steward** — an aspect can exist before a gildi forms around its practice).
- `guildhall/standards/release-readiness.yaml` — a standard that measures **Cycles**, the software twin of the community "season-readiness" checklist.
- `repos/security-aspect/` — the **aspect repo (the module)**: the security standard (**blocks** of trials by tool/sub-concern with **facet** applicability, tiers laddering across them), the paved road (`pipeline-templates/`), the two grafts (`template.yaml`, `SKILL.md`), teaching vísar (`docs/`), and a parameterized operational vísir (`docs/runbooks/`). Its `catalog-info.yaml` declares the practice Component.
- `repos/tracking-api/` — a product repo as a real one would look: own `catalog-info.yaml` (enrollment + a `facets` override — it's a service *and* a queue consumer, the monolith case), mkdocs, a static on-call primer, a parameterized queue-backlog runbook.

**TechDocs, fully local:** both repos carry `mkdocs.yml` and their Components carry `backstage.io/techdocs-ref: dir:…` — TechDocs renders them with **no Git provider involved** (dir refs resolve relative to this file-based seed). Generation needs either Docker running (the scaffold default) or `techdocs.generator.runIn: local` + `pip install mkdocs-techdocs-core`. *Interim convention:* operational vísar sit at `docs/runbooks/` so TechDocs renders them today; the design's top-level `/runbooks` home returns when the dedicated runbooks plugin (URL-parameterized rendering) exists.

## What ingests, what waits

| Ingests today (catalog) | Waits for plugins |
|---|---|
| Org tree, gildi Groups (`spec.type: gildi`), Users | Skill profiles decorating Users |
| Software graph, enrollment + vísir annotations (inert but present) | Standards evaluation / scorecards (Tech Insights or custom) |
| `Cycle` (release + drive) and `Saga` with relations | Runbooks plugin (parameterized vísar) |

Until the scorecard engine exists, the **practice → aspect → standard → trials tie is navigational**: the `security-practice` Component's and `security-gildi` Group's entity links jump straight into the aspect repo — standard, paved road, grafts, remediation docs. The scorecard plugin later turns that chain into live data on entity pages. The graft Template renders on the **Create page** today (it logs its weave plan rather than opening a real PR — designed-not-executed, like the ratings).

`make smoke-catalog` asserts the mock org ingests at runtime alongside the MTL seed (gildi Group typed, release Cycle with its relations, the Saga touching it).
