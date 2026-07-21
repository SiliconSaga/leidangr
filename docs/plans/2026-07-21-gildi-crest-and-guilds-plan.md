# Guild Hall hub (`gildi`) — Plan 2: Crest module + Guilds section

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Guild Hall placeholder with its first real section — a grid of curated **guild cards**, each led by a **generated heraldic crest** — backed by typed catalog search. Plus a plain plugin README.

**Architecture:** A self-contained, deterministic **crest generator** (pure functions → an inline SVG `Crest` component) forms the visual keystone. A `useGuilds` hook queries the catalog (`kind:Group, spec.type:guild`) via `catalogApiRef`; a `GuildCard` composes the crest with the guild's name, description, stewards, and its practice/aspect chips; a `GuildsSection` renders the responsive grid and mounts into `GuildHallPage`. First frontend catalog-querying in the repo.

**Tech Stack:** Backstage 1.52 new frontend system, `@backstage/plugin-catalog-react@^3.1.0` (`catalogApiRef`, `EntityRefLink`), `@backstage/core-components`, `@backstage/frontend-test-utils`, React 18, TypeScript ~5.8.

## Global Constraints

- Node **22 || 24**; Yarn **4.13** via Corepack. Build/test through `ws`: `ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi <tsc|test>`, `ws test leidangr` (= `make ci`). Commit via `ws commit leidangr <bodyfile>`; one shell command per call; no raw `git commit`/`push`.
- **New frontend system only.** Keep the plugin's public surface stable (`gildiPlugin` default export, `rootRouteRef`, `GuildHallPage`).
- **Presentation is a first-class goal** — curated cards, never a raw metadata dump. Clean display names + a brief description.
- **Crests are deterministic** from the group id/name (same input → same arms), honour the **rule of tincture** (a colour field pairs with a metal charge, or vice versa), render as **inline SVG** (no assets, no network), and fall back to a **monogram** if generation is disabled. Guilds only in v1.
- **Guild data model** (from the seed): guilds are `Group` `spec.type: guild` with a `siliconsaga.org/stewards` annotation (e.g. `aspect:security`); practices are `Component` `spec.type: practice` with `spec.owner` = the guild; the practice's aspect is on its `siliconsaga.org/aspect` annotation.
- Design source of truth: `docs/plans/2026-07-20-gildi-guildhall-hub-design.md` §4 (card system), §5 (crests), §7 (data model).
- Verify catalog-react / hook imports (`useApi`, `catalogApiRef`, `useAsync`) against the installed package versions — the `tsc`/build gate is the safety net, as in Plan 1.

---

### Task 0: Plugin README

**Files:** Create `plugins/gildi/README.md`

