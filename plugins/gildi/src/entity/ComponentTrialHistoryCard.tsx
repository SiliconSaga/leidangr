import { Typography, makeStyles } from '@material-ui/core';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { MedalHistoryChart, canChart } from '../history';
import { aspectLabel } from './aspects';
import { useComponentAspects } from './useComponentAspects';
import { useComponentTrialHistory } from './useComponentTrialHistory';

const useStyles = makeStyles(theme => ({
  aspect: { marginBottom: theme.spacing(2) },
  heading: { fontWeight: 600 },
  quiet: { color: theme.palette.text.secondary },
}));

/**
 * One aspect's history. Mounted per aspect rather than behind a selector: a
 * component adopts a handful at most, and a dropdown would hide the comparison
 * between them — which is most of what there is to see.
 */
function AspectHistory({ entity, aspectId }: { entity: Entity; aspectId: string }) {
  const classes = useStyles();
  const { history, loading, error } = useComponentTrialHistory(entity, aspectId);

  // Deliberately NOT an error panel per aspect. A chart is supplementary — the
  // badge on the aspects card already carries the current standing, including
  // when a fetch fails — so a broken history says so in a line rather than
  // stacking red panels down the page.
  const body = () => {
    if (loading) return <Progress />;
    if (error) {
      return (
        <Typography variant="body2" className={classes.quiet}>
          Could not read this aspect's history. This is a gap in what we could
          fetch, not a verdict about the component.
        </Typography>
      );
    }
    if (!history || history.runs.length === 0) {
      return (
        <Typography variant="body2" className={classes.quiet}>
          No runs recorded yet — the sweep has not reached this aspect.
        </Typography>
      );
    }
    // Asked BEFORE rendering, not after. The chart draws nothing below two
    // measured runs, which is honest but an unexplained blank on a page — and
    // the element exists either way, so the host cannot detect it by checking
    // what the component returned.
    if (!canChart(history.runs)) {
      return (
        <Typography variant="body2" className={classes.quiet}>
          Not enough measured runs to chart yet — a medal needs two readings
          before there is a line to draw.
        </Typography>
      );
    }
    return <MedalHistoryChart runs={history.runs} events={history.events} />;
  };

  return (
    <div className={classes.aspect} data-testid={`history-${aspectId}`}>
      <Typography variant="subtitle2" className={classes.heading}>
        {aspectLabel(aspectId)}
      </Typography>
      {body()}
    </div>
  );
}

/**
 * The medal over time, per adopted aspect — sub-project 4's second pass against
 * fact-source design §9.
 *
 * A `content` card rather than an `info` one: the chart needs the wide column,
 * and the badge it complements already lives in the info rail beside it.
 */
export function ComponentTrialHistoryCard() {
  const { entity } = useEntity();
  const { aspects, loading, error } = useComponentAspects(entity);

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (aspects.length === 0) return null;

  return (
    <InfoCard title="Medal history">
      {aspects.map(aspect => (
        <AspectHistory
          key={aspect.aspectId}
          entity={entity}
          aspectId={aspect.aspectId}
        />
      ))}
    </InfoCard>
  );
}
