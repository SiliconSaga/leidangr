import {
  Entity,
  getCompoundEntityRef,
  parseEntityRef,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
  RELATION_PART_OF,
  RELATION_HAS_PART,
  RELATION_DEPENDS_ON,
  RELATION_DEPENDENCY_OF,
} from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  LocationSpec,
  processingResult,
} from '@backstage/plugin-catalog-node';

export const CYCLE_KIND = 'Cycle';

type CycleSpec = {
  type?: unknown;
  of?: unknown;
  owner?: unknown;
  happensAt?: unknown;
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

export class CycleProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'CycleProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    if (entity.kind !== CYCLE_KIND) {
      return false;
    }
    const spec = (entity.spec ?? {}) as CycleSpec;
    const errors: string[] = [];

    if (typeof spec.type !== 'string' || spec.type.trim() === '') {
      errors.push('spec.type is required');
    }

    // spec.of — required, and must be a parseable entity ref (default kind Group).
    if (typeof spec.of !== 'string' || spec.of.trim() === '') {
      errors.push('spec.of is required');
    } else if (!isParseableRef(spec.of, 'Group')) {
      errors.push(`spec.of is not a valid entity ref: "${spec.of}"`);
    }

    // spec.owner — optional, but if present must be a parseable entity ref.
    if (spec.owner !== undefined) {
      if (typeof spec.owner !== 'string' || spec.owner.trim() === '') {
        errors.push('spec.owner, if set, must be a non-empty entity ref');
      } else if (!isParseableRef(spec.owner, 'Group')) {
        errors.push(`spec.owner is not a valid entity ref: "${spec.owner}"`);
      }
    }

    // spec.happensAt — optional array of parseable entity refs (default kind Resource).
    if (spec.happensAt !== undefined) {
      if (!Array.isArray(spec.happensAt)) {
        errors.push('spec.happensAt, if set, must be an array of entity refs');
      } else {
        spec.happensAt.forEach((t, i) => {
          if (typeof t !== 'string' || t.trim() === '' || !isParseableRef(t, 'Resource')) {
            errors.push(`spec.happensAt[${i}] is not a valid entity ref: "${String(t)}"`);
          }
        });
      }
    }

    // spec.timeframe — required, with non-empty start/end strings.
    const tf = spec.timeframe;
    if (
      !tf ||
      typeof tf.start !== 'string' || tf.start.trim() === '' ||
      typeof tf.end !== 'string' || tf.end.trim() === ''
    ) {
      errors.push('spec.timeframe.start and spec.timeframe.end are required');
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid Cycle entity "${entity.metadata.name}": ${errors.join('; ')}`,
      );
    }
    return true;
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== CYCLE_KIND) {
      return entity;
    }
    const self = getCompoundEntityRef(entity);
    const spec = (entity.spec ?? {}) as CycleSpec;

    // of → partOf / hasPart (default parent kind: Group)
    const ofRef = parseEntityRef(spec.of as string, {
      defaultKind: 'Group',
      defaultNamespace: 'default',
    });
    emit(processingResult.relation({ source: self, type: RELATION_PART_OF, target: ofRef }));
    emit(processingResult.relation({ source: ofRef, type: RELATION_HAS_PART, target: self }));

    // owner → ownedBy / ownerOf
    if (typeof spec.owner === 'string' && spec.owner.trim() !== '') {
      const ownerRef = parseEntityRef(spec.owner, {
        defaultKind: 'Group',
        defaultNamespace: 'default',
      });
      emit(processingResult.relation({ source: self, type: RELATION_OWNED_BY, target: ownerRef }));
      emit(processingResult.relation({ source: ownerRef, type: RELATION_OWNER_OF, target: self }));
    }

    // happensAt → dependsOn / dependencyOf (default target kind: Resource)
    const happensAt = Array.isArray(spec.happensAt) ? spec.happensAt : [];
    for (const t of happensAt) {
      if (typeof t !== 'string') continue;
      const resRef = parseEntityRef(t, {
        defaultKind: 'Resource',
        defaultNamespace: 'default',
      });
      emit(processingResult.relation({ source: self, type: RELATION_DEPENDS_ON, target: resRef }));
      emit(processingResult.relation({ source: resRef, type: RELATION_DEPENDENCY_OF, target: self }));
    }

    return entity;
  }
}
