import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export interface ActionView {
  name: string;
  title: string;
  description?: string;
  createHref: string;                // /create/templates/default/<name>
}

const GUILD_HALL_TAG = 'guild-hall';

export function useActions() {
  const catalog = useApi(catalogApiRef);
  const state = useAsync(async () => {
    // The `metadata.tags` filter key isn't reliably matched by the installed
    // catalog client's getEntities filter — fetch all Templates and filter
    // on the guild-hall tag in JS instead.
    const res = await catalog.getEntities({ filter: { kind: 'Template' } });
    return res.items
      .filter(t => (t.metadata.tags ?? []).includes(GUILD_HALL_TAG))
      .map(t => ({
        name: t.metadata.name,
        title: t.metadata.title ?? t.metadata.name,
        description: t.metadata.description,
        createHref: `/create/templates/default/${t.metadata.name}`,
      } as ActionView));
  }, [catalog]);
  return { actions: state.value ?? [], loading: state.loading, error: state.error };
}
