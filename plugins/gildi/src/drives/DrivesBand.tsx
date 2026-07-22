import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useDrives } from './useDrives';
import { DriveCard } from './DriveCard';

export function DrivesBand() {
  const { drives, loading, error } = useDrives();
  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (drives.length === 0) return <p style={{ opacity: 0.7 }}>No active drives.</p>;
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Active &amp; upcoming drives</h2>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {drives.map(d => (<DriveCard key={d.name} drive={d} />))}
      </div>
    </div>
  );
}
