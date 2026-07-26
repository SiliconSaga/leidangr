import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

const guildFilter = { kind: 'Group', 'spec.type': 'guild' };

export const guildCharterCard = EntityCardBlueprint.make({
  name: 'guild-charter',
  params: {
    filter: guildFilter,
    loader: () => import('./GuildCharterCard').then(m => <m.GuildCharterCard />),
  },
});

export const guildRosterCard = EntityCardBlueprint.make({
  name: 'guild-roster',
  params: {
    filter: guildFilter,
    loader: () => import('./GuildRosterCard').then(m => <m.GuildRosterCard />),
  },
});

export const guildChronicleCard = EntityCardBlueprint.make({
  name: 'guild-chronicle',
  params: {
    filter: guildFilter,
    loader: () => import('./GuildChronicleCard').then(m => <m.GuildChronicleCard />),
  },
});
