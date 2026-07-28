import { Chip, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import { stewardAspectsOf } from '../guilds/roster';

const CHARTER = 'siliconsaga.org/charter';

export function GuildCharterCard() {
  const { entity } = useEntity();
  const title = entity.metadata.title ?? entity.metadata.name;
  const charter = entity.metadata.annotations?.[CHARTER] ?? entity.metadata.description;
  const aspects = stewardAspectsOf(entity);

  return (
    <InfoCard title="Charter">
      <div style={{ display: 'flex', gap: 14 }}>
        <Crest seed={entity.metadata.name} size={52} title={`Arms of ${title}`} />
        <div style={{ minWidth: 0 }}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="textSecondary" style={{ margin: '4px 0 8px' }}>
            {charter ?? 'No charter recorded yet.'}
          </Typography>
          {aspects.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {aspects.map(a => (
                <Chip key={a} label={`${a} aspect`} size="small" variant="outlined" />
              ))}
            </div>
          )}
        </div>
      </div>
    </InfoCard>
  );
}
