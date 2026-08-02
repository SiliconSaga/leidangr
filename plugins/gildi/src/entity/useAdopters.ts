import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';

const ASPECTS = 'siliconsaga.org/aspects';
const ASPECT_VERSIONS = 'siliconsaga.org/aspect-versions';

export interface AdopterView {
  name: string;
  title: string;
  entityRef: string;
  version?: string;
}

// Components that adopted a given aspect: those whose siliconsaga.org/aspects
// annotation (comma-separated ids) includes the aspect, with the adopted version
// parsed from siliconsaga.org/aspect-versions ("<id>@<version>").
export function useAdopters(aspectId?: string) {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    if (!aspectId) return [];
    const res = await catalog.getEntities({ filter: { kind: 'Component' } });
    return res.items.reduce<AdopterView[]>((acc, c) => {
      const aspects = (c.metadata.annotations?.[ASPECTS] ?? '')
        .split(',').map(s => s.trim()).filter(Boolean);
      if (!aspects.includes(aspectId)) return acc;
      const version = (c.metadata.annotations?.[ASPECT_VERSIONS] ?? '')
        .split(',').map(s => s.trim())
        .map(s => s.split('@'))
        .find(([id]) => id === aspectId)?.[1];
      acc.push({
        name: c.metadata.name,
        title: c.metadata.title ?? c.metadata.name,
        entityRef: stringifyEntityRef(c),
        version,
      });
      return acc;
    }, []);
  }, [catalog, aspectId]);
  return { adopters: state.value ?? [], loading: state.loading, error: state.error };
}
