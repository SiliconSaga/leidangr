import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';

const STEWARDS = 'siliconsaga.org/stewards';
const ASPECT = 'siliconsaga.org/aspect';

export function stewardAspectsOf(guild: Entity): string[] {
  return (guild.metadata.annotations?.[STEWARDS] ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .filter(s => s.startsWith('aspect:')).map(s => s.slice('aspect:'.length));
}

export function indexPracticesByOwner(practices: Entity[]): Map<string, Entity[]> {
  const byOwner = new Map<string, Entity[]>();
  for (const p of practices) {
    const owner = (p.spec?.owner as string) ?? '';
    if (!owner) continue;
    let key: string;
    try {
      key = stringifyEntityRef(parseEntityRef(owner, { defaultKind: 'Group', defaultNamespace: 'default' }));
    } catch {
      continue; // skip a malformed owner rather than failing the whole section
    }
    byOwner.set(key, [...(byOwner.get(key) ?? []), p]);
  }
  return byOwner;
}

export function practiceView(p: Entity): { name: string; title: string; aspect?: string } {
  return {
    name: p.metadata.name,
    title: p.metadata.title ?? p.metadata.name,
    aspect: p.metadata.annotations?.[ASPECT],
  };
}
