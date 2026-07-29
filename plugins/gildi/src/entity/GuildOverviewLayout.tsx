import type { CSSProperties } from 'react';
import { Grid } from '@material-ui/core';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  EntityGroupProfileCard,
  EntityMembersListCard,
  EntityOwnershipCard,
} from '@backstage/plugin-org';
import { EntityLinksCard } from '@backstage/plugin-catalog';
import { EntityCatalogGraphCard } from '@backstage/plugin-catalog-graph';
import { GuildCharterCard } from './GuildCharterCard';
import { GuildChronicleCard } from './GuildChronicleCard';

// Ownership defaults to Component/API/System/Resource, which drops the aspect
// (a Template owned by the guild). Add Template so the guild's aspect surfaces
// alongside its practices.
const OWNED_KINDS = ['Component', 'API', 'System', 'Resource', 'Template'];

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

// A guild-only overview layout (registered via EntityContentLayoutBlueprint,
// filtered to kind:Group spec.type:guild). We compose the grid explicitly rather
// than bucketing the generic `cards` prop, so placement is deterministic: the
// main column leads with the human-readable Charter, then the stock Ownership +
// Members, with the entity graph demoted to the bottom; the right rail keeps the
// familiar Group Profile and Links, then our Chronicle. Every other Group falls
// through to the stock DefaultEntityContentLayout untouched.
export function GuildOverviewLayout(_props: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <div style={column}>
          <GuildCharterCard />
          <EntityOwnershipCard entityFilterKind={OWNED_KINDS} />
          <EntityMembersListCard />
          <EntityCatalogGraphCard height={400} />
        </div>
      </Grid>
      <Grid item xs={12} md={4}>
        <div style={column}>
          <EntityGroupProfileCard />
          <EntityLinksCard />
          <GuildChronicleCard />
        </div>
      </Grid>
    </Grid>
  );
}
