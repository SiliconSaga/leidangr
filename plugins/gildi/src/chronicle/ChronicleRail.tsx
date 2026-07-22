import { Divider, Typography } from '@material-ui/core';
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
      <h2>Recent chronicle</h2>
      <div>
        {shown.map((s, i) => (
          <div key={s.name}>
            {i > 0 && <Divider light />}
            <SagaCard saga={s} />
          </div>
        ))}
      </div>
      {sagas.length > shown.length && (
        <Typography variant="caption" color="textSecondary">
          +{sagas.length - shown.length} more in the chronicle
        </Typography>
      )}
    </div>
  );
}
