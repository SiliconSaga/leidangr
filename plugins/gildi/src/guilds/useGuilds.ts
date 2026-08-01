import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { stewardAspectsOf, indexPracticesByOwner, practiceView } from './roster';

export interface GuildView {
  name: string;
  title: string;
  description?: string;
  entityRef: string;                 // e.g. group:default/security-gildi
  stewardAspects: string[];          // from siliconsaga.org/stewards: 'aspect:security'
  practices: { name: string; title: string; aspect?: string }[];
}

export function useGuilds() {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const [guildsRes, practicesRes] = await Promise.all([
      catalog.getEntities({ filter: { kind: 'Group', 'spec.type': 'guild' } }),
      catalog.getEntities({ filter: { kind: 'Component', 'spec.type': 'practice' } }),
    ]);
    const practicesByOwner = indexPracticesByOwner(practicesRes.items);
    const guilds: GuildView[] = guildsRes.items.map(g => {
      const ref = stringifyEntityRef(g);
      const stewardAspects = stewardAspectsOf(g);
      const practices = (practicesByOwner.get(ref) ?? []).map(practiceView);
      return {
        name: g.metadata.name,
        title: g.metadata.title ?? g.metadata.name,
        description: g.metadata.description,
        entityRef: ref,
        stewardAspects,
        practices,
      };
    });
    return guilds;
  }, [catalog]);
  return { guilds: state.value ?? [], loading: state.loading, error: state.error };
}
