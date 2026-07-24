import { Typography } from '@material-ui/core';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import type { SagaView } from './useSagas';

export function SagaCard({ saga }: { saga: SagaView }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
      {saga.guildName && <Crest seed={saga.guildName} size={24} title={`Arms of ${saga.guildName}`} />}
      <div style={{ minWidth: 0 }}>
        <Typography variant="subtitle2">
          <EntityRefLink entityRef={saga.entityRef}>{saga.title}</EntityRefLink>
        </Typography>
        {saga.description && (
          <Typography
            variant="body2"
            color="textSecondary"
            style={{
              margin: '2px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {saga.description}
          </Typography>
        )}
        {saga.skaldRef && (
          <Typography variant="caption" color="textSecondary" component="div">
            by <EntityRefLink entityRef={saga.skaldRef} />
          </Typography>
        )}
      </div>
    </div>
  );
}
