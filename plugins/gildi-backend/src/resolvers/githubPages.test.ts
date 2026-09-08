import type { Trial } from '@siliconsaga/plugin-gildi-common';
import { githubPagesResolver } from './githubPages';
import type { ResolverContext } from './types';

const PAGES: Trial = {
  id: 'pages-source-is-gh-pages',
  rule: 'the Pages source branch is gh-pages',
  artifact: 'github-pages-settings',
  factSource: 'github-pages-api',
  check: { type: 'pages-source-branch', value: 'gh-pages' },
  remediation: './docs/pages-source.md',
};

const ctx = (over: Partial<ResolverContext>): ResolverContext =>
  ({
    entity: {} as any,
    sourceUrl: 'https://github.com/SiliconSaga/site/tree/main/',
    reader: {} as any,
    ...over,
  }) as ResolverContext;

describe('github-pages-api resolver', () => {
  it('passes when Pages serves the expected branch', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({ pagesSourceBranch: async () => 'gh-pages' }),
    );
    expect(out).toEqual({ state: 'pass' });
  });

  it('fails when Pages serves another branch', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({ pagesSourceBranch: async () => 'main' }),
    );
    expect(out.state).toBe('fail');
  });

  // Pages not configured is an ANSWER — the setting is not what the standard
  // requires — and this is the state a correct adoption sits in until a human
  // flips the switch, which is the entire point of the trial. It must not read
  // as unmeasured.
  it('fails when Pages is not configured at all', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({ pagesSourceBranch: async () => undefined }),
    );
    expect(out.state).toBe('fail');
  });

  // The different case: no credentials to ask with. A missing lookup must not
  // look like a non-compliant repository.
  it('is unmeasured when the plugin has no way to ask', async () => {
    const out = await githubPagesResolver.answer(PAGES, ctx({ pagesSourceBranch: undefined }));
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-resolver' });
  });

  it('is unmeasured when the lookup throws', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({
        pagesSourceBranch: async () => {
          throw new Error('HTTP 403');
        },
      }),
    );
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'error' });
  });

  it('is unmeasured with no source url', async () => {
    const out = await githubPagesResolver.answer(
      PAGES,
      ctx({ sourceUrl: undefined, pagesSourceBranch: async () => 'gh-pages' }),
    );
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-source' });
  });

  it('is unmeasured for a check type belonging to another resolver', async () => {
    const wrong = { ...PAGES, check: { type: 'file-contains', value: 'x' } };
    const out = await githubPagesResolver.answer(
      wrong as Trial,
      ctx({ pagesSourceBranch: async () => 'gh-pages' }),
    );
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-resolver' });
  });
});
