import { Button, Typography } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useActions } from './useActions';

export function ActionsPanel() {
  const { actions, loading, error } = useActions();
  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  return (
    <div>
      <Typography variant="overline" color="textSecondary">Actions</Typography>
      {actions.length === 0 ? (
        <Typography variant="body2" color="textSecondary">No actions yet.</Typography>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          {actions.map(a => (
            <Button
              key={a.name}
              component="a"
              href={a.createHref}
              size="small"
              variant="outlined"
              startIcon={<AddCircleOutlineIcon fontSize="small" />}
              title={a.description}
            >
              {a.title}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
