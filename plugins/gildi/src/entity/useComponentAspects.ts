import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';
import {
  ADOPTION_RECORD, ASPECT, ASPECTS, ASPECT_VERSIONS, MODULE_RELEASE,
  adoptionStatus, guildNameOf, parseKeyed, parseList, type AdoptionStatus,
} from './aspects';

export interface AspectAdoptionView {
  aspectId: string;
  adoptedVersion?: string;
  currentRelease?: string;
  status: AdoptionStatus;
  practiceRef?: string;
  practiceTitle?: string;
  guildName?: string;
  recordUrl?: string;
}

// One row per aspect this component adopted, joined to the practice that
// maintains it. An aspect can exist before a guild forms a practice around it
// (design §3.2), so practiceRef and currentRelease resolve INDEPENDENTLY —
// having an aspect id never implies there is a practice to link to.
export function useComponentAspects(entity: Entity) {
  const catalog = useApi(catalogApiRef);
  // Depend on the raw annotation strings, not the annotations object: a new
  // object identity per render would re-run the query every time.
  const aspectsRaw = entity.metadata.annotations?.[ASPECTS];
  const versionsRaw = entity.metadata.annotations?.[ASPECT_VERSIONS];
  const recordsRaw = entity.metadata.annotations?.[ADOPTION_RECORD];

  const state = useAsync(async () => {
    const ids = parseList(aspectsRaw);
    if (ids.length === 0) return [];

    const res = await catalog.getEntities({
      filter: { kind: 'Component', 'spec.type': 'practice' },
      // only the fields the join reads — avoid pulling full Component bodies
      fields: [
        'kind', 'metadata.name', 'metadata.title', 'metadata.namespace',
        'metadata.annotations', 'spec.owner',
      ],
    });
    const byAspect = new Map<string, Entity>();
    for (const p of res.items) {
      const id = p.metadata.annotations?.[ASPECT];
      if (id && !byAspect.has(id)) byAspect.set(id, p);
    }

    const versions = parseKeyed(versionsRaw, '@');
    const records = parseKeyed(recordsRaw, ':');

    return ids.map<AspectAdoptionView>(aspectId => {
      const practice = byAspect.get(aspectId);
      const adoptedVersion = versions.get(aspectId);
      const currentRelease = practice?.metadata.annotations?.[MODULE_RELEASE];
      return {
        aspectId,
        adoptedVersion,
        currentRelease,
        status: adoptionStatus(adoptedVersion, currentRelease),
        practiceRef: practice ? stringifyEntityRef(practice) : undefined,
        practiceTitle: practice ? practice.metadata.title ?? practice.metadata.name : undefined,
        guildName: practice ? guildNameOf(practice) : undefined,
        recordUrl: records.get(aspectId),
      };
    });
  }, [catalog, aspectsRaw, versionsRaw, recordsRaw]);

  return { aspects: state.value ?? [], loading: state.loading, error: state.error };
}
