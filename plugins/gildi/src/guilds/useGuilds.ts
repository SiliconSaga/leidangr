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
