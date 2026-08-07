import { isAdoptingComponent, isUnenrolledComponent } from './index';

const entity = (kind: string, annotations: Record<string, string> = {}) => ({
  apiVersion: 'backstage.io/v1alpha1', kind,
  metadata: { name: 'x', annotations },
  spec: { type: 'service' },
}) as any;

const ENROLLED = { 'siliconsaga.org/aspects': 'security' };

describe('component card filters', () => {
  it('are complements on Components — exactly one matches any given component', () => {
    for (const e of [entity('Component', ENROLLED), entity('Component')]) {
      expect(isAdoptingComponent(e)).toBe(!isUnenrolledComponent(e));
    }
  });

  it('match an enrolled component only for the aspects card', () => {
    const e = entity('Component', ENROLLED);
    expect(isAdoptingComponent(e)).toBe(true);
    expect(isUnenrolledComponent(e)).toBe(false);
  });

  it('match an unenrolled component only for the adopt card', () => {
    const e = entity('Component');
    expect(isAdoptingComponent(e)).toBe(false);
    expect(isUnenrolledComponent(e)).toBe(true);
  });

  it('treat a blank annotation as unenrolled', () => {
    const e = entity('Component', { 'siliconsaga.org/aspects': ' , ' });
    expect(isAdoptingComponent(e)).toBe(false);
    expect(isUnenrolledComponent(e)).toBe(true);
  });

  it('match NEITHER for a non-Component kind, however annotated', () => {
    for (const kind of ['Group', 'Template', 'API', 'Resource']) {
      expect(isAdoptingComponent(entity(kind, ENROLLED))).toBe(false);
      expect(isUnenrolledComponent(entity(kind))).toBe(false);
    }
  });
});
