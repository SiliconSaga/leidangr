import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';
import { indexPracticesByOwner, practiceView, stewardAspectsOf } from '../guilds/roster';

export function useGuildRoster(guild: Entity) {
  const catalog = useApi(catalogApiRef);
  const ref = stringifyEntityRef(guild);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Component', 'spec.type': 'practice' } });
    const practices = (indexPracticesByOwner(res.items).get(ref) ?? []).map(practiceView);
    const aspects = Array.from(new Set([
      ...stewardAspectsOf(guild),
      ...practices.map(p => p.aspect).filter(Boolean) as string[],
    ]));
    return { practices, aspects };
  }, [catalog, ref]);
  return {
    practices: state.value?.practices ?? [],
    aspects: state.value?.aspects ?? [],
    loading: state.loading,
    error: state.error,
  };
}
