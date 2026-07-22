import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { GuildHallPage } from './components/GuildHallPage';

// GuildHallPage mounts GuildsSection, DrivesBand, ActionsPanel, and
// ChronicleRail, which together query the catalog for Group (guilds),
// Component (practices), Cycle (drives), Saga (chronicle), and Template
// (actions) entities. Dispatch on the filter's kind so this header-level
// smoke test doesn't depend on real catalog data — every kind resolves to
// an empty result set.
const emptyCatalogApi = {
  getEntities: async ({ filter }: any) => {
    switch (filter?.kind) {
      case 'Group':
      case 'Component':
      case 'Cycle':
      case 'Saga':
      case 'Template':
        return { items: [] };
      default:
        return { items: [] };
    }
  },
};

describe('GuildHallPage', () => {
  it('renders the Guild Hall header', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, emptyCatalogApi]]}>
        <GuildHallPage />
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Guild Hall')).toBeInTheDocument();
  });
});
