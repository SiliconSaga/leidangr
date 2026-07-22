import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useActions } from './useActions';
import { ActionCard } from './ActionCard';

export function ActionsPanel() {
  const { actions, loading, error } = useActions();
  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (actions.length === 0) return <p style={{ opacity: 0.7 }}>No actions yet.</p>;
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Actions</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {actions.map(a => (<ActionCard key={a.name} action={a} />))}
      </div>
    </div>
  );
}
