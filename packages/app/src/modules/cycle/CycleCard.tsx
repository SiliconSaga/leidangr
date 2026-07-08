import { InfoCard, StructuredMetadataTable } from '@backstage/core-components';
import {
  EntityRefLink,
  EntityRefLinks,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { parseEntityRef } from '@backstage/catalog-model';

type CycleSpec = {
  type?: string;
  timeframe?: { start?: string; end?: string };
  of?: string;
  owner?: string;
  happensAt?: string[];
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

  const metadata: Record<string, string | JSX.Element> = {
    Type: spec.type ?? '—',
    Timeframe: tf.start && tf.end ? `${tf.start} → ${tf.end}` : '—',
    'Part of': spec.of
      ? <EntityRefLink entityRef={parseEntityRef(spec.of, { defaultKind: 'Group' })} />
      : '—',
    'Happens at': Array.isArray(spec.happensAt) && spec.happensAt.length > 0
      ? <EntityRefLinks entityRefs={spec.happensAt.map(t => parseEntityRef(t, { defaultKind: 'Resource' }))} />
      : '—',
  };

  return (
    <InfoCard title="Cycle">
      <StructuredMetadataTable metadata={metadata} />
    </InfoCard>
  );
};
