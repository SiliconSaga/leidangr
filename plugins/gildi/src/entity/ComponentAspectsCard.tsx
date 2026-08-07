import type { CSSProperties } from 'react';
import { Chip, Divider, Link, Typography } from '@material-ui/core';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { Crest } from '../crest';
import { useComponentAspects, type AspectAdoptionView } from './useComponentAspects';

// Three columns: [identity] [body] [badge]. The identity column keeps its
// width when no crest resolves so rows stay aligned down the card, and the
// trailing column is the reserved home for the earned tier badge (hub design
// §8 — the badge belongs to the component, not the aspect).
const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px 1fr auto',
  gap: 8,
  alignItems: 'start',
  padding: '8px 0',
};

// The verdict line. 'enrolled' rather than a guess whenever either version is
// missing, and never a distance — see ./aspects adoptionStatus.
function verdict(a: AspectAdoptionView): string {
  if (a.status === 'current') return 'current';
  if (a.status === 'behind') return `behind · current ${a.currentRelease}`;
  return 'enrolled';
}

function AspectRow({ aspect }: { aspect: AspectAdoptionView }) {
  return (
    <div style={row}>
      <div>
        {aspect.guildName && (
          <Crest seed={aspect.guildName} size={24} title={`Arms of ${aspect.guildName}`} />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography variant="body2">{aspect.aspectId}</Typography>
          {aspect.adoptedVersion && (
            <Chip label={`v${aspect.adoptedVersion}`} size="small" variant="outlined" />
          )}
        </div>
        <Typography variant="caption" color="textSecondary">{verdict(aspect)}</Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {aspect.practiceRef && (
            <EntityRefLink entityRef={aspect.practiceRef}>{aspect.practiceTitle}</EntityRefLink>
          )}
          {aspect.recordUrl && (
            <Link href={aspect.recordUrl} target="_blank" rel="noopener noreferrer">record</Link>
          )}
        </div>
      </div>
      {/* Reserved for the earned tier badge. Empty today: no tier data exists,
          and a visible placeholder on every row reads as a broken card. */}
      <div data-testid={`aspect-badge-${aspect.aspectId}`} />
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
