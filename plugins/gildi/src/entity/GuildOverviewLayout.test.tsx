import { screen, within } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';

// Stub the stock cards — they each pull their own plugin APIs (catalog-graph,
// permissions, …) which are out of scope here. The Ownership stub echoes its
// entityFilterKind so we can assert the Template addition; the rest render a
// labelled slot so we can assert which ZONE each lands in.
jest.mock('@backstage/plugin-org', () => ({
  EntityGroupProfileCard: () => <div>[group-profile]</div>,
  EntityMembersListCard: () => <div>[members]</div>,
  EntityOwnershipCard: (props: { entityFilterKind?: string[] }) => (
    <div>[ownership kinds={(props.entityFilterKind ?? []).join(',')}]</div>
  ),
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
  it('places our cards and the stock cards in the right zones', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={guild}>
          <GuildOverviewLayout cards={[]} />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );

    const main = within(await screen.findByTestId('guild-overview-main'));
    const rail = within(screen.getByTestId('guild-overview-rail'));

    // Main column: Charter leads, then Ownership (with Template added so the
    // owned aspect surfaces), Members, and the demoted entity graph.
    expect(main.getByText('Charter')).toBeInTheDocument();
    expect(main.getByText(/\[ownership kinds=.*Template.*\]/)).toBeInTheDocument();
    expect(main.getByText('[members]')).toBeInTheDocument();
    expect(main.getByText('[entity-graph]')).toBeInTheDocument();

    // Right rail: Group Profile, Links, then our Chronicle.
    expect(rail.getByText('[group-profile]')).toBeInTheDocument();
    expect(rail.getByText('[links]')).toBeInTheDocument();
    expect(rail.getByText('Chronicle')).toBeInTheDocument();
  });
});
