import { Chip, Typography } from '@material-ui/core';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { useAdopters } from './useAdopters';

const ASPECT = 'siliconsaga.org/aspect';

// The adoption story surfaced on the practice page: components enrolled in this
// practice's aspect, each with the version they adopted.
export function AdoptersCard() {
  const { entity } = useEntity();
  const aspectId = entity.metadata.annotations?.[ASPECT];
  const { adopters, loading, error } = useAdopters(aspectId);

  let body;
  if (!aspectId) {
    body = (
      <Typography variant="body2" color="textSecondary">
        This practice does not declare a maintained aspect.
      </Typography>
    );
  } else if (loading) {
    body = <Progress />;
  } else if (error) {
    body = <ResponseErrorPanel error={error} />;
  } else if (adopters.length > 0) {
    body = adopters.map(a => (
      <div key={a.entityRef} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
        <EntityRefLink entityRef={a.entityRef}>{a.title}</EntityRefLink>
        {a.version && <Chip label={`v${a.version}`} size="small" variant="outlined" />}
      </div>
    ));
  } else {
    body = <Typography variant="body2" color="textSecondary">No adopters yet.</Typography>;
  }

  return <InfoCard title="Adopters">{body}</InfoCard>;
}
