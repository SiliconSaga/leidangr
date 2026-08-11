# Vísir: the Guildhall Grand Tour

*A teaching vísir owned by the DevEx team (`group:default/team-devex` in the Ravenline seed): the guided tour for demos and for introducing new users to this Backstage instance. In the catalog, the `leidangr` System links here — the tour is discoverable from inside the thing it tours.*

Say the corporate words out loud ("Practice", "Guild", "Check") and let the screen show the canonical names (aspect, gildi, trial) — narrating that gap *is* the kenning-layer pitch.

---

## Setup (once per machine, ~15 min)

Prereqs: git, **Node 22 or 24** (check `node --version` — this is the classic demo-day gotcha; the repo's `engines` field rejects anything else), and a browser. `make` is convenient but optional.

```bash
git clone https://github.com/SiliconSaga/leidangr.git
cd leidangr
corepack enable          # once per machine; activates the pinned Yarn
make doctor              # env sanity: Node, Corepack, mkdocs, ports (or: node scripts/lib/run-doctor.mjs)
make deps                # or: corepack yarn install --immutable
make dev                 # stub mode: zero secrets, no cluster
```

App: `http://localhost:3000` (backend on 7007). Sign in as **Guest**. First boot takes a minute or two; the seeds ingest ~30s after "Listening on" — if the Kind dropdown lacks Cycle/Saga, wait and refresh.

**TechDocs (optional but nice):** the mock repos render as real doc sites, fully locally — no Git provider involved. Generation needs either **Docker running** (the scaffold default) or the local generator — one config flip plus `pip install mkdocs-techdocs-core`, both written up in [local dev](development/local-dev.md). `make dev` resolves a real `mkdocs` binary for you, so the classic `spawn mkdocs ENOENT` should not bite. If neither route is available on the demo machine, skip it — the entity links cover the same ground.

**Verify checklist** (run the day before a demo, not the morning of):

- [ ] Catalog loads; the Kind dropdown includes **Cycle** and **Saga**
- [ ] `ravenline` Group shows the org tree (two departments — `rl-engineering`, `foxholm`) plus four `guild`-typed Groups
- [ ] A guild page (e.g. `security-gildi`) leads with its **Charter card and generated crest**
- [ ] `carrier-gateway` shows an **Aspects card** reading `security v1.2 · behind · current 1.4`
- [ ] `leidangr` System exists in the `siliconsaga` Domain, owned by `team-devex`, linking to this vísir, with the `gildi` Component (type `plugin`) under it
- [ ] `security-practice` Component (type `practice`) shows its links into the aspect repo
- [ ] Create page lists **Apply the Security aspect** (the adoption template)
- [ ] `tracking-2026-2` Cycle shows the curated overview card
- [ ] `saga-dependency-scanning-drive` Saga exists (Astrid's mid-run drive report)
- [ ] `make smoke-catalog` passes (your offline proof, and the fallback if the UI misbehaves live)

## The tour (~15 min as a demo; self-paced for new users)

**1. The pitch (2 min, no screen).** Three familiar symptoms: focus areas with no org-chart shape ("teams" that aren't teams), production readiness living in tribal knowledge, docs and runbooks conflated. Spotify sells two disconnected products here (Skill Exchange, Soundcheck); the claim is they're two pieces of one thing — a **Practice** — plus a third piece nobody shipped: written procedure.

**2. Catalog tour (6 min).**

- *Catalog → Kind dropdown*: **Cycle** and **Saga** next to Component/Group. Talking point: two custom kinds total; the entire practice layer adds **zero** more — typed Groups, vocabularies, annotations, links.
- *`ravenline` Group → relations graph*: the org tree — two departments, engineering and the acquired **Foxholm** returns line — plus four **guilds** (`spec.type: guild`) cross-cutting it. Two are aspect-aligned (Security, Platform) and two craft-aligned (Release Captains, Incident Commanders). A guild is deliberately just a typed Group: membership, rollups, and the graph come free. Point out Dagny: a Foxholm engineer in the security guild — the guild spans departments, and that's the whole point.
- *Open `security-gildi` itself*: the guild page is **composed, not the stock Group page** — it leads with a Charter card carrying a **generated heraldic crest** (deterministic from the group id, so every guild has arms without anyone drawing them), then ownership, members, and a Chronicle rail of recent sagas and drives. The entity graph is deliberately demoted. Same crest reappears wherever that guild acts, which is the identity-mark rule doing its job.
- *`siliconsaga` Domain → `leidangr` System → `gildi` Component*: the instance you are standing in is itself cataloged, as the System of parts it actually is — owned by the DevEx team, with this document as its vísir, and **Guild Hall as its first cornerstone**. Dogfood moment, and a structural one: any instance adopting this model repeats the same hierarchy, with its own cornerstones under its own System. Note what is *absent* — there is no entity for the Guild Hall *page*. The page is a rendered surface the `gildi` plugin contributes; what earns a Component is the plugin, not the screen.
- *`security-practice` Component (type `practice`)*: the **practice** is the institution (the guild runs it); its **aspect** is the module — a repo holding the blocked standard, the paved road, the adoption templates, and the remediation docs. The entity links go straight into that repo, one click each. This page is composed too: a Practice card naming the aspect it maintains and the guild that runs it (same crest again), and an **Adopters card** listing every component enrolled in that aspect with the version each took. That list is the practice's reach, computed from annotations rather than maintained by hand.
- *Open `label-service` first, then the Create page*: the pristine, unenrolled component says so on its own page — an **Adopt an aspect** card with a button straight to the Create page filtered to adoption templates. The invitation lives where you notice it, not somewhere you have to already know about. Follow it to **Apply the Security aspect**: the **adoption** — applying a practice is a self-service action, not a wiki page. The mock edition logs its weave plan — annotation, CI includes, stewardship stubs, PR. Then the CLI beat: the same repo ships `SKILL.md`, the identical adoption for agents — *some users never leave their terminal, and neither do their agents.*
- *`tracking-api` Component*: the **Aspects card** in the right rail is the same relationship read from the component's end — one row per adopted aspect, the version it took, and whether that is the practice's current release. Note `operational-readiness` sitting there as *enrolled* with no verdict: an aspect can exist before a guild forms a practice around it, so the card degrades honestly instead of inventing an answer. Underneath it all are plain annotations (`siliconsaga.org/aspects`) — the card just renders them. If TechDocs generation is available, open its **Docs tab**: the on-call primer and the queue-backlog runbook render as a real doc site (runbooks nest under docs as an interim convention until the parameterized-runbooks plugin exists — say that out loud, it's a roadmap point).
- *`tracking-2026-2` Cycle*: a release as a first-class bounded effort. Then *`dependency-scanning-drive`*: a time-bound push — Soundcheck sells this as "Campaigns"; here it's a Cycle of type drive. **The story beat**: the guild shipped module 1.4 (the practice records it as `siliconsaga.org/module-release`); each enrolled component's `aspect-versions` annotation records what it actually adopted; the gap is what the drive closes. **That gap is now on the page, not just in the narration** — open `carrier-gateway` and its Aspects card reads `v1.2 · behind · current 1.4`, while `shipping-orchestrator` reads `current`. Walk it: `shipping-orchestrator` (adopted May — its `adoption-record` annotation keeps the PR, the "this happened" evidence), `refund-service` (Foxholm, adopted during onboarding — same standard, same guild, second department), `intake-scanner` and `carrier-gateway` (the two remaining laggards, each bronze for a stated reason).
- *`saga-dependency-scanning-drive`*: **a Saga can narrate a Cycle still in flight** — Astrid's mid-run report tallies the drive (three of five green, twelve days left). Read the shipping-orchestrator paragraph aloud: adoption from the Create page, one-line PR, green on the next run — the paved-road pitch as a past event, not a promise.
- *`saga-tracking-2026-2`*: the retrospective as a catalog citizen — authored by a person, linked to everything it touched, body in Git. Open `examples/mock-org/sagas/tracking-2026-2.md` and read two sentences aloud; the May 14th incident sets up the next stop.

**3. Files tour (4 min).** In an editor, `examples/mock-org/`:

- `repos/security-aspect/` (the module): `standard.yaml` — checks grouped in **blocks** by tool/sub-concern, each block scoped by **facets** (a service that's also a queue consumer gets both natures — see tracking-api's facets override), tiers laddering across them; `pipeline-templates/` (the paved road); `template.yaml` + `SKILL.md` (the two adoption doors); `docs/`.
- The loop, told on `carrier-gateway` (bronze in the narrative): failing check → remediation doc → whose entire instruction is the one-line include → next pipeline run reports facts → check flips green. **When the requirement, the tooling, and the measurement share one owner, the cheapest way to comply is the paved road.** Land this sentence.
- `repos/tracking-api/docs/runbooks/queue-backlog.md`: docs teach, **runbooks are followed under pressure** — parameterized placeholders (`{{cluster}}`) filled at read time so every command copy-pastes exactly right. Born from the incident the Saga describes.

**4. The kicker (1 min).** Filter Groups again → the **MTL soccer league** in the same instance: seasons are Cycles, season-readiness is a standard measuring a Cycle. The same five primitives running a youth sports league and a software org — the evidence the model is general, not a one-off.

**5. Close (1 min).** Where an org starts: name 2–3 real practices and stand up their guilds; move one existing scorecard under its practice with remediation links; pilot the parameterized-runbook convention on one service. Advisory before mandatory, always.

## Honesty lines (quote verbatim if asked)

- "The **model and catalog are real** — everything you saw ingested is running code with tests."
- "**Check evaluation is not implemented yet** — bronze/silver in descriptions is demo narrative; the standards files are the frozen input for that engine, and the expected results already sit in the repo as its future test fixtures."
- "Display terminology is configurable **by design** (one canonical vocabulary, per-org display terms); the UI shows canonical names today — the display layer is future work."

## Fallbacks

- **App won't boot** (wrong Node, port conflict, corporate proxy): `make smoke-catalog` prints the headless ingestion proof — narrate over its output plus the files tour, which alone carries most of the story.
- **No laptop at all**: the design doc (`docs/plans/2026-07-10-guilds-skills-standards-design.md`), ADR 0009, and `examples/mock-org/README.md` (ingests-vs-waits table) make a solid paper demo.

## Q&A ammo

- *"Is this Soundcheck?"* — Same measurement bones (facts → checks → tiers → certification, deliberately compatible thinking), but connected to the people side (skills, guilds) and the procedure side (runbooks) that Spotify ships separately or not at all — on open Backstage, with no custom kinds for the practice layer itself.
- *"What would it take to run this in our org?"* — Any Backstage instance: guilds are typed Groups, vocabularies are YAML, standards are Git files, runbooks are repo markdown. The evaluation engine is the only real build (Tech Insights first).
- *"Who maintains a practice?"* — Its guild: a fellowship, not a reporting line. The practice home repo makes stewardship concrete — requirements, paved road, and remediation docs live together with one owner.
- *"How do practices connect to checks and ratings?"* — Practice (aspect) holds the standard; the standard's tiers hold the checks; every check links its remediation. Today that chain is Git files plus entity links; the scorecard engine makes it live data on entity pages.
- *"The entity colours look deliberate — how do you keep that coherent?"* — `make theme-swatches` renders every page-theme colour Backstage ships plus every one we define, alongside the `spec.type` values actually present in the catalog and which ones are still falling through to the default. If there is a laptop handy this is a good thirty-second aside: **the page flips into protanopia, deuteranopia and tritanopia simulation**, and it flags pairs that are distinct to normal vision but collapse under one of them. It caught a real collision in our own palette — two Cycle colours a red-green colour-blind viewer could not tell apart — which is the honest version of the answer: the tool exists because eyeballing it was not good enough.
