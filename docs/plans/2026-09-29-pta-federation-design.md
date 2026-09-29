# PTA Federation — leaves that stand alone, a nexus that points (Design)

**Date:** 2026-09-29
**Status:** Draft, for discussion; nothing built
**Scope:** How Leiðangr serves a district of PTAs without becoming something they depend on. Catalog shape for the district, the paved paths (Scaffolder templates with agent twins), the first PTA-facing aspect, per-PTA communication preferences, and the ownership rules that keep the bus factor above one.
**Related:** [umbrella design](https://github.com/SiliconSaga/realm-siliconsaga/blob/main/docs/plans/2026-06-09-leidangr-design.md) (§2 "survive turnover", §3 hybrid discipline), [Phase 3 community domain](2026-07-06-leidangr-phase3-community-domain-design.md) (`Cycle`, `Saga`, occurrences queried not minted), [devex reference](https://github.com/SiliconSaga/realm-siliconsaga/blob/main/docs/plans/2026-06-09-backstage-devex-workspace-design.md) (event templates, the publishing front, "points at, does not hold"), ADR 0010 (two adoption doors), ADR 0011 (instance as a System), [website-hygiene aspect](2026-08-11-website-hygiene-aspect-design.md), [fact source](2026-08-29-aspect-fact-source-design.md), knarr's [community-reach design](https://github.com/SiliconSaga/knarr/blob/main/docs/plans/2026-09-27-knarr-community-reach-design.md), the `schools` manifesto (module 13, PTA coordination)

---

## 1. The problem in one sentence

One person is standing up wopta.org, a district calendar, a Google Workspace, and the templates for how a PTA could organize. If that person is unavailable for a month, every PTA that adopted any of it must keep working, and the Council must be able to find, understand, and hand off what exists. Leiðangr's job here is to be the map and the template shop, never the thing a PTA runs on.

## 2. The principle: leaves stand alone, the nexus points

Every durable asset a PTA relies on is a **leaf**: owned by that PTA, hosted somewhere generic, operable by hand.

| Leaf | Where it lives | Runs without Leiðangr? | Runs without SiliconSaga? |
|---|---|---|---|
| The PTA's website | a GitHub Pages repo in an org the PTA controls | yes | yes; Pages builds it |
| The PTA's calendar | a Google Calendar owned by a PTA account | yes | yes |
| The PTA's family list | a Google Group | yes | yes |
| This year's Fall Festival | a directory in the PTA's repo: flyer, shift list, checklist | yes | yes |
| The after-action report | a `saga.md` in that directory | yes | yes |
| The PTA's catalog descriptor | `catalog-info.yaml` in the PTA's repo | yes; it is inert YAML until something reads it | yes |

The **nexus** is Leiðangr plus the paved-path templates. It reads the leaves, renders an overview, and mints new leaves from templates. It never holds state a leaf needs. This is the devex reference's "each organization owns its own public edge that we update but it never depends on us", applied to a whole district, and it is the same discipline the Phase 3 design already imposes on TeamSnap and Google Workspace: referenced, published to one-way, never two-master.

Two corollaries the rest of the design follows:

- **Every automation has a manual twin.** Whatever a template or a job does, a runbook in the leaf's own README says how a person does it by hand. The wopta.org README already carries the calendar runbook; that is the pattern.
- **Backstage's database is a cache.** ADR 0008 says it for Sagas; here it holds for everything. A wiped instance re-ingests the leaves and is whole again.

## 3. The catalog shape

No new kinds. Built-ins plus the shipped `Cycle` and `Saga`, following the Phase 3 conventions.

```text
Domain: west-orange                 (spec.type: community)
 └─ Group: wocpta                   (spec.type: organization — the Council)
     ├─ Group: pta-mpe              (spec.type: pta)
     │   ├─ Group: pta-mpe-board    (spec.type: board)
     │   └─ Group: pta-mpe-…        (spec.type: committee, optional)
     ├─ Group: pta-gregory          (spec.type: pta)
     └─ … one per school, eleven today

Per PTA, declared in the PTA's own repo:
  Component: mpe-site               (spec.type: website, owner: pta-mpe)
  Resource:  mpe-calendar           (spec.type: calendar, owner: pta-mpe)
             annotations: siliconsaga.org/calendar-provider: google
                          siliconsaga.org/calendar-ref: <calendar id>
                          siliconsaga.org/ics: <public ICS URL>
  Cycle:     mpe-fall-festival-2026 (spec.type: production, of: group:default/pta-mpe)
  Saga:      mpe-fall-festival-2026 (saga-doc: ./events/fall-festival-2026/saga.md)

District-level, declared in the wopta.org repo:
  Component: wopta-site             (spec.type: website, owner: wocpta)
  Resource:  district-calendar      (spec.type: calendar, ics: the Finalsite feed)
```

Notes on the shape:

- **`Group` slugs are the shared key.** `pta-mpe` matches `_data/calendars.yml` on wopta.org, the intended subdomain `mpe.wopta.org`, and knarr's `group/pta-mpe` scope. One name, four systems, and it is the human-readable one. This is deliberately the slug decision knarr's community-reach design made, applied here so nobody has to translate.
- **The calendar is a `Resource`**, which gives the devex reference's *publishing front* a catalog citizen without inventing a kind. The reservable-space annotations from Phase 3 are not used; a PTA calendar is not a bookable substrate, it is the thing published *to*.
- **An event is a `Cycle` while it groups occurrences** (rehearsals plus show night, a week of book fair) and an occurrence otherwise, queried from the calendar. The Phase 3 line holds unchanged.
- **The Council is a `Group` like any other**, owning the district site and calendar. It is also the natural durable owner of wopta.org and the templates once it exists as an organization on GitHub, which §7 comes back to.
- **Two directions of ingestion**, both one-way. Leiðangr reads each PTA's `catalog-info.yaml` from Git. wopta.org's `_data/calendars.yml` stays a hand-edited leaf; a later scheduled job may open a pull request against it from the catalog, and if that job never runs the file is still correct. Nothing on wopta.org calls the Backstage API at build time.

### Seeding today

There is one real PTA repo and no per-PTA repos for the other ten, so Phase 0 seeds the Council and the eleven `Group`s by hand under `examples/`, exactly as the MTL hierarchy was seeded: the same entity shapes a per-PTA repo will later declare, so the swap is a location change and not a remodel. The wopta.org repo gets a real `catalog-info.yaml` and a `type: url` location, the way `hygiene-testsite` is registered.

## 4. Paved paths: templates with two doors

ADR 0010's rule applies unchanged: each paved path is a Scaffolder `Template` for the Create page and a `SKILL.md` for an agent, both reading the same source. The templates live in one repo, `pta-paved-paths` (name provisional), registered in `app-config.yaml` as URL locations the way volundr's aspect is. The repo is a leaf too: a PTA can clone it and run the agent door with no Backstage anywhere.

| Template | Produces | Leaf it writes to |
|---|---|---|
| `new-pta-site` | A Pages repo in the wopta.org shape: `_config.yml` `org:` block (legal name, EIN, address, mission, links), About page, calendar page, subscribe page, README runbooks, `catalog-info.yaml` with the Component and the calendar Resource. Optionally adopts the `website-hygiene` aspect in the same run. | a new repo in the PTA's org |
| `new-pta-calendar` | A public Google Calendar owned by the PTA's account, shared with its board with "make changes and manage sharing", the ID written back into the PTA's `catalog-info.yaml` and, by pull request, into wopta.org's calendar list. | the PTA's Google account; two repos |
| `new-pta-event-<name>` | One template **per recurring named event** (Fall Festival, Book Fair, Teacher Appreciation), per the devex reference: this year's instance as a self-contained directory (flyer from flyer-kit, shift sheet, checklist, `saga.md` skeleton), a `Cycle` entry in the PTA's descriptor, and a one-way calendar publish. | the PTA's repo and calendar |
| `join-wopta` | The Council-side act of adding a PTA: the `Group`, the subdomain CNAME, the calendar row on wopta.org, the Google Group. | wopta.org repo, DNS, Workspace |

Three things about the event templates specifically:

- **Pending, finalize, publish** is the lifecycle, as the devex reference specifies. The Scaffolder run opens a pull request; the calendar entry and the public page appear on merge. A volunteer can keep editing the event directory in GitHub's web editor long after the run, and if every SiliconSaga service is down the pull request and the directory are untouched.
- **The Saga skeleton is written at creation, not after.** The after-action report is the memory that survives turnover (the manifesto's whole argument), and a file that already exists with headings gets filled in; one that has to be created afterwards does not.
- **Templates are versioned like aspects.** A PTA that ran `new-pta-event-fall-festival` at release 1.0 reads as `behind` when 1.1 adds a step, the same equality check the website-hygiene aspect uses. Housekeeping folds this year's lessons back into the template at the annual cadence.

## 5. The first PTA-facing aspect: `pta-hygiene`

The Guildhall model gives a way to say "here is what a well-run PTA web presence looks like" without judging people: an aspect with a standard, trials computed from artifacts, medals derived. The trials are the things Google for Nonprofits, the state, and parents actually check:

| Block | Trial | Passes when |
|---|---|---|
| `identity` | `org-details-published` | the site's About page shows legal name, EIN, street address, and a mission (the `org:` block renders) |
| `identity` | `officers-link-current` | the officers link resolves and is not the site itself (the list lives where it is maintained) |
| `calendar` | `calendar-public` | the calendar's ICS URL returns `text/calendar` |
| `calendar` | `calendar-linked` | the site's calendar page carries the subscribe links for that calendar |
| `reach` | `subscribe-page-present` | a subscribe page exists listing every channel the PTA declares (§6) |
| `privacy` | `no-child-names` | **attested**, not computed: a board member confirms the public calendar carries no children's names |

The fact source design's closed check vocabulary gains one type, `url-probe` (status, content type, contains), because two of these trials are about a URL rather than a file. The attestation trial is the case that design deferred with the `attested | todo` axis; a PTA standard is a good reason to build it, since the most important check here is one a machine cannot make.

Medals stay derived and equal-weighted per ADR 0013, so a new PTA with a site and a public calendar is at bronze on day one and the ladder reads as progress rather than as a grade. The Council overview lists every PTA's medal, which is the honest answer to "how is the district doing" that does not require anyone to open eleven sites.

## 6. Communication preferences as catalog data

The knarr designs make presentation and digest behaviour configurable per scope: `summarized` versus `raw_threaded` per room, a `DigestSpec` per group, channels with native membership as the subscription store. Today those live in knarr's config. A PTA should state them once, in the leaf it owns, and every system should read them from there.

Annotations on the PTA's `Group`, in its `catalog-info.yaml`:

```yaml
metadata:
  annotations:
    siliconsaga.org/channels: whatsapp, facebook-group, google-group, calendar
    siliconsaga.org/digest: weekly            # weekly | none
    siliconsaga.org/digest-day: sunday
    siliconsaga.org/ai-summaries: opt-out     # opt-in | opt-out; maps to raw_threaded
    siliconsaga.org/public-contact: none      # none | email; wopta's calendar page respects this
    siliconsaga.org/languages: en, es
```

Leiðangr renders these on the PTA's entity page as "how this PTA communicates", which is the documentation the Council never had. knarr's config generation reads the same annotations **from Git, never from the Backstage API at runtime**, so a knarr digest keeps running while Leiðangr is down and a PTA can change its preferences with a pull request to its own repo. The annotation names are provisional; the rule that they are the PTA's to set, in the PTA's file, is the design.

## 7. Bus factor, stated as rules

These are the constraints that make §2 true rather than aspirational. Each is checkable, and several belong in the `pta-hygiene` standard's next release.

1. **Repos live in an organization with at least two owners.** `mpe-wopta` is an org already; the personal-account shape is not allowed for a leaf. The Council should become an org and take ownership of wopta.org and `pta-paved-paths` once it has two people willing to hold the keys.
2. **Calendars and Groups are owned by a role account, shared to at least two officers with manage rights.** The WOPTA Workspace hosts a PTA's calendar only until that PTA has its own account; moving it is a share-and-transfer, documented in the runbook.
3. **Domain and DNS have two administrators.** Each PTA's subdomain is a CNAME to that PTA's own Pages site, so if wopta.org lapses a PTA changes one `CNAME` file and is back on its own domain within the hour.
4. **Every automation has a manual twin in the leaf's README** (§2). A template that cannot be described as steps a person could follow is not finished.
5. **Credentials never live in a leaf.** Workspace service-account keys and GitHub tokens sit in OpenBao for the nexus and nowhere in a PTA repo, which is volundr's rule extended: the paved road holds no secrets.
6. **The instance is rebuildable from Git.** A fresh Leiðangr with the location list re-ingests the district. The location list itself is committed.

## 8. Google Workspace as a leaf provider

The Workspace activation makes calendars and groups creatable by API, which is what `new-pta-calendar` and `join-wopta` need. The mechanism, so the templates are not designed against a guess:

- A Google Cloud project under the wopta.org organization holds one **service account with domain-wide delegation**, authorized in the Admin console for the Admin SDK Directory scope (users, groups) and the Calendar scope. It acts *as* an admin user, so every call is attributable.
- **GAM** is the operator's CLI for the same operations from a terminal (create a user, create a calendar, set ACLs, add group members) and is how a human performs the manual twin.
- Scaffolder actions call the same APIs through a thin backend module; the key is an OpenBao secret projected into the Leiðangr backend, never in a template.
- Public calendars need the Admin console's external sharing setting to allow full event details, or every embed shows free/busy blocks. This is one setting, once, and it belongs in the Workspace runbook.

The Workspace is a leaf provider, not a nexus: a PTA's calendar created there is theirs, and if the WOPTA Workspace lapses, Google's own export and ownership-transfer paths apply with no SiliconSaga code in the way.

## 9. Phasing

Ordered so each step leaves a working district behind it.

- **Phase 0 — declare what exists.** Seed the Council and eleven `Group`s under `examples/`; add `catalog-info.yaml` to wopta.org (Component, calendar Resource, the annotations from §6 for Mount Pleasant) and register it. *Exit: the Council and every PTA appear in the catalog; Mount Pleasant's page links its site, calendar, and preferences.*
- **Phase 1 — `new-pta-site` and its agent twin.** Generalize the wopta.org shape into a template; prove it by creating a second PTA's site from it. *Exit: a site for one more PTA exists, made from the template, with its descriptor registered.*
- **Phase 2 — `new-pta-calendar` and `join-wopta`** on the Workspace service account, plus GAM runbooks as the manual twin. *Exit: a calendar created by the template is public, shared with two officers, and on wopta.org's calendar page by merged pull request.*
- **Phase 3 — one event template**, the first recurring event Mount Pleasant runs, with the `Cycle`, the directory, the calendar publish, and the Saga skeleton. *Exit: one real event ran from the template and its Saga was written.*
- **Phase 4 — `pta-hygiene`** with `url-probe` and the attestation axis, and the Council overview showing medals. *Exit: every PTA in the catalog has a medal or a stated reason for none.*
- **Phase 5 — preferences feed knarr**: knarr's digest and presentation config generated from the §6 annotations read out of Git. *Exit: changing a PTA's digest day by pull request changes when its digest arrives.*

## 10. Deferred, with the reason

- **Skill inventory, proposal workflow, commitment tracking** (manifesto module 13). They are the volunteer-marketplace half of the umbrella design and belong to Ting and the Phase 4 store, not to this note. The catalog shape here is what they will hang off.
- **A Council-level Backstage instance of its own.** Not until the Council has people to run it. Until then this instance is the nexus and the leaves are what the Council owns.
- **Subdomain automation.** DNS has two humans; a template can print the record to add.
- **Per-PTA Workspace accounts as a general offer.** A calendar and a Group per PTA are enough; user accounts are a PTA-by-PTA conversation.

## 11. Open questions

1. Where do the paved-path templates live: a SiliconSaga repo, the `mpe-wopta` org, or a future Council org? The design only requires that it be a leaf with two owners.
2. Does the `Cycle` for an event carry the calendar event's UID, so a Saga can be reached from the calendar and back? Cheap, and it would make the calendar the index into the memory.
3. Whether `pta` deserves to be a `Group` `spec.type` of its own or is `organization` under a Council `organization`. The vocabulary is open; consistency with the MTL seed (`organization → sport → team`) suggests `organization → pta → board`.
4. How much of `_config.yml`'s `org:` block should be *derived* from the catalog descriptor rather than duplicated. Today the site is the source; that is the right default for a leaf, and the descriptor should copy it rather than the other way round.
