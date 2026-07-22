import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export interface SagaView {
  name: string; title: string; description?: string;
  entityRef: string;                 // saga:default/<name>
  skaldRef?: string;                 // user:default/<name>
  guildName?: string;                // touched guild for the crest
  end?: string;
}

export function useSagas() {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Saga' } });
    const views = res.items.map(s => {
      const touches = (s.spec?.touches as string[]) ?? [];
      const guildRef = touches.find(t => t.startsWith('group:') && t.includes('gildi')) ?? touches.find(t => t.startsWith('group:'));
      const tf = (s.spec?.timeframe as { end?: string }) ?? {};
      return {
        name: s.metadata.name,
        title: s.metadata.title ?? s.metadata.name,
        description: s.metadata.description,
        entityRef: `saga:default/${s.metadata.name}`,
        skaldRef: s.spec?.skald as string | undefined,
        guildName: guildRef ? guildRef.split('/').pop() : undefined,
        end: tf.end,
      } as SagaView;
    });
    return views.sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''));
  }, [catalog]);
  return { sagas: state.value ?? [], loading: state.loading, error: state.error };
}
