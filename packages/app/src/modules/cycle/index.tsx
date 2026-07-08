import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

// A curated info-card on the entity Overview, shown only for `kind: Cycle`.
// Attaches to the catalog default overview automatically (EntityCardBlueprint
// attachTo: entity-content:catalog/overview) and is gated by the filter.
const cycleOverviewCard = EntityCardBlueprint.make({
  name: 'cycle',
  params: {
    filter: { kind: 'cycle' },
    loader: () => import('./CycleCard').then(m => <m.CycleOverviewCard />),
  },
});

export const cycleModule = createFrontendModule({
  pluginId: 'app',
  extensions: [cycleOverviewCard],
});
