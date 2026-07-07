import { Entity } from '@backstage/catalog-model';
import { CatalogProcessorResult } from '@backstage/plugin-catalog-node';
import { SagaProcessor } from './SagaProcessor';

const saga = (
  opts: { spec?: unknown; annotations?: Record<string, string> } = {},
): Entity => ({
  apiVersion: 'siliconsaga.org/v1alpha1',
  kind: 'Saga',
  metadata: {
    name: 'saga-soccer-2026-spring',
    annotations:
      opts.annotations ?? {
        'siliconsaga.org/saga-doc': './sagas/soccer-2026-spring.md',
      },
  },
  spec: opts.spec as Entity['spec'],
});

const validSpec = {
  skald: 'user:default/guest',
  timeframe: { start: '2026-03-01', end: '2026-06-15' },
  touches: [
    'cycle:default/soccer-2026-spring',
    'group:default/mtl-soccer',
    'resource:default/field-1',
  ],
  owner: 'group:default/mtl-soccer',
};

describe('SagaProcessor.validateEntityKind', () => {
  const p = new SagaProcessor();

  it('accepts a valid Saga', async () => {
    await expect(p.validateEntityKind(saga({ spec: validSpec }))).resolves.toBe(true);
  });

  it('ignores non-Saga kinds', async () => {
    const c: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'x' },
    };
    await expect(p.validateEntityKind(c)).resolves.toBe(false);
  });

  it('rejects a Saga missing skald', async () => {
    const { skald: _drop, ...noSkald } = validSpec;
    await expect(p.validateEntityKind(saga({ spec: noSkald }))).rejects.toThrow(
      /spec\.skald is required/,
    );
  });

  it('rejects a Saga with empty touches', async () => {
    await expect(
      p.validateEntityKind(saga({ spec: { ...validSpec, touches: [] } })),
    ).rejects.toThrow(/spec\.touches/);
  });

  it('rejects a Saga missing the saga-doc annotation', async () => {
    await expect(
      p.validateEntityKind(saga({ spec: validSpec, annotations: {} })),
    ).rejects.toThrow(/saga-doc/);
  });
});

describe('SagaProcessor.postProcessEntity', () => {
  const p = new SagaProcessor();

  it('emits ownedBy (skald + owner) and dependsOn (touches)', async () => {
    const emitted: CatalogProcessorResult[] = [];
    await p.postProcessEntity(
      saga({ spec: validSpec }),
      { type: 'file', target: 'examples/mtl.yaml' } as any,
      r => emitted.push(r),
    );
    const rels = emitted
      .filter(r => r.type === 'relation')
      .map(r => (r as any).relation);

    expect(rels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'ownedBy',
          target: expect.objectContaining({ kind: 'user', name: 'guest' }),
        }),
        expect.objectContaining({
          type: 'ownedBy',
          target: expect.objectContaining({ kind: 'group', name: 'mtl-soccer' }),
        }),
        expect.objectContaining({
          type: 'dependsOn',
          target: expect.objectContaining({ kind: 'cycle', name: 'soccer-2026-spring' }),
        }),
        expect.objectContaining({
          type: 'dependsOn',
          target: expect.objectContaining({ kind: 'resource', name: 'field-1' }),
        }),
      ]),
    );
  });

  it('emits nothing for non-Saga kinds', async () => {
    const emitted: CatalogProcessorResult[] = [];
    await p.postProcessEntity(
      { apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name: 'x' } },
      { type: 'file', target: 'x' } as any,
      r => emitted.push(r),
    );
    expect(emitted).toHaveLength(0);
  });
});
