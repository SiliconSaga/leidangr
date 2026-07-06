import { Entity } from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  LocationSpec,
} from '@backstage/plugin-catalog-node';

export const CYCLE_KIND = 'Cycle';

type CycleSpec = {
  type?: unknown;
  of?: unknown;
  owner?: unknown;
  happensAt?: unknown;
  timeframe?: { start?: unknown; end?: unknown };
};

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
    if (typeof spec.of !== 'string' || spec.of.trim() === '') {
      errors.push('spec.of is required');
    }
    const tf = spec.timeframe;
    if (!tf || typeof tf.start !== 'string' || typeof tf.end !== 'string') {
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
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    // Relation emission added in Task 2.
    return entity;
  }
}
