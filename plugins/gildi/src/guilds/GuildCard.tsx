import { Chip, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import type { GuildView } from './useGuilds';

export function GuildCard({ guild }: { guild: GuildView }) {
  const aspects = Array.from(new Set([
    ...guild.stewardAspects,
    ...guild.practices.map(p => p.aspect).filter(Boolean) as string[],
  ]));
  return (
    <InfoCard variant="gridItem">
      <EntityRefLink
        entityRef={guild.entityRef}
        style={{ display: 'flex', gap: 14, textDecoration: 'none', color: 'inherit' }}
      >
        <Crest seed={guild.name} size={52} title={`Arms of ${guild.title}`} />
        <div style={{ minWidth: 0 }}>
          <Typography variant="h6">{guild.title}</Typography>
          {guild.description && (
            <Typography variant="body2" color="textSecondary" style={{ margin: '4px 0 8px' }}>
              {guild.description}
            </Typography>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {guild.practices.map(p => (
              <Chip key={p.name} label={p.title} size="small" variant="outlined" />
            ))}
            {aspects.map(a => (
              <Chip key={a} label={`${a} aspect`} size="small" variant="outlined" />
            ))}
          </div>
        </div>
      </EntityRefLink>
    </InfoCard>
  );
}
