# Leiðangr — Guilds, Skills, and Standards: the Practice Layer (Design)

**Date:** 2026-07-10
**Status:** Draft
**Scope:** Terminology and conceptual model for the "practice layer" — how skills (Skill-Exchange-style),
crafts, guilds/practices, maturity standards (Soundcheck-style), and procedure guides relate to each
other and to the shipped `Cycle`/`Saga` kinds. Layered deliverable: an abstract model first (portable
beyond Leiðangr), then its concrete Backstage mapping. Vocabulary lands now; mechanics are Phase 6
(scorecards, skill profiles) and Phase 4 (muster calls) work.
**Related:** `2026-07-06-leidangr-phase3-community-domain-design.md` (two-family model, typed Group
tree), ADR 0007 (`Cycle`), ADR 0008 (`Saga`), the umbrella design
(`realms/.../2026-06-09-leidangr-design.md` §6 Phase 6), and the Backstage DevEx reference doc
(§ Scorecards and Poor Man's Soundcheck).

---

## 1. What This Is

Two premium Spotify Backstage plugins inspired this layer: **Skill Exchange** (skills attach to user
profiles; opportunities are posted and browsed) and **Soundcheck** (entities are measured against
tiered check-based standards). Spotify ships them as unconnected products. This design's claim is
that they are two faces of one concept — the **practice** (here: the **Gildi**) — and that a third
face, written procedure, completes it. A prior-art data point: an internal grouped-checks system at
Cervator's day job independently grew a "Grid" concept (themed collections of check-blocks —
security, scalability, maintainability) that converges on Soundcheck's "Track"; and a team there
independently subdivided into discipline areas mislabeled "teams" — groping toward the same missing
noun. The noun is the practice/guild, and this doc names the whole family.

## 2. Research Grounding (exact upstream vocabulary)

**Soundcheck** (no custom catalog kinds; operates on existing entities): **Fact Collectors** gather
**Facts** → **Checks** (atomic pass/fail/not-applicable, boolean rules over facts) → **Levels**
(strictly ordered groups of checks; a level completes when all its checks pass and all prior levels
are complete) → **Track** ("a long-term health initiative"). Passing a level = **Certification**,
badged bronze/silver/gold. A **Campaign** is a time-bound track with start/target dates and
milestones. Org rollup ("Tech Health") drills compliance % through the standard Group hierarchy.

**Skill Exchange** (no custom kinds; decorates catalog `User` entities): **Skills** are an
admin-defined YAML vocabulary (name + category). Users tag their **skill profile** under two
buckets: **"I can help with"** and **"I'm learning."** Opportunities are **Gigs**: **Embed**
(short-term staffing, with requested skills), **Mentorship** (offering / seeking), **Hack**
(passion projects). Matching is browse/search, not algorithmic.

Two direct mappings: the internal **Grid ≈ Soundcheck Track** (a themed measurement initiative an
entity enrolls in), and **Soundcheck Campaign ≈ `Cycle`** — a time-bound, dated push; Leiðangr
already owns that primitive.

## 3. The Abstract Model (layer 1 — portable)

### 3.1 The three faces of a practice

A practice (Security, Safety, Fundraising, Logistics, Coaching…) is one concept with three faces:

1. **People** — those who profess it: skills cluster under it, mentorship happens inside it. It is
   a fellowship.
2. **Process** — the procedures performed in its name, written down so a newcomer can perform them.
3. **Measurement** — the standard it holds *other things* to: tiered checks, certifying at
   bronze/silver/gold.

Skill Exchange ships face 1; Soundcheck ships face 3; runbooks/SOPs are face 2. Unifying them is
the design's core move.

### 3.2 The concepts

