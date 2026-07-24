import type { ReactNode } from 'react';
import { Divider, Typography } from '@material-ui/core';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useSagas } from './useSagas';
import { SagaCard } from './SagaCard';

export function ChronicleRail({ max = 4 }: { max?: number }) {
  const { sagas, loading, error } = useSagas();
  const shown = sagas.slice(0, max);
  let body: ReactNode;
  if (loading) {
    body = <Progress />;
  } else if (error) {
    body = <ResponseErrorPanel error={error} />;
  } else if (sagas.length === 0) {
    body = <p style={{ opacity: 0.7 }}>No sagas yet.</p>;
  } else {
    body = (
      <>
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
      </>
    );
  }
  return (
    <div>
      <h2>Recent chronicle</h2>
      {body}
    </div>
  );
}
