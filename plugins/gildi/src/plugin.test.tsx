import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider, createExtensionTester } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { GuildHallPage } from './components/GuildHallPage';
import { guildCharterCard, guildRosterCard, guildChronicleCard } from './entity';

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

// `FrontendPlugin` (the type of `gildiPlugin`) doesn't publicly expose its
// `extensions` array — only `pluginId`/`routes`/etc are part of the public
// API. `createExtensionTester(...).snapshot().id` is the documented way
// (frontend-test-utils) to resolve an extension's real id, so we assert
// directly against the same extension objects that plugin.tsx wires into
// `gildiPlugin`'s `extensions` array.
describe('gildi plugin entity cards', () => {
  it('registers the guild entity-decoration cards', () => {
    const ids = [
      createExtensionTester(guildCharterCard).snapshot().id,
      createExtensionTester(guildRosterCard).snapshot().id,
      createExtensionTester(guildChronicleCard).snapshot().id,
    ];
    const joined = ids.join(' ');
    expect(joined).toMatch(/guild-charter/);
    expect(joined).toMatch(/guild-roster/);
    expect(joined).toMatch(/guild-chronicle/);
  });
});