| Concept | Definition |
|---|---|
| **Skill** | An atomic capability a *person* carries, with a have/learning axis ("can help with" / "learning"). English *skill* is itself Old Norse (*skil*) — it needs no rename. |
| **Craft** | A demand-side bundle of skills (+ its guides): Electrician, HVAC tech; Coach, Treasurer, Field Marshal. What a muster asks for — nobody posts "need carpentry 3, wiring 2"; they post "need an electrician." |
| **Gildi** | The practice hub. Old Norse *gildi* means both **guild** (the fellowship of a craft) and **worth/value** — one word carrying the people face and the measurement face. |
| **Standard** | The gildi's measurement face (the Grid/Track analog): tiered groups of trials applied to an enrolled entity, certifying at bronze/silver/gold. *Standard* means both the banner a muster rallies under and the norm you are held to — the double meaning is the point. |
| **Trial** | The atomic measurement unit (Soundcheck's Check): evaluated against collected facts, yielding pass/fail/not-applicable. |
| **Vísir** | The written procedure handed to a volunteer or operator — the cash-register-at-the-PTA-event sheet. Short for *Leiðarvísir* ("way-shower"), the modern Icelandic word for a guide/manual and the title of Abbot Nikulás's 12th-century pilgrim itinerary; it shares the *leið-* (way) root with *Leiðangr* itself. The enterprise kenning is "runbook." |
| **Cycle**, **Saga** | Already shipped (ADRs 0007/0008). A Cycle *calls for* crafts; a Standard can measure a Cycle (season-readiness); a Saga narrates the outcome. |

### 3.3 The relations

- A person **carries** skills (have/learning axis).
- A craft **bundles** skills and **references** vísar (its procedures).
- A gildi **curates** skills (a skill can serve several gildi), **stewards** vísar, and **holds**
  one or more standards.
- A standard **measures** entities — apps, teams, facilities, or Cycles — through its tiered trials.
- A cycle **issues calls** for crafts (the muster); people whose skills satisfy a craft answer.
- A saga **narrates** what happened, and may cite certifications attained.

Crafts and gildi are different **axes**, not levels of one hierarchy: a craft draws skills from
several gildi (HVAC = ductwork + electrical + safety), and a gildi curates skills used by many
crafts. That is why both exist.

### 3.4 Worked examples

**DIY:** a person's profile lists skills (wiring, duct-shaping, carpentry). "Electrician" is a
craft bundling wiring + code-knowledge + safety basics. The Safety gildi does not do the wiring —
it holds the standard the finished work is measured against (the inspection: its trials, at
bronze/silver/gold).

**Season:** the spring season `Cycle` spins up and issues calls for crafts — coach, treasurer,
field marshal. The muster matches volunteers whose skills satisfy them; each volunteer gets the
relevant vísir. The Logistics gildi's "season-readiness" standard measures the Cycle itself
(fields booked? treasurer named? first-aid kit stocked?). When the season ends, a skald may write
the Saga.

**Software:** identical bones — the Security gildi curates security skills, stewards the
incident-response vísir, and holds the security standard that measures Components at
bronze/silver/gold. This is the umbrella design's Phase 6 "season-readiness scorecards" and the
day-job Grid, expressed once.

## 4. The Kenning Layer (display terminology)

Technical identifiers commit to **one canonical vocabulary** (below). The UI never hard-codes those
strings: it renders through a **kennings map** — a configurable lexicon resolving each technical
term to a display term (a *kenning* being the Old Norse device of calling a thing by another name).

- Ships with two built-in lexicons: **norse** (Gildi, Vísir, Trial, Saga…) and **plain** (Guild,
  Guide/Runbook, Check, Report…), selected per instance in app-config.
- A per-user lexicon preference is a **later enhancement** (Backstage user settings can hold it),
  not a launch requirement.
- The parent-facing Ting surface pins the **plain** lexicon — satisfying the realm Tone Guide with
  zero special-casing.
- A corporate instance can pin its own custom lexicon (Practice, Grid, Check) over the identical
  model — same bones, different skin.

### Canonical vocabulary

| Canonical (technical) | Norse display | Plain display | Notes |
|---|---|---|---|
| `skill` | Skill | Skill | Already Old Norse. |
| `craft` | Craft | Craft / Role | *Iðn* available as a norse-lexicon skin. |
| `gildi` | Gildi | Guild | The one deliberate ON anchor at the technical layer (mirrors `spec.skald`). |
| `standard` | Standard | Standard / Scorecard | *Merki* (banner/mark) available as a norse skin. |
| `trial` | Trial | Check | *Raun* / *Þraut* available as norse skins. |
| `visir` | Vísir | Guide / Runbook | Full *Leiðarvísir* in prose/docs where flavor has room. |
| `cycle`, `saga` | (as shipped) | (as shipped) | Unchanged. |

**Reserved future flavor** (named now so later features inherit consistent vocabulary): **Afrek**
(a recognized feat/deed — recognition mechanics, if ever), **Fóstr** (mentorship gig — Norse
fosterage was *the* mentorship institution), **Útboð** (a muster call — the actual term for calling
out the leiðangr levy, and modern Icelandic for a tender/RFP).

## 5. The Leiðangr Mapping (layer 2 — Backstage mechanics)

Follows the established discipline: no kind introduced merely to filter; nothing unique lives only
in the Backstage DB; volatile data stays out of the catalog. **This design introduces no new custom
kinds** — `Cycle` and `Saga` remain the only two.

| Concept | Realization |
|---|---|
| Gildi | **`Group` with `spec.type: gildi`** — joins the typed-Group tree (organization/sport/…/gildi). Membership (`memberOf`), ownership rollups, and the graph come free. Dovetails with the parked CODEOWNERS-virtual-team idea: a gildi is a virtual team that is *supposed* to exist. |
| Skill | A **vocabulary, not entities** (Skill Exchange's exact shape): YAML-defined skill list; a profile decorator attaches selections to `User` entities so search indexes them. Matches the ResourceType-as-vocabulary precedent. |
| Craft | **Vocabulary-first**: a named bundle (skill refs + vísir refs) in the same YAML family. Promotable to something heavier only if matching mechanics demand it — the cheapest commitment while the structure is still finding its shape. |
| Standard + trials | **Git-backed YAML consumed by the scorecard plugin.** Evaluate `@backstage-community/plugin-tech-insights` first (facts/checks/fact-retrievers); fall back to a custom grouped-checks plugin if it constrains (per the DevEx reference doc). Each standard is `ownedBy` its gildi Group; applicability is two-layered per Soundcheck (static catalog filter + enrollment annotation) so broad trials never ambush entities. Results/history are plugin data — rebuildable, like the Saga discipline. |
| Vísir | **Git markdown, TechDocs-rendered**, referenced via `siliconsaga.org/visir` annotations from gildi Groups, crafts, facilities, or Cycles — the same thin-index-over-Git pattern as `saga-doc`. |
| Muster calls | **Not catalog.** Calls are volatile marketplace data → the Phase 4 store (the issue-tracker-as-store contender fits: a call *is* an issue with labels). A call references a Cycle + a craft. Deferred with Phases 4/6. |
| Certifications / badges | Plugin data surfaced on entity pages, bronze/silver/gold. Community-side certifications are **advisory, never gates** (umbrella design §8: trust over gamification). |

## 6. Deliberate Non-Goals

- **No matching algorithm.** Browse + moderator matching first (same posture as Skill Exchange and
  the umbrella design §5.3).
- **No Afrek/feat mechanics.** Recognition is reserved vocabulary only, gated on the §8
  trust-over-gamification line.
- **No skill levels on people** beyond the have/learning axis. (Bronze/silver/gold rate *things
  against standards*, not people. The Rígsþula rank ladder — þræll/karl/jarl — was considered for
  tiers and rejected: "thrall" as an unrated tier is exactly the shaming §8 warns against.)
- **No new custom kinds**, no custom relation types — built-ins only, per ADR 0007 precedent.

## 7. Phasing & Next Steps

1. **Now:** this doc fixes the vocabulary; fold the settled terms into the planned
   `docs/catalog-model.md` reference doc when it is written.
2. **Phase 4:** muster calls ride the marketplace-store decision (§5.1 of the umbrella design),
   referencing Cycles + crafts.
3. **Phase 6:** skill profiles + vocabulary, the first gildi Groups, the first standard
   (season-readiness, measuring a Cycle), and the kennings map in app-config. Tech Insights
   evaluation happens here.
4. **ADR distillation** once mechanics ship (the gildi-as-typed-Group and kennings decisions are
   ADR-shaped).

## 8. Open Questions

- **Ordered levels vs. unordered blocks** inside a standard: Soundcheck levels are strictly
  sequential; the day-job Blocks are thematic groupings. Decide when the scorecard plugin is built
  (Tech Insights' model may decide it for us).
- **Where craft definitions live** long-term if matching gets real (vocabulary → entity promotion
  path).
- **Kennings scope**: exact config shape, and whether spec *field* names (not just kind/type
  display) participate in display mapping.
