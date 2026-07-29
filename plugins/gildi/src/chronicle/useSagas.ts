import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';

export interface SagaView {
  name: string; title: string; description?: string;
  entityRef: string;                 // saga:default/<name>
  skaldRef?: string;                 // user:default/<name>
  guildName?: string;                // touched guild for the crest
  guildNames: string[];              // full resolved touched-guild-name set, for scoping
  end?: string;
}

export function useSagas(opts?: { guild?: string }) {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Saga' } });
    const views = res.items.map(s => {
      const touches = (s.spec?.touches as string[]) ?? [];
      // resolve each touch to a guild name via the backend's ref defaults, so
      // group:name / Group:default/name / bare name all seed the crest correctly
      const guildNames = touches
        .map(t => {
          try {
            const ref = parseEntityRef(t, { defaultKind: 'Group', defaultNamespace: 'default' });
            return ref.kind.toLowerCase() === 'group' ? ref.name : undefined;
          } catch {
            return undefined;
          }
        })
        .filter((n): n is string => !!n);
      const guildName = guildNames.find(n => n.endsWith('-gildi')) ?? guildNames[0];
      const tf = (s.spec?.timeframe as { end?: string }) ?? {};
      return {
        name: s.metadata.name,
        title: s.metadata.title ?? s.metadata.name,
        description: s.metadata.description,
        entityRef: stringifyEntityRef(s),
        skaldRef: s.spec?.skald as string | undefined,
        guildName,
        guildNames,
        end: tf.end,
      } as SagaView;
    });
    // When scoped to a guild, seed the crest with THAT guild — guildName is the
    // globally-primary touched guild, which would show the wrong arms on a
    // multi-guild saga viewed from a non-primary guild's page.
    const scoped = opts?.guild
      ? views
          .filter(v => v.guildNames.includes(opts.guild!))
          .map(v => ({ ...v, guildName: opts.guild }))
      : views;
    return scoped.sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''));
  }, [catalog, opts?.guild]);
  return { sagas: state.value ?? [], loading: state.loading, error: state.error };
}
