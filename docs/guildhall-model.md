# Guildhall model — entity relationships

How the five Guildhall concepts map onto Backstage entity kinds and relate to each other.

## Concept map

```mermaid
graph TD
    subgraph "People layer"
        SKILL["Skill (vocabulary term on a person's profile)"]
        CRAFT["Craft / Role (skill bundle; what staffing asks for)"]
        GILDI["Gildi / Guild (Group spec.type:gildi) — the fellowship"]
    end

    subgraph "Concern layer"
        PRACTICE["Practice (the living institution; Component spec.type:practice)"]
        ASPECT["Aspect module (the versioned repo — standard + paved road + grafts)"]
    end

    subgraph "Measurement layer"
        STANDARD["Standard (Git-backed YAML; blocks of trials, tiered)"]
        BLOCK["Block (tool/sub-concern group; scoped by facets)"]
        TIER["Tier (bronze / silver / gold; ladders across blocks)"]
        TRIAL["Trial (a single check; declares a remediation vísir)"]
    end

    subgraph "Procedure layer"
        VISAR["Vísir (procedure doc; teaching or operational grade)"]
    end

    subgraph "Software layer"
        COMPONENT["Component (enrolled via annotation: siliconsaga.org/aspects)"]
        CYCLE["Cycle (custom kind; bounded effort — release or drive)"]
        SAGA["Saga (custom kind; narrated retrospective)"]
    end

    SKILL -->|"bundled into"| CRAFT
    CRAFT -->|"answered by members of"| GILDI
    GILDI -->|"runs"| PRACTICE
    PRACTICE -->|"ships"| ASPECT
    ASPECT -->|"contains"| STANDARD
    STANDARD -->|"organises trials into"| BLOCK
    STANDARD -->|"ladders trials across"| TIER
    BLOCK -->|"contains"| TRIAL
    TIER -->|"references"| TRIAL
    TRIAL -->|"remediation links to"| VISAR
    COMPONENT -->|"enrolled in"| ASPECT
    COMPONENT -->|"links operational"| VISAR
    CYCLE -->|"measured by"| STANDARD
    SAGA -->|"narrates"| CYCLE
```

## The split that carries the model

> **Crafts are what people do. Aspects are what components adopt. Standards are what they must then uphold.**

- A **craft** (Role) is demand-side: what a staffing request asks for.
- An **aspect** is supply-side: what a component takes on when it enrolls.
- A **standard** is the bar: a set of checks, organized by tool (blocks) and maturity (tiers).

## Graft — two doors, one module

```mermaid
flowchart LR
    PORTAL["Portal user (Create page)"] -->|"clicks"| TEMPLATE["Template spec.type:aspect (template.yaml)"]
    AGENT["Agent / CLI user (terminal)"] -->|"reads"| SKILL_MD["SKILL.md (agent graft)"]
    TEMPLATE -->|"same steps"| MODULE["Aspect module repo (standard + paved road + remediation docs)"]
    SKILL_MD -->|"same steps"| MODULE
    MODULE -->|"enrolls"| COMPONENT2["Target Component (annotation added, CI includes adopted, stubs scaffolded)"]
```

## Facets — solving the multi-natured component

```mermaid
flowchart LR
    C["Component spec.type:service"] -->|"type suggests"| DEF["default facets: api"]
    C -->|"annotation overrides"| OVR["siliconsaga.org/facets: api, batch"]
    OVR -->|"widens to"| B1["dependency-hygiene block (applies to: api, web-ui)"]
    OVR -->|"widens to"| B2["static-analysis block (applies to: api, web-ui)"]
    OVR -->|"always applies"| B3["secrets block (applies to: *)"]
    OVR -->|"always applies"| B4["stewardship block (applies to: *)"]
```
