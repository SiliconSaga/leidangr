import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export interface DriveView {
  name: string; title: string; description?: string;
  entityRef: string;                 // cycle:default/<name>
  ownerGuildName?: string;           // for the crest, when owner is a guild Group
  start?: string; end?: string;
}

export function useDrives() {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Cycle', 'spec.type': 'drive' } });
    return res.items.map(c => {
      const owner = (c.spec?.owner as string) ?? '';
      const ownerName = owner.startsWith('group:') ? owner.split('/').pop() : undefined;
      const tf = (c.spec?.timeframe as { start?: string; end?: string }) ?? {};
      return {
        name: c.metadata.name,
        title: c.metadata.title ?? c.metadata.name,
        description: c.metadata.description,
        entityRef: `cycle:default/${c.metadata.name}`,
        ownerGuildName: ownerName,
        start: tf.start, end: tf.end,
      } as DriveView;
    });
  }, [catalog]);
  return { drives: state.value ?? [], loading: state.loading, error: state.error };
}
