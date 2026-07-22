import { Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import type { DriveView } from './useDrives';

export function DriveCard({ drive }: { drive: DriveView }) {
  return (
    <InfoCard variant="gridItem">
      <EntityRefLink entityRef={drive.entityRef} style={{ display: 'flex', gap: 14, textDecoration: 'none', color: 'inherit' }}>
        {drive.ownerGuildName && <Crest seed={drive.ownerGuildName} size={44} title={`Arms of ${drive.ownerGuildName}`} />}
        <div style={{ minWidth: 0 }}>
          <Typography variant="overline" color="textSecondary">Drive</Typography>
          <Typography variant="h6">{drive.title}</Typography>
          {drive.description && <Typography variant="body2" color="textSecondary" style={{ margin: '4px 0' }}>{drive.description}</Typography>}
          {(drive.start || drive.end) && <Typography variant="caption" color="textSecondary">{drive.start} → {drive.end}</Typography>}
        </div>
      </EntityRefLink>
    </InfoCard>
  );
}
