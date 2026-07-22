import { Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import type { SagaView } from './useSagas';

export function SagaCard({ saga }: { saga: SagaView }) {
  return (
    <InfoCard variant="gridItem">
      <div style={{ display: 'flex', gap: 12 }}>
        {saga.guildName && <Crest seed={saga.guildName} size={36} title={`Arms of ${saga.guildName}`} />}
        <div style={{ minWidth: 0 }}>
          <Typography variant="overline" color="textSecondary">Saga</Typography>
          <Typography variant="subtitle2">{saga.title}</Typography>
          {saga.description && (
            <Typography variant="body2" color="textSecondary" style={{ margin: '4px 0' }}>
              {saga.description}
            </Typography>
          )}
          {saga.skaldRef && (
            <Typography variant="caption" color="textSecondary" component="div">
              by <EntityRefLink entityRef={saga.skaldRef} />
            </Typography>
          )}
          <Typography variant="caption" component="div" style={{ marginTop: 4 }}>
            <EntityRefLink entityRef={saga.entityRef}>Read &rarr;</EntityRefLink>
          </Typography>
        </div>
      </div>
    </InfoCard>
  );
}