- [ ] **Step 1: Write the README** (`plugins/gildi/README.md`):
```markdown
# @siliconsaga/plugin-gildi

The **Guild Hall** — a curated overview of the practice layer for this Backstage instance: the guilds, their practices and aspects, active drives, and recent sagas. Built on Backstage's new frontend system.

## Status

Foundation shipped: a page at `/guild-hall` with a sidebar entry. Sections land incrementally (guilds first). See `docs/plans/2026-07-20-gildi-guildhall-hub-design.md` in the leidangr repo for the full design.

## Install

Registered in the app's `features` (see `packages/app/src/App.tsx`):

    import gildiPlugin from '@siliconsaga/plugin-gildi';
    // ...
    features: [/* … */, gildiPlugin]

## Development

    ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi test

This package is developed inside the leidangr instance for now; its package name (`@siliconsaga/*`) is scoped for later extraction to a standalone plugin repo.
```

- [ ] **Step 2: Commit.** Bodyfile `.commits/gildi-readme.md` (`add: plugins/gildi/README.md`), message `docs(gildi): add plugin README`. Run `ws commit leidangr .commits/gildi-readme.md`.

---

### Task 1: The heraldic crest generator

**Files:**
- Create `plugins/gildi/src/crest/hash.ts`
- Create `plugins/gildi/src/crest/blazon.ts`
- Create `plugins/gildi/src/crest/Crest.tsx`
- Create `plugins/gildi/src/crest/blazon.test.ts`
- Create `plugins/gildi/src/crest/index.ts`

**Interfaces:**
- Produces: `blazonFor(seed: string): Blazon` (deterministic); `<Crest seed={string} size={number} />` (inline SVG); `Blazon` type. Task 2's `GuildCard` consumes `<Crest seed={guildName} />`.

- [ ] **Step 1: Deterministic hash** (`plugins/gildi/src/crest/hash.ts`):
```ts
// FNV-1a 32-bit — stable across runs/machines (no Math.random / Date).
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
```

- [ ] **Step 2: Write the failing blazon test** (`plugins/gildi/src/crest/blazon.test.ts`):
```ts
import { blazonFor } from './blazon';

describe('blazonFor', () => {
  it('is deterministic for the same seed', () => {
    expect(blazonFor('security-gildi')).toEqual(blazonFor('security-gildi'));
  });
  it('honours the rule of tincture (field colour ↔ charge metal or vice versa)', () => {
    const metals = ['or', 'argent'];
    for (const seed of ['a', 'security-gildi', 'release-captains-gildi', 'platform', 'data', 'zzz']) {
      const b = blazonFor(seed);
      // rule of tincture: exactly one of field/charge is a metal (colour on metal, or metal on colour)
      expect(metals.includes(b.fieldTincture)).not.toEqual(metals.includes(b.chargeTincture));
    }
  });
  it('produces distinct arms for distinct seeds', () => {
    const a = blazonFor('security-gildi');
    const b = blazonFor('release-captains-gildi');
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** (`blazonFor` not defined): `ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi test crest/blazon`.

- [ ] **Step 4: Implement the blazon** (`plugins/gildi/src/crest/blazon.ts`):
```ts
import { hashSeed } from './hash';

export const COLOURS = { gules: '#a83a3a', azure: '#2f5fa0', vert: '#3a7a4a', sable: '#2b2b30', purpure: '#6b3a6b' } as const;
export const METALS = { or: '#d9b23a', argent: '#dcdce0' } as const;
export type Tincture = keyof typeof COLOURS | keyof typeof METALS;
export type Division = 'plain' | 'perPale' | 'perFess' | 'perBend';
export type Charge = 'key' | 'chevron' | 'mullet' | 'roundel' | 'cross';
export interface Blazon {
  division: Division;
  fieldTincture: Tincture;   // the field (may be two tinctures for divided fields; second derives)
  fieldTincture2: Tincture;
  chargeTincture: Tincture;
  charge: Charge;
  fieldIsColour: boolean;    // true → charge is a metal (rule of tincture)
}

const COLOUR_KEYS = Object.keys(COLOURS) as (keyof typeof COLOURS)[];
const METAL_KEYS = Object.keys(METALS) as (keyof typeof METALS)[];
const DIVISIONS: Division[] = ['plain', 'perPale', 'perFess', 'perBend'];
const CHARGES: Charge[] = ['key', 'chevron', 'mullet', 'roundel', 'cross'];

export function blazonFor(seed: string): Blazon {
  const h = hashSeed(seed);
  // Draw independent choices from different byte-lanes of the hash.
  const fieldIsColour = (h & 1) === 0;
  const colour = COLOUR_KEYS[(h >>> 1) % COLOUR_KEYS.length];
  const colour2 = COLOUR_KEYS[(h >>> 4) % COLOUR_KEYS.length];
  const metal = METAL_KEYS[(h >>> 7) % METAL_KEYS.length];
  const division = DIVISIONS[(h >>> 9) % DIVISIONS.length];
  const charge = CHARGES[(h >>> 12) % CHARGES.length];
  return {
    division,
    fieldTincture: fieldIsColour ? colour : metal,
    fieldTincture2: fieldIsColour ? colour2 : metal,
    chargeTincture: fieldIsColour ? metal : colour,
    charge,
    fieldIsColour,
  };
}

export function tinctureHex(t: Tincture): string {
  return (COLOURS as Record<string, string>)[t] ?? (METALS as Record<string, string>)[t];
}
```

- [ ] **Step 5: Run the test, expect PASS**: `ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi test crest/blazon`. Fix until green (in particular the rule-of-tincture assertion: exactly one of field/charge is a metal).

- [ ] **Step 6: The Crest SVG component** (`plugins/gildi/src/crest/Crest.tsx`) — renders a heater shield clipped to its outline, a field (with optional division), and the charge; monogram fallback:
```tsx
import { blazonFor, tinctureHex, Charge } from './blazon';

const SHIELD = 'M9 7 L51 7 L51 33 Q51 52 30 63 Q9 52 9 33 Z';

function ChargeShape({ charge, fill }: { charge: Charge; fill: string }) {
  switch (charge) {
    case 'key': return (<g><circle cx="30" cy="24" r="6" fill="none" stroke={fill} strokeWidth="3.2" /><rect x="28.6" y="29" width="2.8" height="23" fill={fill} /><rect x="31.4" y="45" width="5" height="2.6" fill={fill} /></g>);
    case 'chevron': return <polygon points="17,47 30,33 43,47 43,41 30,27 17,41" fill={fill} />;
    case 'mullet': return <polygon points="30,21 33.4,30 42.6,30 35.2,36 38.4,45.5 30,39.5 21.6,45.5 24.8,36 17.4,30 26.6,30" fill={fill} />;
    case 'roundel': return <circle cx="30" cy="33" r="7" fill={fill} />;
    case 'cross': return <g><rect x="27" y="18" width="6" height="30" fill={fill} /><rect x="18" y="27" width="24" height="6" fill={fill} /></g>;
  }
}

export function Crest({ seed, size = 44, title }: { seed: string; size?: number; title?: string }) {
  if (!seed) return null;
  const b = blazonFor(seed);
  const id = `gildi-crest-${seed.replace(/[^a-z0-9]/gi, '')}`;
  const f1 = tinctureHex(b.fieldTincture);
  const f2 = tinctureHex(b.fieldTincture2);
  const charge = tinctureHex(b.chargeTincture);
  return (
    <svg width={size} height={(size * 70) / 60} viewBox="0 0 60 70" role="img" aria-label={title ?? `Arms of ${seed}`}>
      <defs><clipPath id={id}><path d={SHIELD} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        {b.division === 'plain' && <rect width="60" height="70" fill={f1} />}
        {b.division === 'perPale' && (<><rect x="0" width="30" height="70" fill={f1} /><rect x="30" width="30" height="70" fill={f2} /></>)}
        {b.division === 'perFess' && (<><rect y="0" width="60" height="35" fill={f1} /><rect y="35" width="60" height="35" fill={f2} /></>)}
        {b.division === 'perBend' && (<><rect width="60" height="70" fill={f1} /><polygon points="0,70 60,70 60,0" fill={f2} /></>)}
        <ChargeShape charge={b.charge} fill={charge} />
      </g>
      <path d={SHIELD} fill="none" stroke="#e8e8ee" strokeWidth="1.5" opacity="0.85" />
    </svg>
  );
}
```

- [ ] **Step 7: Barrel export** (`plugins/gildi/src/crest/index.ts`):
```ts
export { Crest } from './Crest';
export { blazonFor, tinctureHex, COLOURS, METALS } from './blazon';
export type { Blazon, Tincture, Charge, Division } from './blazon';
```

- [ ] **Step 8: Typecheck + full package test**: `ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi tsc` then `... test`. Both green.

- [ ] **Step 9: Commit.** `.commits/gildi-crest.md` (`add: plugins/gildi/src/crest`), message `feat(gildi): deterministic heraldic crest generator`. `ws commit leidangr .commits/gildi-crest.md`.

---

### Task 2: The Guilds section (typed catalog search + guild cards)

**Files:**
- Create `plugins/gildi/src/guilds/useGuilds.ts`
- Create `plugins/gildi/src/guilds/GuildCard.tsx`
- Create `plugins/gildi/src/guilds/GuildsSection.tsx`
- Create `plugins/gildi/src/guilds/GuildsSection.test.tsx`
- Modify `plugins/gildi/src/components/GuildHallPage.tsx` (mount the section)
- Modify `plugins/gildi/package.json` (already declares `@backstage/plugin-catalog-react`; add `@backstage/core-plugin-api` if `useApi` resolves there)

**Interfaces:**
- Consumes: `<Crest seed={string} />` from Task 1.
- Produces: `useGuilds()` → `{ guilds: GuildView[], loading, error }`; `<GuildsSection />`. Later slices reuse `GuildView` shaping.

- [ ] **Step 1: The data hook** (`plugins/gildi/src/guilds/useGuilds.ts`) — one query for guilds, one for practices, joined by owner. Verify `useApi`'s import source against the installed packages (`@backstage/core-plugin-api` or `@backstage/frontend-plugin-api`):
```ts
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';

export interface GuildView {
  name: string;
  title: string;
  description?: string;
  entityRef: string;                 // e.g. group:default/security-gildi
  stewardAspects: string[];          // from siliconsaga.org/stewards: 'aspect:security'
  practices: { name: string; title: string; aspect?: string }[];
}

const STEWARDS = 'siliconsaga.org/stewards';
const ASPECT = 'siliconsaga.org/aspect';

export function useGuilds() {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const [guildsRes, practicesRes] = await Promise.all([
      catalog.getEntities({ filter: { kind: 'Group', 'spec.type': 'guild' } }),
      catalog.getEntities({ filter: { kind: 'Component', 'spec.type': 'practice' } }),
    ]);
    const practicesByOwner = new Map<string, Entity[]>();
    for (const p of practicesRes.items) {
      const owner = (p.spec?.owner as string) ?? '';
      const key = owner.includes('/') ? owner : `group:default/${owner.replace(/^group:/, '')}`;
      practicesByOwner.set(key, [...(practicesByOwner.get(key) ?? []), p]);
    }
    const guilds: GuildView[] = guildsRes.items.map(g => {
      const ref = `group:default/${g.metadata.name}`;
      const stewards = (g.metadata.annotations?.[STEWARDS] ?? '')
        .split(',').map(s => s.trim()).filter(Boolean)
        .filter(s => s.startsWith('aspect:')).map(s => s.slice('aspect:'.length));
      const practices = (practicesByOwner.get(ref) ?? []).map(p => ({
        name: p.metadata.name,
        title: p.metadata.title ?? p.metadata.name,
        aspect: p.metadata.annotations?.[ASPECT],
      }));
      return {
        name: g.metadata.name,
        title: g.metadata.title ?? g.metadata.name,
        description: g.metadata.description,
        entityRef: ref,
        stewardAspects: stewards,
        practices,
      };
    });
    return guilds;
  }, [catalog]);
  return { guilds: state.value ?? [], loading: state.loading, error: state.error };
}
```

- [ ] **Step 2: The guild card** (`plugins/gildi/src/guilds/GuildCard.tsx`) — crest + name + description + practice/aspect chips; whole card links to the entity page:
```tsx
import { Link } from '@backstage/core-components';
import { Crest } from '../crest';
import type { GuildView } from './useGuilds';

export function GuildCard({ guild }: { guild: GuildView }) {
  const aspects = Array.from(new Set([
    ...guild.stewardAspects,
    ...guild.practices.map(p => p.aspect).filter(Boolean) as string[],
  ]));
  return (
    <Link to={`/catalog/default/group/${guild.name}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ display: 'flex', gap: 14, border: '1px solid rgba(128,128,128,.3)', borderRadius: 12, padding: 14, height: '100%' }}>
        <Crest seed={guild.name} size={48} title={`Arms of ${guild.title}`} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: 15 }}>{guild.title}</div>
          {guild.description && <div style={{ fontSize: 12.5, opacity: 0.78, margin: '4px 0 8px', lineHeight: 1.5 }}>{guild.description}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {guild.practices.map(p => (<span key={p.name} style={chip('#6366f1')}>{p.title}</span>))}
            {aspects.map(a => (<span key={a} style={chip('#10b981')}>{a} aspect</span>))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function chip(c: string): React.CSSProperties {
  return { fontSize: 10.5, padding: '2px 8px', borderRadius: 20, border: `1px solid ${c}80`, background: `${c}1a` };
}
```

- [ ] **Step 3: The section** (`plugins/gildi/src/guilds/GuildsSection.tsx`) — grid + loading/empty/error:
```tsx
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useGuilds } from './useGuilds';
import { GuildCard } from './GuildCard';

export function GuildsSection() {
  const { guilds, loading, error } = useGuilds();
  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (guilds.length === 0) return <p style={{ opacity: 0.7 }}>No guilds yet — define a Group with <code>spec.type: guild</code>.</p>;
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
      {guilds.map(g => (<GuildCard key={g.name} guild={g} />))}
    </div>
  );
}
```

- [ ] **Step 4: Mount into the page** (`plugins/gildi/src/components/GuildHallPage.tsx`) — replace the placeholder paragraph:
```tsx
import { Content, Header, Page } from '@backstage/core-components';
import { GuildsSection } from '../guilds/GuildsSection';

export function GuildHallPage() {
  return (
    <Page themeId="home">
      <Header title="Guild Hall" subtitle="The practice layer — guilds, their practices and aspects, drives, and sagas" />
      <Content>
        <h2 style={{ marginTop: 0 }}>Guilds</h2>
        <GuildsSection />
      </Content>
    </Page>
  );
}
```

- [ ] **Step 5: Write the failing section test** (`plugins/gildi/src/guilds/GuildsSection.test.tsx`) — mock `catalogApiRef`, assert curated rendering:
```tsx
import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { GuildsSection } from './GuildsSection';

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter['spec.type'] === 'guild') {
      return { items: [{ apiVersion: 'backstage.io/v1alpha1', kind: 'Group', metadata: { name: 'security-gildi', title: 'Security guild', description: 'Keeps things safe.', annotations: { 'siliconsaga.org/stewards': 'aspect:security' } }, spec: { type: 'guild' } }] };
    }
    return { items: [{ apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name: 'security-practice', title: 'Security practice', annotations: { 'siliconsaga.org/aspect': 'security' } }, spec: { type: 'practice', owner: 'group:default/security-gildi' } }] };
  },
};

describe('GuildsSection', () => {
  it('renders a curated guild card with name, description, practice and aspect', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <GuildsSection />
      </TestApiProvider>,
    );
    expect(await screen.findByText('Security guild')).toBeInTheDocument();
    expect(screen.getByText('Keeps things safe.')).toBeInTheDocument();
    expect(screen.getByText('Security practice')).toBeInTheDocument();
    expect(screen.getByText('security aspect')).toBeInTheDocument();
  });
});
```
(Verify `TestApiProvider` is exported by `@backstage/frontend-test-utils` at the installed version; if not, import it from `@backstage/core-app-api`'s test utils equivalent surfaced for the new system — the build/test gate confirms.)

- [ ] **Step 6: Run the section test**: `ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi test guilds`. Iterate (import sources, entity shapes) until PASS.

- [ ] **Step 7: Full gate**: `ws test leidangr` (make ci). Must PASS.

- [ ] **Step 8 (human-gated — do NOT attempt): Visual check** — `make dev`, open `/guild-hall`, confirm the guild cards render with crests, names, descriptions, and practice/aspect chips, and clicking a card opens the guild's entity page. Note PENDING in the report.

- [ ] **Step 9: Commit.** `.commits/gildi-guilds.md` (`add: plugins/gildi/src/guilds`, `plugins/gildi/src/components/GuildHallPage.tsx`, `plugins/gildi/package.json` if changed), message `feat(gildi): Guilds section — typed catalog search + heraldic guild cards`. `ws commit leidangr .commits/gildi-guilds.md`.

---

## Self-Review

- **Spec coverage:** crest generator (design §5) → Task 1; guild card + typed search + section (§4/§7) → Task 2; README → Task 0. Drives/chronicle/actions, entity-page decoration, dogfood remain later plans.
- **Placeholder scan:** Task 1's blazon/crest code is complete and deterministic. Task 2's hook/card/section carry full code; the only flagged unknowns are import sources (`useApi`, `TestApiProvider`) and the exact `catalog.getEntities` filter typing — each has an explicit verify-against-installed note, with the `tsc`/test gate as backstop (the Plan-1 precedent).
- **Type consistency:** `blazonFor`/`Blazon`/`Crest`/`GuildView`/`useGuilds`/`GuildsSection` used consistently across tasks; `<Crest seed={guild.name} />` matches Task 1's signature.
- **Determinism:** crest uses FNV-1a over the seed — no `Math.random`/`Date`; the test asserts stability and the rule of tincture.
