import { InfoCard, StructuredMetadataTable } from '@backstage/core-components';
import {
  EntityRefLink,
  EntityRefLinks,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { CompoundEntityRef, parseEntityRef } from '@backstage/catalog-model';

type CycleSpec = {
  type?: string;
  timeframe?: { start?: string; end?: string };
  of?: string;
  owner?: string;
  happensAt?: string[];
};

// parseEntityRef throws on a malformed ref; never let a bad seed value break the
// card render — fall back to the dash placeholder instead.
const safeRef = (
  ref: string,
  defaultKind: string,
): CompoundEntityRef | undefined => {
  try {
    return parseEntityRef(ref, { defaultKind, defaultNamespace: 'default' });
  } catch {
    return undefined;
  }
};

/**
 * Curated overview card for the custom `Cycle` kind — surfaces the fields the
 * default entity page buries: the type, the timeframe, and what the Cycle is
 * of / happens at (rendered as clickable catalog links). Occurrences (matches,
 * deployments) are not modelled as entities, so they are not shown here.
 */
export const CycleOverviewCard = () => {
  const { entity } = useEntity();
  const spec = (entity.spec ?? {}) as unknown as CycleSpec;
  const tf = spec.timeframe ?? {};

  const ofRef = spec.of ? safeRef(spec.of, 'Group') : undefined;
  const happensAtRefs = (Array.isArray(spec.happensAt) ? spec.happensAt : [])
    .map(t => safeRef(t, 'Resource'))
    .filter((r): r is CompoundEntityRef => r !== undefined);

  const metadata: Record<string, string | JSX.Element> = {
    Type: spec.type ?? '—',
    Timeframe: tf.start && tf.end ? `${tf.start} → ${tf.end}` : '—',
    'Part of': ofRef ? <EntityRefLink entityRef={ofRef} /> : '—',
    'Happens at': happensAtRefs.length > 0
      ? <EntityRefLinks entityRefs={happensAtRefs} />
      : '—',
  };

  return (
    <InfoCard title="Cycle">
      <StructuredMetadataTable metadata={metadata} />
    </InfoCard>
  );
};
