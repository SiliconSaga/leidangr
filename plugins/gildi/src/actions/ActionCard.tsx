import { Typography } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import { InfoCard, Link } from '@backstage/core-components';
import type { ActionView } from './useActions';

export function ActionCard({ action }: { action: ActionView }) {
  return (
    <InfoCard variant="gridItem">
      <div style={{ display: 'flex', gap: 12 }}>
        <AddCircleOutlineIcon fontSize="large" color="action" />
        <div style={{ minWidth: 0 }}>
          <Typography variant="overline" color="textSecondary">Action</Typography>
          <Typography variant="subtitle2">{action.title}</Typography>
          {action.description && (
            <Typography variant="body2" color="textSecondary" style={{ margin: '4px 0' }}>
              {action.description}
            </Typography>
          )}
          <Typography variant="caption" component="div" style={{ marginTop: 4 }}>
            <Link to={action.createHref}>Open in Create &rarr;</Link>
          </Typography>
        </div>
      </div>
    </InfoCard>
  );
}
