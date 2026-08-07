import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { GuildHallPage } from './components/GuildHallPage';
import { gildiPlugin } from './plugin';

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

// `getExtension` is public on the OverridableFrontendPlugin that
// createFrontendPlugin returns, and it THROWS for an id not wired into the
// plugin — so a successful lookup of the plugin-qualified id is itself the
// registration assertion. This fails if guildOverviewLayout is dropped from
// plugin.tsx's `extensions` array. (Cast: getExtension's id param is a typed
// literal key; we look it up by the runtime id string.)
describe('gildi entity overview layouts', () => {
  const getExtension = (id: string) =>
    (gildiPlugin as unknown as { getExtension(id: string): unknown }).getExtension(id);

  it('registers the guild-only overview layout in the plugin', () => {
    expect(getExtension('entity-content-layout:gildi/guild-overview')).toBeDefined();
  });

  it('registers the practice-only overview layout in the plugin', () => {
    expect(getExtension('entity-content-layout:gildi/practice-overview')).toBeDefined();
  });
});

describe('gildi component adoption cards', () => {
  const getExtension = (id: string) =>
    (gildiPlugin as unknown as { getExtension(id: string): unknown }).getExtension(id);

  it('registers the enrolled-component aspects card', () => {
    expect(getExtension('entity-card:gildi/component-aspects')).toBeDefined();
  });

  it('registers the unenrolled-component adopt card', () => {
    expect(getExtension('entity-card:gildi/component-adopt')).toBeDefined();
  });
});
