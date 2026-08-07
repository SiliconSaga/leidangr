import { parseEntityRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';

// The guildhall adoption annotations. Component-side keys are MAPS keyed by
// aspect id; the practice-side key is a SCALAR — a practice maintains exactly
// one aspect, so its release can never become keyed. That shape difference is
// why the practice key is `module-release` and not `aspect-version`.
export const ASPECTS = 'siliconsaga.org/aspects';
export const ASPECT_VERSIONS = 'siliconsaga.org/aspect-versions';
export const ADOPTION_RECORD = 'siliconsaga.org/adoption-record';
export const ASPECT = 'siliconsaga.org/aspect';
export const MODULE_RELEASE = 'siliconsaga.org/module-release';

// 'a, b ,, a' -> ['a','b']. Deduped so callers get stable React keys.
export function parseList(value?: string): string[] {
  return [...new Set((value ?? '').split(',').map(s => s.trim()).filter(Boolean))];
}

// Comma-separated '<id><sep><value>' entries -> Map. Splits on the FIRST
// separator so a URL value keeps its own colons. Entries missing the
// separator, the id, or the value are dropped rather than half-guessed; a
// repeated id keeps its first entry.
export function parseKeyed(value: string | undefined, separator: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of (value ?? '').split(',')) {
    const at = entry.indexOf(separator);
    if (at < 0) continue;
    const id = entry.slice(0, at).trim();
    const v = entry.slice(at + separator.length).trim();
    if (id && v && !out.has(id)) out.set(id, v);
  }
  return out;
}

// Aspect ids are slugs ('operational-readiness'), but the hub design's card
// family rule is curated display names, never raw metadata. There is no aspect
// entity to carry a title — the registry is a raw file — so the card titles the
// slug rather than inventing an annotation for it.
export function aspectLabel(aspectId: string): string {
  const words = aspectId.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

export type AdoptionStatus = 'current' | 'behind' | 'unknown';

// Equality, never ordering: these are opaque module release tags and the
// registry has never committed to a versioning scheme, so 'behind' means
// 'differs from current' and the card must not claim how far.
export function adoptionStatus(adopted?: string, current?: string): AdoptionStatus {
  if (!adopted || !current) return 'unknown';
  return adopted === current ? 'current' : 'behind';
}

// The enrollment test behind the card filters — a blank or comma-only
// annotation counts as unenrolled, not as an empty enrollment.
export function hasAdoptedAspects(entity: Entity): boolean {
  return parseList(entity.metadata.annotations?.[ASPECTS]).length > 0;
}

// The stewarding guild's name, for seeding its crest. Undefined for a
// non-group or malformed owner rather than throwing — a bad ref should cost
// one crest, not the whole card.
export function guildNameOf(entity: Entity): string | undefined {
  const owner = (entity.spec?.owner as string) ?? '';
  if (!owner) return undefined;
  try {
    const ref = parseEntityRef(owner, { defaultKind: 'Group', defaultNamespace: 'default' });
    return ref.kind.toLowerCase() === 'group' ? ref.name : undefined;
  } catch {
    return undefined;
  }
}
