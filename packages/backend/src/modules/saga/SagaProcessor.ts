import {
  Entity,
  getCompoundEntityRef,
  parseEntityRef,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
  RELATION_DEPENDS_ON,
  RELATION_DEPENDENCY_OF,
} from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  LocationSpec,
  processingResult,
} from '@backstage/plugin-catalog-node';

export const SAGA_KIND = 'Saga';
export const SAGA_DOC_ANNOTATION = 'siliconsaga.org/saga-doc';

type SagaSpec = {
  skald?: unknown;
  owner?: unknown;
  touches?: unknown;
  timeframe?: { start?: unknown; end?: unknown };
};

/** True if `ref` parses as a valid entity reference (with the given default kind). */
function isParseableRef(ref: string, defaultKind: string): boolean {
  try {
    parseEntityRef(ref, { defaultKind, defaultNamespace: 'default' });
    return true;
  } catch {
    return false;
  }
}

export class SagaProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'SagaProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    if (entity.kind !== SAGA_KIND) {
      return false;
    }
    const spec = (entity.spec ?? {}) as SagaSpec;
    const errors: string[] = [];

    // skald — required author (a User ref).
    if (typeof spec.skald !== 'string' || spec.skald.trim() === '') {
      errors.push('spec.skald is required');
    } else if (!isParseableRef(spec.skald, 'User')) {
      errors.push(`spec.skald is not a valid entity ref: "${spec.skald}"`);
    }

    // owner — optional Group ref.
    if (spec.owner !== undefined) {
      if (typeof spec.owner !== 'string' || spec.owner.trim() === '') {
        errors.push('spec.owner, if set, must be a non-empty entity ref');
      } else if (!isParseableRef(spec.owner, 'Group')) {
        errors.push(`spec.owner is not a valid entity ref: "${spec.owner}"`);
      }
    }

    // touches — required, non-empty array of entity refs the Saga narrates.
    if (!Array.isArray(spec.touches) || spec.touches.length === 0) {
      errors.push('spec.touches must be a non-empty array of entity refs');
    } else {
      spec.touches.forEach((t, i) => {
        if (typeof t !== 'string' || t.trim() === '' || !isParseableRef(t, 'Component')) {
          errors.push(`spec.touches[${i}] is not a valid entity ref: "${String(t)}"`);
        }
      });
    }

    // timeframe — required, with non-empty start/end strings.
    const tf = spec.timeframe;
    if (
      !tf ||
      typeof tf.start !== 'string' || tf.start.trim() === '' ||
      typeof tf.end !== 'string' || tf.end.trim() === ''
    ) {
      errors.push('spec.timeframe.start and spec.timeframe.end are required');
    }

    // saga-doc annotation — required pointer to the Git-backed narrative body.
    const doc = entity.metadata.annotations?.[SAGA_DOC_ANNOTATION];
    if (typeof doc !== 'string' || doc.trim() === '') {
      errors.push(
        `the ${SAGA_DOC_ANNOTATION} annotation (path to the narrative) is required`,
      );
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid Saga entity "${entity.metadata.name}": ${errors.join('; ')}`,
      );
    }
    return true;
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== SAGA_KIND) {
      return entity;
    }
    const self = getCompoundEntityRef(entity);
    const spec = (entity.spec ?? {}) as SagaSpec;

    // skald → ownedBy / ownerOf (the authoring User owns the Saga)
    if (typeof spec.skald === 'string' && spec.skald.trim() !== '') {
      const skaldRef = parseEntityRef(spec.skald, {
        defaultKind: 'User',
        defaultNamespace: 'default',
      });
      emit(processingResult.relation({ source: self, type: RELATION_OWNED_BY, target: skaldRef }));
      emit(processingResult.relation({ source: skaldRef, type: RELATION_OWNER_OF, target: self }));
    }

    // owner → ownedBy / ownerOf (co-owning Group)
    if (typeof spec.owner === 'string' && spec.owner.trim() !== '') {
      const ownerRef = parseEntityRef(spec.owner, {
        defaultKind: 'Group',
        defaultNamespace: 'default',
      });
      emit(processingResult.relation({ source: self, type: RELATION_OWNED_BY, target: ownerRef }));
      emit(processingResult.relation({ source: ownerRef, type: RELATION_OWNER_OF, target: self }));
    }

    // touches[] → dependsOn / dependencyOf (the entities the Saga narrates)
    const touches = Array.isArray(spec.touches) ? spec.touches : [];
    for (const t of touches) {
      if (typeof t !== 'string') continue;
      const ref = parseEntityRef(t, {
        defaultKind: 'Component',
        defaultNamespace: 'default',
      });
      emit(processingResult.relation({ source: self, type: RELATION_DEPENDS_ON, target: ref }));
      emit(processingResult.relation({ source: ref, type: RELATION_DEPENDENCY_OF, target: self }));
    }

    return entity;
  }
}
