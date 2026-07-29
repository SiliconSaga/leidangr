import { Typography } from '@material-ui/core';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useSagas } from '../chronicle/useSagas';
import { SagaCard } from '../chronicle/SagaCard';
import { useDrives } from '../drives/useDrives';
import { DriveCard } from '../drives/DriveCard';

const MAX = 5;

export function GuildChronicleCard() {
  const { entity } = useEntity();
  const guild = entity.metadata.name;
  const { sagas, loading: sagasLoading, error: sagasError } = useSagas({ guild });
  const {
    drives,
    loading: drivesLoading,
    error: drivesError,
  } = useDrives({ guild, includeEnded: true });

  const loading = sagasLoading || drivesLoading;
  const error = sagasError ?? drivesError;

  let body;
  if (loading) {
    body = <Progress />;
  } else if (error) {
    body = <ResponseErrorPanel error={error} />;
  } else {
    body = (
      <>
        <Typography variant="subtitle2" gutterBottom>Recent sagas</Typography>
        {sagas.length > 0 ? (
          sagas.slice(0, MAX).map(s => <SagaCard key={s.entityRef} saga={s} />)
        ) : (
          <Typography variant="body2" color="textSecondary" gutterBottom>No sagas yet.</Typography>
        )}
        <Typography variant="subtitle2" gutterBottom style={{ marginTop: 12 }}>Drives</Typography>
        {drives.length > 0 ? (
          drives.slice(0, MAX).map(d => <DriveCard key={d.entityRef} drive={d} />)
        ) : (
          <Typography variant="body2" color="textSecondary">No drives yet.</Typography>
        )}
      </>
    );
  }

  return <InfoCard title="Chronicle">{body}</InfoCard>;
}
