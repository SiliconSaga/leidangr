import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';

// Stub the stock cards — they each pull their own plugin APIs (catalog-graph,
// permissions, …) which are out of scope here. We only assert OUR composition:
// that the layout renders Charter + Chronicle and mounts a slot for each stock
// card in the right zone. The stock cards' real rendering is Backstage's to
// test, and the composed page is proven in manual acceptance.
jest.mock('@backstage/plugin-org', () => ({
  EntityGroupProfileCard: () => <div>[group-profile]</div>,
  EntityMembersListCard: () => <div>[members]</div>,
  EntityOwnershipCard: () => <div>[ownership]</div>,
}));
jest.mock('@backstage/plugin-catalog', () => ({
  EntityLinksCard: () => <div>[links]</div>,
}));
jest.mock('@backstage/plugin-catalog-graph', () => ({
  EntityCatalogGraphCard: () => <div>[entity-graph]</div>,
}));

import { GuildOverviewLayout } from './GuildOverviewLayout';

const guild = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Group',
  metadata: {
    name: 'security-gildi',
    title: 'Security guild',
    description: 'Keeps things safe.',
    annotations: { 'siliconsaga.org/stewards': 'aspect:security' },
  },
  spec: { type: 'guild' },
} as any;

const catalogApi = { getEntities: async () => ({ items: [] }) } as any;

describe('GuildOverviewLayout', () => {
  it('composes Charter and Chronicle alongside the stock cards', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={guild}>
          <GuildOverviewLayout cards={[]} />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );

    // our cards
    expect(await screen.findByText('Charter')).toBeInTheDocument();
    expect(screen.getByText('Chronicle')).toBeInTheDocument();
    // a slot for each stock card, one per zone
    expect(screen.getByText('[ownership]')).toBeInTheDocument();
    expect(screen.getByText('[members]')).toBeInTheDocument();
    expect(screen.getByText('[entity-graph]')).toBeInTheDocument();
    expect(screen.getByText('[group-profile]')).toBeInTheDocument();
    expect(screen.getByText('[links]')).toBeInTheDocument();
  });
});
