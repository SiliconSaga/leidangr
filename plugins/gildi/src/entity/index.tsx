import { EntityContentLayoutBlueprint } from '@backstage/plugin-catalog-react/alpha';

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
