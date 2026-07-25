import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';

export interface DriveView {
  name: string; title: string; description?: string;
  entityRef: string;                 // cycle:default/<name>
  ownerGuildName?: string;           // for the crest, when owner is a guild Group
  start?: string; end?: string;
}

export function useDrives(opts?: { guild?: string; includeEnded?: boolean }) {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    const res = await catalog.getEntities({ filter: { kind: 'Cycle', 'spec.type': 'drive' } });
    const views = res.items.map(c => {
      const owner = (c.spec?.owner as string) ?? '';
      let ownerName: string | undefined;
      if (owner) {
        try {
          // parse with the backend's defaults so bare / capitalized / namespaced
          // refs (name, Group:default/name, group:name) all yield the guild's name
          const ref = parseEntityRef(owner, { defaultKind: 'Group', defaultNamespace: 'default' });
          if (ref.kind.toLowerCase() === 'group') ownerName = ref.name;
        } catch {
          // leave undefined for a malformed owner ref — no crest rather than a bad one
        }
      }
      const tf = (c.spec?.timeframe as { start?: string; end?: string }) ?? {};
      return {
        name: c.metadata.name,
        title: c.metadata.title ?? c.metadata.name,
        description: c.metadata.description,
        entityRef: stringifyEntityRef(c),
        ownerGuildName: ownerName,
        start: tf.start, end: tf.end,
      } as DriveView;
    });
    const scoped = opts?.guild ? views.filter(d => d.ownerGuildName === opts.guild) : views;
    if (opts?.includeEnded) {
      return scoped.sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''));
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return scoped.filter(d => !d.end || d.end >= today);
  }, [catalog, opts?.guild, opts?.includeEnded]);
  return { drives: state.value ?? [], loading: state.loading, error: state.error };
}
