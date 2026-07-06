import { Entity } from '@backstage/catalog-model';
import { CycleProcessor } from './CycleProcessor';

const cycle = (spec: unknown): Entity => ({
  apiVersion: 'siliconsaga.org/v1alpha1',
  kind: 'Cycle',
  metadata: { name: 'soccer-2026-spring' },
  spec: spec as Entity['spec'],
});

const validSpec = {
  type: 'season',
  of: 'group:default/mtl-soccer',
  owner: 'group:default/mtl-soccer',
  timeframe: { start: '2026-03-01', end: '2026-06-15' },
};

describe('CycleProcessor.validateEntityKind', () => {
  const p = new CycleProcessor();

  it('accepts a valid Cycle', async () => {
    await expect(p.validateEntityKind(cycle(validSpec))).resolves.toBe(true);
  });

  it('ignores non-Cycle kinds', async () => {
    const c: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'x' },
    };
    await expect(p.validateEntityKind(c)).resolves.toBe(false);
  });

  it('rejects a Cycle missing spec.type', async () => {
    const { type: _drop, ...noType } = validSpec;
    await expect(p.validateEntityKind(cycle(noType))).rejects.toThrow(
      /spec\.type is required/,
    );
  });

  it('rejects a Cycle missing timeframe', async () => {
    const { timeframe: _drop, ...noTf } = validSpec;
    await expect(p.validateEntityKind(cycle(noTf))).rejects.toThrow(
      /spec\.timeframe/,
    );
  });
});
