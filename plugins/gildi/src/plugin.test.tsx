import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { GuildHallPage } from './components/GuildHallPage';

// GuildHallPage mounts GuildsSection, which queries the catalog — supply an
// empty mock so this header-level smoke test doesn't depend on guild data.
const emptyCatalogApi = {
  getEntities: async () => ({ items: [] }),
};

describe('GuildHallPage', () => {
  it('renders the Guild Hall header', async () => {
    await renderInTestApp(<GuildHallPage />, {
      apis: [[catalogApiRef, emptyCatalogApi]],
    });
    expect(await screen.findByText('Guild Hall')).toBeInTheDocument();
  });
});
