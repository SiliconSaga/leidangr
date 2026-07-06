import { Entity } from '@backstage/catalog-model';
import { CatalogProcessorResult } from '@backstage/plugin-catalog-node';
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

  it('rejects a Cycle with a malformed spec.of ref', async () => {
    await expect(
      p.validateEntityKind(cycle({ ...validSpec, of: 'group:default/' })),
    ).rejects.toThrow(/spec\.of is not a valid entity ref/);
  });

  it('rejects a Cycle with an empty timeframe.start', async () => {
    await expect(
      p.validateEntityKind(
        cycle({ ...validSpec, timeframe: { start: '', end: '2026-06-15' } }),
      ),
    ).rejects.toThrow(/spec\.timeframe/);
  });
});

describe('CycleProcessor.postProcessEntity', () => {
  const p = new CycleProcessor();

  it('emits partOf/ownedBy/dependsOn relations for a Cycle', async () => {
    const emitted: CatalogProcessorResult[] = [];
    await p.postProcessEntity(
      cycle({
        type: 'season',
        of: 'group:default/mtl-soccer',
        owner: 'group:default/mtl-soccer',
        happensAt: ['resource:default/field-1'],
        timeframe: { start: '2026-03-01', end: '2026-06-15' },
      }),
      { type: 'file', target: 'examples/mtl.yaml' } as any,
      r => emitted.push(r),
    );

    const relations = emitted
      .filter(r => r.type === 'relation')
      .map(r => (r as any).relation);

    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'partOf',
          // getCompoundEntityRef preserves the entity's kind casing ('Cycle');
          // parseEntityRef on the lowercase ref strings yields 'group'/'resource'.
          source: expect.objectContaining({ kind: 'Cycle', name: 'soccer-2026-spring' }),
          target: expect.objectContaining({ kind: 'group', name: 'mtl-soccer' }),
        }),
        expect.objectContaining({ type: 'hasPart' }),
        expect.objectContaining({ type: 'ownedBy' }),
        expect.objectContaining({
          type: 'dependsOn',
          target: expect.objectContaining({ kind: 'resource', name: 'field-1' }),
        }),
        expect.objectContaining({ type: 'dependencyOf' }),
      ]),
    );
  });

  it('emits nothing for non-Cycle kinds', async () => {
    const emitted: CatalogProcessorResult[] = [];
    await p.postProcessEntity(
      { apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name: 'x' } },
      { type: 'file', target: 'x' } as any,
      r => emitted.push(r),
    );
    expect(emitted).toHaveLength(0);
  });
});
