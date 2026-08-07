import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { ASPECTS, ASPECT_VERSIONS, parseKeyed, parseList } from './aspects';

export interface AdopterView {
  name: string;
  title: string;
  entityRef: string;
  version?: string;
}

// Components that adopted a given aspect: those whose siliconsaga.org/aspects
// annotation includes it, with the adopted version from the aspect-versions
// map. Parsing is shared with the component-side card via ./aspects.
export function useAdopters(aspectId?: string) {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    if (!aspectId) return [];
    const res = await catalog.getEntities({
      filter: { kind: 'Component' },
      // only the fields the reducer reads — avoid pulling full Component bodies
      fields: ['kind', 'metadata.name', 'metadata.title', 'metadata.namespace', 'metadata.annotations'],
    });
    return res.items.reduce<AdopterView[]>((acc, c) => {
      if (!parseList(c.metadata.annotations?.[ASPECTS]).includes(aspectId)) return acc;
      acc.push({
        name: c.metadata.name,
        title: c.metadata.title ?? c.metadata.name,
        entityRef: stringifyEntityRef(c),
        version: parseKeyed(c.metadata.annotations?.[ASPECT_VERSIONS], '@').get(aspectId),
      });
      return acc;
    }, []);
  }, [catalog, aspectId]);
  return { adopters: state.value ?? [], loading: state.loading, error: state.error };
}
