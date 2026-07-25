import { Chip, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { useGuildRoster } from './useGuildRoster';

export function GuildRosterCard() {
  const { entity } = useEntity();
  const { practices, aspects } = useGuildRoster(entity);

  return (
    <InfoCard title="Roster">
      <Typography variant="subtitle2" gutterBottom>Practices</Typography>
      {practices.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {practices.map(p => (
            <Chip
              key={p.name}
              label={<EntityRefLink entityRef={`component:default/${p.name}`}>{p.title}</EntityRefLink>}
              size="small"
              variant="outlined"
            />
          ))}
        </div>
      ) : (
        <Typography variant="body2" color="textSecondary" gutterBottom>No practices yet.</Typography>
      )}
      <Typography variant="subtitle2" gutterBottom>Aspects</Typography>
      {aspects.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {aspects.map(a => (
            <Chip key={a} label={`${a} aspect`} size="small" variant="outlined" />
          ))}
        </div>
      ) : (
        <Typography variant="body2" color="textSecondary">No aspects yet.</Typography>
      )}
    </InfoCard>
  );
}
