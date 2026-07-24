import type { ReactNode } from 'react';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useDrives } from './useDrives';
import { DriveCard } from './DriveCard';

export function DrivesBand() {
  const { drives, loading, error } = useDrives();
  let body: ReactNode;
  if (loading) {
    body = <Progress />;
  } else if (error) {
    body = <ResponseErrorPanel error={error} />;
  } else if (drives.length === 0) {
    body = <p style={{ opacity: 0.7 }}>No active drives.</p>;
  } else {
    body = (
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {drives.map(d => (<DriveCard key={d.name} drive={d} />))}
      </div>
    );
  }
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Active &amp; upcoming drives</h2>
      {body}
    </div>
  );
}
