import { pass } from '@siliconsaga/plugin-gildi-common';
import type { Standard } from '@siliconsaga/plugin-gildi-common';
import { evaluate } from './evaluate';

const STANDARD: Standard = {
  id: 'website-hygiene',
  aspect: 'website-hygiene',
  facetDefaults: { website: ['web-ui'] },
  blocks: [
    {
      id: 'build',
      appliesTo: ['web-ui'],
      trials: [
        {
          id: 'a',
          rule: 'r',
          artifact: 'A',
          factSource: 'repo-files',
          check: { type: 'file-contains', value: 'x' },
          remediation: './f.md',
        },
        {
          id: 'b',
          rule: 'r',
          artifact: 'B',
          factSource: 'nope',
          remediation: './f.md',
        },
      ],
    },
  ],
};

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'site' },
  spec: { type: 'website' },
} as any;

const base = {
  entity,
  sourceUrl: 'https://github.com/o/r/tree/main/',
  reader: {} as any,
  moduleRelease: '1.1',
};

describe('evaluate', () => {
  it('answers each applicable trial through its resolver', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      resolverFor: kind => (kind === 'repo-files' ? { answer: async () => pass() } : undefined),
    });
    expect(result.outcomes).toEqual([
      { trialId: 'a', state: 'pass' },
      // An unregistered factSource is unmeasured, never a pass.
      {
        trialId: 'b',
        state: 'unmeasured',
        reason: 'no-resolver',
        detail: 'no resolver for nope',
      },
    ]);
    expect(result.verdict.kind).toBe('suppressed');
  });

  it('records the module release on the run', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      resolverFor: () => ({ answer: async () => pass() }),
    });
    expect(result.moduleRelease).toBe('1.1');
  });

  // ISOLATION. A resolver that throws must not take the others with it.
  it('isolates a throwing resolver to its own trials', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      resolverFor: kind =>
        kind === 'repo-files'
          ? {
              answer: async () => {
                throw new Error('boom');
              },
            }
          : undefined,
    });
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes[0]).toMatchObject({
      trialId: 'a',
      state: 'unmeasured',
      reason: 'error',
    });
  });

  // A hanging resolver must not stretch the run, and the message has to tell
  // the trial's author what to do. Unmeasured rather than fail: we never got an
  // answer, so blaming the component would be the wrong way round.
  it('bounds a hanging trial and says how to fix it', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      timeoutMs: 20,
      resolverFor: kind =>
        kind === 'repo-files'
          ? { answer: () => new Promise(() => {}) as Promise<never> }
          : undefined,
    });
    expect(result.outcomes[0]).toMatchObject({
      trialId: 'a',
      state: 'unmeasured',
      reason: 'error',
    });
    // Narrowed explicitly: `detail` exists only on the fail and unmeasured
    // arms, and the union is what stops a caller reading it off a pass.
    const timedOut = result.outcomes[0] as { detail?: string };
    expect(timedOut.detail).toMatch(/smaller or faster/);
    // The other trial still got its answer.
    expect(result.outcomes).toHaveLength(2);
  });

  it('aborts the signal it handed the resolver when the budget expires', async () => {
    // Racing a promise ends the wait, not the work. Without the abort the
    // request keeps running against a rate limit nobody is waiting on.
    let seen: AbortSignal | undefined;
    await evaluate({
      ...base,
      standard: STANDARD,
      timeoutMs: 20,
      resolverFor: () => ({
        answer: async (_t, c) => {
          seen = c.signal;
          return new Promise(() => {}) as Promise<never>;
        },
      }),
    });
    expect(seen?.aborted).toBe(true);
  });

  // THE DISTINCTION THAT MATTERS MOST. No standard means we never learned what
  // the trials are, so the run is unevaluated — not an empty applicable set,
  // which would derive a confident medal `none`.
  it('returns an unevaluated run when the standard is absent', async () => {
    const result = await evaluate({ ...base, standard: undefined, resolverFor: () => undefined });
    expect(result.verdict).toMatchObject({ kind: 'unevaluated', reason: 'no-standard' });
    expect(result.outcomes).toEqual([]);
    expect(result.verdict).not.toMatchObject({ kind: 'medal' });
  });

  it('awards a medal when everything applicable passes', async () => {
    const oneTrial: Standard = {
      ...STANDARD,
      blocks: [{ ...STANDARD.blocks[0], trials: [STANDARD.blocks[0].trials[0]] }],
    };
    const result = await evaluate({
      ...base,
      standard: oneTrial,
      resolverFor: () => ({ answer: async () => pass() }),
    });
    expect(result.verdict).toMatchObject({
      kind: 'medal',
      medal: 'gold',
      applicable: 1,
      passing: 1,
    });
  });

  it('marks every trial unmeasured when no resolver is registered', async () => {
    const result = await evaluate({
      ...base,
      standard: STANDARD,
      resolverFor: () => undefined,
    });
    expect(result.outcomes.every(o => o.state === 'unmeasured')).toBe(true);
  });
});
