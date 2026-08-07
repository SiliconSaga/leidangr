import type { CSSProperties } from 'react';
import { Chip, Divider, Typography, makeStyles } from '@material-ui/core';
import CheckIcon from '@material-ui/icons/CheckCircleOutline';
import UpgradeIcon from '@material-ui/icons/ArrowUpward';
import { InfoCard, Link, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { entityRouteRef, useEntity } from '@backstage/plugin-catalog-react';
import { useRouteRef } from '@backstage/core-plugin-api';
import { parseEntityRef } from '@backstage/catalog-model';
import { Crest } from '../crest';
import { aspectLabel } from './aspects';
import { useComponentAspects, type AspectAdoptionView } from './useComponentAspects';

// Four columns: [identity] [name + links] [version pills] [badge]. The identity
// column keeps its width when no crest resolves and the pill column is
// right-aligned, so both edges form clean vertical lines down the card instead
// of ragged left-aligned text. The trailing column is the reserved home for the
// earned tier badge (hub design §8 — the badge belongs to the component).
const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px 1fr auto auto',
  columnGap: 8,
  rowGap: 2,
  alignItems: 'center',
  padding: '10px 0',
};

const pills: CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, justifySelf: 'end' };

// Links sit under the name, in the same grid column, so they indent with it.
const links: CSSProperties = {
  gridColumn: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
};

const chip: CSSProperties = { height: 20 };

// Currency colours come from the Backstage status palette rather than hardcoded
// hex, so they track the light and dark themes. Green/amber (not green/red) is
// the friendlier pair for red-green colour vision deficiency — and colour is
// never the only channel here: each state also carries its own icon and its own
// wording, so the card still reads correctly in greyscale.
const useStyles = makeStyles(theme => ({
  ok: { borderColor: theme.palette.status.ok, color: theme.palette.status.ok },
  behind: { borderColor: theme.palette.status.warning, color: theme.palette.status.warning },
}));

const statusIcon: CSSProperties = { color: 'inherit', fontSize: 14, marginLeft: 4 };

// Adopted version and currency, both as pills so they read as one row of state
// rather than a version chip followed by loose prose. The behind label leads
// with the word 'behind' rather than repeating 'current', so the two states are
// distinguishable from their first character and not just their colour.
// 'behind' names the other number but never a distance — equality tells us the
// versions differ, never how far (see ./aspects adoptionStatus).
function VersionPills({ aspect }: { aspect: AspectAdoptionView }) {
  const classes = useStyles();
  return (
    <div style={pills}>
      {aspect.adoptedVersion && (
        <Chip label={`v${aspect.adoptedVersion}`} size="small" variant="outlined" style={chip} />
      )}
      {aspect.status === 'current' && (
        <Chip
          label="current"
          icon={<CheckIcon style={statusIcon} />}
          size="small"
          variant="outlined"
          className={classes.ok}
          style={chip}
        />
      )}
      {aspect.status === 'behind' && (
        <Chip
          label={`behind · ${aspect.currentRelease}`}
          icon={<UpgradeIcon style={statusIcon} />}
          size="small"
          variant="outlined"
          className={classes.behind}
          style={chip}
        />
      )}
      {aspect.status === 'unknown' && !aspect.adoptedVersion && (
        <Chip label="enrolled" size="small" variant="outlined" style={chip} />
      )}
    </div>
  );
}

// A link that reads as a pill, matching the version chips. The anchor wraps a
// non-clickable Chip rather than using Chip's `component` prop: MUI v4 renders
// a `clickable` Chip as a ButtonBase, which would nest a <button> inside the
// <a> and report role="button" for something that navigates. core-components'
// Link routes internal paths through react-router and emits a plain anchor for
// external ones — exactly the split between the practice and the record.
function PillLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <Chip label={label} size="small" variant="outlined" style={{ ...chip, cursor: 'pointer' }} />
    </Link>
  );
}

function AspectRow({ aspect }: { aspect: AspectAdoptionView }) {
  const entityRoute = useRouteRef(entityRouteRef);

  let practiceHref: string | undefined;
  if (aspect.practiceRef) {
    const ref = parseEntityRef(aspect.practiceRef);
    practiceHref = entityRoute({
      kind: ref.kind.toLowerCase(),
      namespace: ref.namespace,
      name: ref.name,
    });
  }

  return (
    <div style={row}>
      <div>
        {aspect.guildName && (
          <Crest seed={aspect.guildName} size={26} title={`Arms of ${aspect.guildName}`} />
        )}
      </div>
      <Typography variant="body2" style={{ minWidth: 0 }}>
        {aspectLabel(aspect.aspectId)}
      </Typography>
      <VersionPills aspect={aspect} />
      {/* Reserved for the earned tier badge. Empty today: no tier data exists,
          and a visible placeholder on every row reads as a broken card. */}
      <div data-testid={`aspect-badge-${aspect.aspectId}`} />

      {(practiceHref || aspect.recordUrl) && (
        <div style={links}>
          {practiceHref && <PillLink to={practiceHref} label={aspect.practiceTitle!} />}
          {aspect.recordUrl && <PillLink to={aspect.recordUrl} label="record" />}
        </div>
      )}
    </div>
  );
}

// The adoption story read from the component's end: which aspects it adopted,
// at which version, and whether that is the practice's current release.
export function ComponentAspectsCard() {
  const { entity } = useEntity();
  const { aspects, loading, error } = useComponentAspects(entity);

  let body;
  if (loading) {
    body = <Progress />;
  } else if (error) {
    body = <ResponseErrorPanel error={error} />;
  } else {
    body = aspects.map((a, i) => (
      <div key={a.aspectId}>
        {i > 0 && <Divider />}
        <AspectRow aspect={a} />
      </div>
    ));
  }

  return <InfoCard title="Aspects">{body}</InfoCard>;
}
