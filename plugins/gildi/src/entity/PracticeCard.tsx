import { Chip, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import { Crest } from '../crest';

const ASPECT = 'siliconsaga.org/aspect';

// Identity card for a practice (Component spec.type:practice): what it maintains
// and which guild runs it — the run-by line reuses the guild's crest to tie the
// practice visually to its gildi.
export function PracticeCard() {
  const { entity } = useEntity();
  const title = entity.metadata.title ?? entity.metadata.name;
  const aspect = entity.metadata.annotations?.[ASPECT];

  const owner = (entity.spec?.owner as string) ?? '';
  let guild: { name: string; ref: string } | undefined;
  if (owner) {
    try {
      const ref = parseEntityRef(owner, { defaultKind: 'Group', defaultNamespace: 'default' });
      if (ref.kind.toLowerCase() === 'group') {
        guild = { name: ref.name, ref: stringifyEntityRef(ref) };
      }
    } catch {
      // leave undefined for a malformed owner ref rather than breaking the card
    }
  }

  return (
    <InfoCard title="Practice">
      <div style={{ minWidth: 0 }}>
        <Typography variant="h6">{title}</Typography>
        {entity.metadata.description && (
          <Typography variant="body2" color="textSecondary" style={{ margin: '4px 0 8px' }}>
            {entity.metadata.description}
          </Typography>
        )}
        {aspect && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Typography variant="caption" color="textSecondary">Maintains</Typography>
            <Chip label={`${aspect} aspect`} size="small" variant="outlined" />
          </div>
        )}
        {guild && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography variant="caption" color="textSecondary">Run by</Typography>
            <Crest seed={guild.name} size={24} title={`Arms of ${guild.name}`} />
            <EntityRefLink entityRef={guild.ref} />
          </div>
        )}
      </div>
    </InfoCard>
  );
}
