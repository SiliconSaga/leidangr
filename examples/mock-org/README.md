# Mock Org: Ravenline — the Guildhall Running Example

Ravenline is a fictional small parcel-logistics SaaS (~20 people) used as the running example for the Guildhall design (`docs/plans/2026-07-10-guilds-skills-standards-design.md`). It exists to demo the model end to end and to test future Guildhall features against. Everything here uses **built-in kinds plus the shipped `Cycle`/`Saga`** — the design introduces no new custom kinds, and this seed is the proof.

## The cast

- **Org tree** (`org.yaml`): `ravenline` (organization) → `rl-engineering` (department) → `team-tracking`, `team-shipping`, `team-platform`. Six users spread across them.
- **Two gildi** (`org.yaml`), one of each form from the design:
  - `security-gildi` — **aspect-aligned** (stewards the `security` aspect). Members: Astrid, Leif.
  - `release-captains-gildi` — **craft-aligned** (stewards the `release-captain` craft). Members: Bjorn, Runa.
- **Software graph** (`software.yaml`): systems `parcel-tracking` and `shipping`, components `tracking-api`, `tracking-web`, `shipping-orchestrator`, `carrier-gateway`, the `prod-cluster` Resource, and `security-practice-home` — the practice home repo modeled as a Component owned by the security gildi.
- **Cycles + Saga** (`cycles.yaml`): a `release` Cycle (`tracking-2026-2`), a `drive` Cycle (`dependency-scanning-drive` — the Soundcheck-Campaign analog), and a Saga narrated by Runa about the release (`sagas/tracking-2026-2.md`).

## The story the data tells

`tracking-api` is enrolled in both aspects (`siliconsaga.org/aspects` annotation) and sits at **silver** on the security standard. `carrier-gateway` is enrolled in security only and is stuck at **bronze** with the `dependency-scanning` trial failing — its remediation doc says, in full: *add the one-line include of the paved-road pipeline template.* That is the paved-road loop from design §3.4, frozen as demo data. Meanwhile the `dependency-scanning-drive` Cycle is the security gildi's time-bound push to get every service's scanning green, and the release Saga cites how the release went.

## Guildhall files (not catalog entities — future plugin input)

The `guildhall/` and `repos/` trees are **plain YAML/markdown, deliberately not ingested**. They document the exact shapes design §5 assigns to vocabularies and Git-backed standards, so future plugins have fixtures waiting (paths inside them are file-relative):

- `guildhall/skills.yaml` — the skill vocabulary + mock profile selections (in the real system, profiles live in the plugin store and decorate `User` entities).
- `guildhall/crafts.yaml` — `release-captain` (skills + a teaching vísir) and `incident-commander` (skills only — vísar are optional).
- `guildhall/aspects.yaml` — `security` (steward gildi + home repo + standard) and `operational-readiness` (**no steward** — an aspect can exist before a gildi forms around it).
- `guildhall/standards/release-readiness.yaml` — a standard that measures **Cycles**, the software twin of the community "season-readiness" checklist.
- `repos/security-practice/` — the **practice home repo**: the security standard (tiered trials, each with its own remediation ref), the paved road (`pipeline-templates/dependency-scan.yml`), teaching vísar (`docs/`), and a parameterized operational vísir (`runbooks/`).
- `repos/tracking-api/` — a product repo showing the `/docs` + `/runbooks` convention: a static on-call primer and a parameterized queue-backlog runbook.

## What ingests, what waits

| Ingests today (catalog) | Waits for plugins |
|---|---|
| Org tree, gildi Groups (`spec.type: gildi`), Users | Skill profiles decorating Users |
| Software graph, enrollment + vísir annotations (inert but present) | Standards evaluation / scorecards (Tech Insights or custom) |
| `Cycle` (release + drive) and `Saga` with relations | Runbooks plugin (parameterized vísar) |

`make smoke-catalog` asserts the mock org ingests at runtime alongside the MTL seed (gildi Group typed, release Cycle with its relations, the Saga touching it).
