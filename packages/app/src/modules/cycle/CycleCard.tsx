import { InfoCard, StructuredMetadataTable } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';

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
 * of / happens at. Occurrences (matches, deployments) are not modelled as
 * entities, so they are not shown here.
 */
export const CycleOverviewCard = () => {
  const { entity } = useEntity();
  const spec = (entity.spec ?? {}) as unknown as CycleSpec;
  const tf = spec.timeframe ?? {};

  const metadata: Record<string, string> = {
    Type: spec.type ?? '—',
    Timeframe: tf.start && tf.end ? `${tf.start} → ${tf.end}` : '—',
    'Part of': spec.of ?? '—',
    'Happens at': Array.isArray(spec.happensAt) && spec.happensAt.length > 0
      ? spec.happensAt.join(', ')
      : '—',
  };

  return (
    <InfoCard title="Cycle">
      <StructuredMetadataTable metadata={metadata} />
    </InfoCard>
  );
};
