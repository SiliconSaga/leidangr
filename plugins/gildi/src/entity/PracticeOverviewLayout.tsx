import type { CSSProperties } from 'react';
import { Grid } from '@material-ui/core';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { EntityAboutCard, EntityLinksCard } from '@backstage/plugin-catalog';
import { EntityCatalogGraphCard } from '@backstage/plugin-catalog-graph';
import { PracticeCard } from './PracticeCard';
import { AdoptersCard } from './AdoptersCard';

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

// A practice-only overview layout (EntityContentLayoutBlueprint, filtered to
// kind:Component spec.type:practice), mirroring the guild layout: main column
// leads with the Practice identity card and the Adopters card, entity graph
// demoted; the right rail keeps the stock About + Links. The vísar render in the
// Docs tab automatically via the entity's techdocs-ref. Other Components fall
// through to the stock layout.
export function PracticeOverviewLayout(_props: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <div style={column} data-testid="practice-overview-main">
          <PracticeCard />
          <AdoptersCard />
          <EntityCatalogGraphCard height={400} />
        </div>
      </Grid>
      <Grid item xs={12} md={4}>
        <div style={column} data-testid="practice-overview-rail">
          <EntityAboutCard />
          <EntityLinksCard />
        </div>
      </Grid>
    </Grid>
  );
}
