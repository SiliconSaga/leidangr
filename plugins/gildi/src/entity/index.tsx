import { EntityCardBlueprint, EntityContentLayoutBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';
import { hasAdoptedAspects } from './aspects';

// A guild-only overview layout: matched first (before the stock
// DefaultEntityContentLayout) for kind:Group spec.type:guild, so only guild
// pages get the bespoke two-zone composition. Every other Group and kind falls
// through to the default layout untouched. The blueprint's attachTo
// (entity-content:catalog/overview -> layouts) is baked in.
export const guildOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'guild-overview',
  params: {
    filter: { kind: 'group', 'spec.type': 'guild' },
    loader: async () => {
      const { GuildOverviewLayout } = await import('./GuildOverviewLayout');
      return props => <GuildOverviewLayout {...props} />;
    },
  },
});

// A practice-only overview layout (kind:Component spec.type:practice), same
// mechanism as the guild layout. Other Components fall through to the default.
export const practiceOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'practice-overview',
  params: {
    filter: { kind: 'component', 'spec.type': 'practice' },
    loader: async () => {
      const { PracticeOverviewLayout } = await import('./PracticeOverviewLayout');
      return props => <PracticeOverviewLayout {...props} />;
    },
  },
});

// Complementary predicates over Components. Exported so the gating is tested
// directly rather than only through a rendered app — the filters are the whole
// reason these cards do not appear on every entity in the catalog.
export const isAdoptingComponent = (entity: Entity) =>
  entity.kind.toLowerCase() === 'component' && hasAdoptedAspects(entity);

export const isUnenrolledComponent = (entity: Entity) =>
  entity.kind.toLowerCase() === 'component' && !hasAdoptedAspects(entity);

// Both are `info` cards, which is what puts them in the stock right rail:
// DefaultEntityContentLayout partitions cards into an info area (1fr) and a
// content area (2fr). That is how we get deliberate placement WITHOUT owning
// the Component overview layout — unlike the guild and practice pages above,
// a Component's stock overview is rich and worth inheriting.
export const componentAspectsCard = EntityCardBlueprint.make({
  name: 'component-aspects',
  params: {
    type: 'info',
    filter: isAdoptingComponent,
    loader: async () => {
      const { ComponentAspectsCard } = await import('./ComponentAspectsCard');
      return <ComponentAspectsCard />;
    },
  },
});

// Disable the call to action in app-config to switch it off entirely:
//   app: { extensions: ['entity-card:gildi/component-adopt': false] }
export const componentAdoptCard = EntityCardBlueprint.make({
  name: 'component-adopt',
  params: {
    type: 'info',
    filter: isUnenrolledComponent,
    loader: async () => {
      const { AdoptAspectCard } = await import('./AdoptAspectCard');
      return <AdoptAspectCard />;
    },
  },
});
