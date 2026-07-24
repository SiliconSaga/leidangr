import type { ReactNode } from 'react';
import { Typography } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import { LinkButton, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useActions } from './useActions';

export function ActionsPanel() {
  const { actions, loading, error } = useActions();
  let body: ReactNode;
  if (loading) {
    body = <Progress />;
  } else if (error) {
    body = <ResponseErrorPanel error={error} />;
  } else if (actions.length === 0) {
    body = <Typography variant="body2" color="textSecondary">No actions yet.</Typography>;
  } else {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        {actions.map(a => (
          <LinkButton
            key={a.createHref}
            to={a.createHref}
            size="small"
            variant="outlined"
            startIcon={<AddCircleOutlineIcon fontSize="small" />}
            title={a.description}
          >
            {a.title}
          </LinkButton>
        ))}
      </div>
    );
  }
  return (
    <div>
      <Typography variant="overline" color="textSecondary">Actions</Typography>
      {body}
    </div>
  );
}
