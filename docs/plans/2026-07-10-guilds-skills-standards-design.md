# Leiðangr — the Guildhall: Guilds, Skills, and Standards (Design)

**Date:** 2026-07-10
**Status:** Draft
**Scope:** Terminology and conceptual model for the **Guildhall** — the system relating skills (Skill-Exchange-style), crafts, guilds/practices, maturity standards (Soundcheck-style), and procedure guides to each other and to the shipped `Cycle`/`Saga` kinds. Layered deliverable: an abstract model first (portable beyond Leiðangr), then its concrete Backstage mapping. Vocabulary lands now; mechanics are Phase 6 (scorecards, skill profiles) and Phase 4 (muster calls) work.
**Related:** `2026-07-06-leidangr-phase3-community-domain-design.md` (two-family model, typed Group tree), ADR 0007 (`Cycle`), ADR 0008 (`Saga`), the umbrella design (`realms/realm-siliconsaga/docs/plans/2026-06-09-leidangr-design.md` in the yggdrasil workspace — not in this repo; §6 Phase 6), and the Backstage DevEx reference doc (§ Scorecards and Poor Man's Soundcheck).

---

## 1. What This Is

This system is the **Guildhall** — the hall where the guild rosters, the craft rolls, the standards, and the guides all hang together. ("Practice layer" was the working name; it read as a verb — *practicing* — one ambiguity too many for a terminology design. *Gildaskáli*, the historic guild-hall, is its norse kenning skin.) Two premium Spotify Backstage plugins inspired it: **Skill Exchange** (skills attach to user profiles; opportunities are posted and browsed) and **Soundcheck** (entities are measured against tiered check-based standards). Spotify ships them as unconnected products. This design's claim is that they are two pieces of one thing — the **practice** — completed by a third piece Spotify never shipped: written procedure. A practice is not a single entity but a small constellation of nouns (§3). A prior-art data point: an internal grouped-checks system at Cervator's day job independently grew a "Grid" concept (themed collections of check-blocks — security, scalability, maintainability) that converges on Soundcheck's "Track"; and a team there independently subdivided into discipline areas mislabeled "teams" — groping toward the same missing noun. The missing noun is the **aspect** (§3), and this doc names the whole family around it.

## 2. Research Grounding (exact upstream vocabulary)

**Soundcheck** (no custom catalog kinds; operates on existing entities): **Fact Collectors** gather **Facts** → **Checks** (atomic pass/fail/not-applicable, boolean rules over facts) → **Levels** (strictly ordered groups of checks; a level completes when all its checks pass and all prior levels are complete) → **Track** ("a long-term health initiative"). Passing a level = **Certification**, badged bronze/silver/gold. A **Campaign** is a time-bound track with start/target dates and milestones. Org rollup ("Tech Health") drills compliance % through the standard Group hierarchy.

**Skill Exchange** (no custom kinds; decorates catalog `User` entities): **Skills** are an admin-defined YAML vocabulary (name + category). Users tag their **skill profile** under two buckets: **"I can help with"** and **"I'm learning."** Opportunities are **Gigs**: **Embed** (short-term staffing, with requested skills), **Mentorship** (offering / seeking), **Hack** (passion projects). Matching is browse/search, not algorithmic.

Two direct mappings: the internal **Grid ≈ Soundcheck Track** (a themed measurement initiative an entity enrolls in), and **Soundcheck Campaign ≈ `Cycle`** — a time-bound, dated push; Leiðangr already owns that primitive.

## 3. The Abstract Model (layer 1 — portable)

### 3.1 The anatomy of a practice

A practice (Security, Safety, Fundraising, Logistics, Coaching…) is not one entity — it is a small constellation:

1. **An Aspect** — the cross-cutting concern itself, the thing *applied to* other entities in the AOP sense ("the Security aspect applies to component X, at silver"). The aspect holds the practice's **standards**.
2. **A Gildi** — the fellowship of practitioners who steward it.
3. **Crafts and skills** — its enactment by people.
4. **Vísar** — its written form.

Skill Exchange ships the people piece; Soundcheck ships the measurement piece; runbooks/SOPs are the written piece. Unifying them is the design's core move — and the split everything rests on is: **crafts are what people do; aspects are what things must uphold.** Wiring the concession stand is a craft's work; the wiring passing inspection is an aspect's standard.

### 3.2 The concepts

| Concept | Definition |
|---|---|
| **Skill** | An atomic capability a *person* carries, with a have/learning axis ("can help with" / "learning"). **Shared vocabulary owned by no one** — crafts and aspects reference skills; pointing is not owning. English *skill* is itself Old Norse (*skil*) — it needs no rename. |
| **Craft** | A demand-side bundle of skills (+ its vísar) a person can act as: Electrician, HVAC tech; Coach, Treasurer, Field Marshal. What a muster asks for — nobody posts "need carpentry 3, wiring 2"; they post "need an electrician." |
| **Gildi** | The fellowship — **purely people**. A gildi gathers around a craft (the Electricians' gildi — the historic form) or around an aspect (the Safety gildi). Membership, mentorship (fóstr), and stewardship live here, and nothing else does. Old Norse *gildi* means both **guild** and **worth/value**. |
| **Aspect** | The cross-cutting concern: Security, Safety, Scalability, season-readiness. Applied to entities in the AOP sense, and it **holds the standards** that measure them. A mature aspect ships both **the bar and the paved road to clear it** — reusable techniques (e.g. CI pipeline template steps) whose adoption satisfies its trials (§3.4). May be stewarded by a gildi, or by nobody yet. (Norse kenning skin: open — see §8.) |
| **Standard** | An aspect's measurement instrument (the Grid/Track analog): tiered groups of trials applied to an enrolled entity, certifying at bronze/silver/gold. *Standard* means both the banner a muster rallies under and the norm you are held to — the double meaning is the point. |
| **Trial** | The atomic measurement unit (Soundcheck's Check): evaluated against collected facts, yielding pass/fail/not-applicable. |
| **Vísir** | The written procedure handed to a volunteer or operator — the cash-register-at-the-PTA-event sheet. Short for *Leiðarvísir* ("way-shower"), the modern Icelandic word for a guide/manual and the title of Abbot Nikulás's 12th-century pilgrim itinerary; it shares the *leið-* (way) root with *Leiðangr* itself. Comes in two grades (§3.5): **teaching** (static, docs-homed) and **operational** (parameterized, runbooks-homed); whether the grades get distinct terms is open (§8). The enterprise kenning is "runbook." |
| **Cycle**, **Saga** | Already shipped (ADRs 0007/0008). A Cycle *calls for* crafts; a Standard can measure a Cycle (season-readiness); a Saga narrates the outcome. |

### 3.3 The relations

- A person **carries** skills (have/learning axis).
- A craft **bundles** skills and **references** vísar (its procedures).
- A gildi **gathers** practitioners and **stewards** crafts and/or aspects (and their vísar).
- An aspect **holds** standards; entities **enroll in** (carry) aspects.
- A standard **measures** its enrolled entities — apps, teams, facilities, or Cycles — through its tiered trials.
- A trial **links to** the vísir that remediates it — a failing check is always one click from "here is exactly how to fix it."
- A cycle **issues calls** for crafts (the muster); people whose skills satisfy a craft answer.
- A saga **narrates** what happened, and may cite certifications attained.
- Skills are **referenced, never owned** — by crafts, aspects, and people's profiles alike.

Crafts and aspects are different **axes**, not levels of one hierarchy: a craft draws skills from anywhere (HVAC = ductwork + electrical + safety basics), and an aspect judges entities of any kind. The gildi is orthogonal to both — it is simply whichever fellowship formed around a craft or an aspect, which is exactly why it maps to a plain typed `Group` (§5).

### 3.4 Worked examples

**DIY:** a person's profile lists skills (wiring, duct-shaping, carpentry). "Electrician" is a craft bundling wiring + code-knowledge + safety basics. An Electricians' gildi — if the community has enough practitioners to form one — fosters apprentices and keeps the craft's vísar. The Safety **aspect** does not do the wiring — it holds the standard the finished work is measured against (the inspection: its trials, at bronze/silver/gold), stewarded by a Safety gildi if one exists.

**Season:** the spring season `Cycle` spins up and issues calls for crafts — coach, treasurer, field marshal. The muster matches volunteers whose skills satisfy them; each volunteer gets the relevant vísir. The Logistics **aspect**'s "season-readiness" standard measures the Cycle itself (fields booked? treasurer named? first-aid kit stocked?). When the season ends, a skald may write the Saga.

**Software:** identical bones — the Security **aspect** holds the standard that measures Components at bronze/silver/gold; the Security gildi gathers the practitioners who steward it and its incident-response vísir. The day-job Grid is an aspect's standard, and the meeting's mislabeled "sub-teams" are gildi stewarding aspects. This is the umbrella design's Phase 6 "season-readiness scorecards" and the day-job Grid, expressed once.

**The paved-road loop (what a gildi does, and where):** the Security gildi works out of the practice's home repo, which holds three kinds of things — the **standard** (trials in tiers), the **paved road** (reusable techniques, e.g. CI pipeline template steps any Component can adopt with a one-line include), and the **remediation vísar** every trial links to. A team enrolls a Component, sees bronze with a failing dependency-scanning trial, follows its remediation vísir (whose entire instruction is "add this include line"), and the next pipeline run's collected facts flip the trial green automatically — no audit meeting, no spreadsheet, no chasing. When the requirement, the tooling that satisfies it, and the measurement that verifies it share one steward, the cheapest way to comply *is* the paved road. The community translation holds too: the Logistics gildi's paved road is the pre-stocked first-aid-kit checklist and supplier list that make the season-readiness trial trivially passable.

### 3.5 Vísir grades: teaching vs. operational

One artifact concept, two grades — the separation matters, but both attach with the same flexibility (the annotation's referrer defines the scope: a skill entry, a craft, an aspect, a Component, a facility, a Cycle):

- **Teaching vísar** — static explanatory material ("intro to field-lining," the treasurer's season guide). Homed in `/docs`, rendered by TechDocs.
- **Operational vísar** — procedures executed under conditions, often environment-specific ("scoreboard won't boot," the known-outage runbook). Still plenty of instructive text — the difference is capability, not genre: they carry **placeholders for environmental details** filled at read time (e.g. via URL parameters), so the reader can copy-paste completely accurate commands. Homed in `/runbooks` alongside `/docs` in the owning repo, rendered by a dedicated runbooks plugin (a pre-existing plugin concept of Cervator's that slots in here directly).

Whether the two grades deserve distinct *terms* (e.g. **Fræði** — lore — for teaching material, reserving **Vísir** for the dynamic way-shower; or plain "docs" for teaching with Vísir as the only named artifact) is an open question (§8). An open `type` vocabulary (guide / runbook / drill / …) discriminates further, in the house style of `Cycle.spec.type`, without minting new kinds of thing per scope.

## 4. The Kenning Layer (display terminology)

Technical identifiers commit to **one canonical vocabulary** (below). The UI never hard-codes those strings: it renders through a **kennings map** — a configurable lexicon resolving each technical term to a display term (a *kenning* being the Old Norse device of calling a thing by another name).

- Ships with two built-in lexicons: **norse** (Gildi, Vísir, Trial, Saga…) and **plain** (Guild, Guide/Runbook, Check, Report…), selected per instance in app-config.
- A per-user lexicon preference is a **later enhancement** (Backstage user settings can hold it), not a launch requirement.
- The parent-facing Ting surface pins the **plain** lexicon — satisfying the realm Tone Guide with zero special-casing.
- A corporate instance can pin its own custom lexicon (Practice, Grid, Check) over the identical model — same bones, different skin.

### Canonical vocabulary

| Canonical (technical) | Norse display | Plain display | Notes |
|---|---|---|---|
| `guildhall` | Gildaskáli | Practices / Practice Hub | The system's own name — the whole assembly of the rows below. |
| `skill` | Skill | Skill | Already Old Norse. |
| `craft` | Craft | Craft / Role | *Iðn* available as a norse-lexicon skin. |
| `gildi` | Gildi | Guild | The one deliberate ON anchor at the technical layer (mirrors `spec.skald`). |
| `aspect` | Aspect | Practice / Aspect | Norse skin open (§8) — *þáttr* rejected for a Danish false-friend collision. |
| `standard` | Standard | Standard / Scorecard | *Merki* (banner/mark) available as a norse skin. |
| `trial` | Trial | Check | *Raun* / *Þraut* available as norse skins. |
| `visir` | Vísir | Guide / Runbook | Full *Leiðarvísir* in prose/docs where flavor has room. |
| `cycle`, `saga` | (as shipped) | (as shipped) | Unchanged. |

**Reserved future flavor** (named now so later features inherit consistent vocabulary): **Afrek** (a recognized feat/deed — recognition mechanics, if ever), **Fóstr** (mentorship gig — Norse fosterage was *the* mentorship institution), **Útboð** (a muster call — the actual term for calling out the leiðangr levy, and modern Icelandic for a tender/RFP), **Fræði** (lore — candidate term for teaching-grade vísar, §8).

**Lexicon review discipline:** kenning candidates get a false-friend check across the languages the community actually speaks — *þáttr* looked perfect (a strand of a rope; a short tale woven into a saga compilation) until its Danish sound-alike disqualified it.

## 5. The Leiðangr Mapping (layer 2 — Backstage mechanics)

Follows the established discipline: no kind introduced merely to filter; nothing unique lives only in the Backstage DB; volatile data stays out of the catalog. **This design introduces no new custom kinds** — `Cycle` and `Saga` remain the only two.

| Concept | Realization |
|---|---|
| Gildi | **`Group` with `spec.type: gildi`** — joins the typed-Group tree (organization/sport/…/gildi). Membership (`memberOf`), ownership rollups, and the graph come free. What the gildi stewards (craft or aspect refs) is a `siliconsaga.org/*` annotation. Dovetails with the parked CODEOWNERS-virtual-team idea: a gildi is a virtual team that is *supposed* to exist. |
| Skill | A **vocabulary, not entities** (Skill Exchange's exact shape): YAML-defined skill list; a profile decorator attaches selections to `User` entities so search indexes them. Matches the ResourceType-as-vocabulary precedent. |
| Craft | **Vocabulary-first**: a named bundle (skill refs + vísir refs) in the same YAML family. Promotable to something heavier only if matching mechanics demand it — the cheapest commitment while the structure is still finding its shape. |
| Aspect | **Vocabulary-first**, same YAML family: id, description, standard refs, optional steward-gildi ref. No new kind — an aspect an entity carries is an enrollment annotation on that entity. An aspect's assets (standard YAML, paved-road templates, remediation vísar) live together in a **practice home repo** stewarded by its gildi (§3.4). |
| Standard + trials | **Git-backed YAML consumed by the scorecard plugin.** Evaluate `@backstage-community/plugin-tech-insights` first (facts/checks/fact-retrievers); fall back to a custom grouped-checks plugin if it constrains (per the DevEx reference doc). Each standard declares its **aspect**, plus an `ownerEntityRef` to the steward gildi Group when one exists; **each trial declares a remediation-vísir ref** so failing checks always link to the fix; applicability is two-layered per Soundcheck (static catalog filter + enrollment annotation) so broad trials never ambush entities. Results/history are plugin data — rebuildable, like the Saga discipline. |
| Vísir (teaching) | **Git markdown in `/docs`, TechDocs-rendered**, referenced via `siliconsaga.org/visir` annotations from gildi Groups, craft/skill vocabulary entries, Components (including practice homes), facilities, or Cycles — the same thin-index-over-Git pattern as `saga-doc`. |
| Vísir (operational) | **Parameterized templates in `/runbooks`** alongside `/docs` in the owning repo, rendered by a dedicated runbooks plugin (placeholders for environmental details filled via URL parameters — the pre-existing plugin concept). Component/aspect-scoped runbooks live with the component they serve. |
| Muster calls | **Not catalog.** Calls are volatile marketplace data → the Phase 4 store (the issue-tracker-as-store contender fits: a call *is* an issue with labels). A call references a Cycle + a craft. Deferred with Phases 4/6. |
| Certifications / badges | Plugin data surfaced on entity pages, bronze/silver/gold. Community-side certifications are **advisory, never gates** (umbrella design §8: trust over gamification). |

## 6. Deliberate Non-Goals

- **No matching algorithm.** Browse + moderator matching first (same posture as Skill Exchange and the umbrella design §5.3).
- **No Afrek/feat mechanics.** Recognition is reserved vocabulary only, gated on the §8 trust-over-gamification line.
- **No skill levels on people** beyond the have/learning axis. (Bronze/silver/gold rate *things against standards*, not people. The Rígsþula rank ladder — þræll/karl/jarl — was considered for tiers and rejected: "thrall" as an unrated tier is exactly the shaming §8 warns against.)
- **No new custom kinds**, no custom relation types — built-ins only, per ADR 0007 precedent.

## 7. Phasing & Next Steps

1. **Now:** this doc fixes the vocabulary; fold the settled terms into the planned `docs/catalog-model.md` reference doc when it is written. A mock software org (**Ravenline**, `examples/mock-org/`) ships alongside as the running example: it ingests with zero new code — the "no new custom kinds" claim, demonstrated — and freezes the vocabulary/standard/vísir file shapes as fixtures for the future plugins.
2. **Phase 4:** muster calls ride the marketplace-store decision (§5.1 of the umbrella design), referencing Cycles + crafts.
3. **Phase 6:** skill profiles + vocabulary, the first gildi Groups and aspects, the first standard (season-readiness, measuring a Cycle), and the kennings map in app-config. Tech Insights evaluation happens here.
4. **Runbooks plugin** (operational vísar: `/runbooks` convention + URL-parameter placeholders) is its own plugin effort — general-purpose Backstage value like `Cycle`, sequenced independently.
5. **ADR distillation** once mechanics ship (the gildi-as-typed-Group, aspect-holds-standards, and kennings decisions are ADR-shaped).

## 8. Open Questions

- **Norse kenning skin for `aspect`**: *þáttr* (strand; tale-within-a-saga) fit best but is rejected — it sound-collides with a rude Danish word. Live candidates: *þráðr* (thread — keeps the woven-through imagery, Danish-safe *tråd*), *háttr* (manner/mode/verse-form — Snorri's *Háttatal* is a catalog of patterns), *siðr* (custom/practice, as in *forn siðr*), *grein* (branch/discipline — most legible). No urgency: `aspect` is canonical and the skin is display-only.
- **Term-splitting the vísir grades**: keep one noun with grade adjectives, adopt **Fræði** (lore) for teaching material with **Vísir** reserved for the dynamic runbook, or leave teaching material as plain "docs." Revisit once the runbooks plugin takes shape.
- **Ordered levels vs. unordered blocks** inside a standard: Soundcheck levels are strictly sequential; the day-job Blocks are thematic groupings. Decide when the scorecard plugin is built (Tech Insights' model may decide it for us).
- **Where craft and aspect definitions live** long-term if matching/enrollment gets real (vocabulary → entity promotion path).
- **Kennings scope**: exact config shape, and whether spec *field* names (not just kind/type display) participate in display mapping.
- **Runbooks plugin shape**: parameter syntax, URL-parameter contract, and how `/runbooks` coexists with TechDocs (separate renderer vs. TechDocs extension).
