import { Typography } from '@material-ui/core';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useSagas } from './useSagas';
import { SagaCard } from './SagaCard';

export function ChronicleRail({ max = 4 }: { max?: number }) {
  const { sagas, loading, error } = useSagas();
  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (sagas.length === 0) return <p style={{ opacity: 0.7 }}>No sagas yet.</p>;
  const shown = sagas.slice(0, max);
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Recent chronicle</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map(s => (<SagaCard key={s.name} saga={s} />))}
      </div>
      {sagas.length > shown.length && (
        <Typography variant="caption" color="textSecondary">
          +{sagas.length - shown.length} more in the chronicle
        </Typography>
      )}
    </div>
  );
}
