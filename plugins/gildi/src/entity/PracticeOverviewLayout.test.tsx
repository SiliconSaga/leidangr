import { screen, within } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';

// Stub the stock cards (their own plugin APIs are out of scope). Assert OUR
// composition: Practice + Adopters lead the main column, About + Links the rail.
jest.mock('@backstage/plugin-catalog', () => ({
  EntityAboutCard: () => <div>[about]</div>,
  EntityLinksCard: () => <div>[links]</div>,
}));
jest.mock('@backstage/plugin-catalog-graph', () => ({
  EntityCatalogGraphCard: () => <div>[entity-graph]</div>,
}));

import { PracticeOverviewLayout } from './PracticeOverviewLayout';

const practice = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'security-practice',
    title: 'Security practice',
    annotations: { 'siliconsaga.org/aspect': 'security' },
  },
  spec: { type: 'practice', owner: 'group:default/security-gildi' },
} as any;

const catalogApi = { getEntities: async () => ({ items: [] }) } as any;

describe('PracticeOverviewLayout', () => {
  it('places our cards and the stock cards in the right zones', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={practice}>
          <PracticeOverviewLayout cards={[]} />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );

    const main = within(await screen.findByTestId('practice-overview-main'));
    const rail = within(screen.getByTestId('practice-overview-rail'));

    expect(main.getByText('Practice')).toBeInTheDocument();
    expect(main.getByText('Adopters')).toBeInTheDocument();
    expect(main.getByText('[entity-graph]')).toBeInTheDocument();

    expect(rail.getByText('[about]')).toBeInTheDocument();
    expect(rail.getByText('[links]')).toBeInTheDocument();
  });
});
