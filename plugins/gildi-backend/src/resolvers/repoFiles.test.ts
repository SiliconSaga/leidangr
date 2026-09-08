import type { Trial } from '@siliconsaga/plugin-gildi-common';
import { repoFilesResolver } from './repoFiles';
import type { ResolverContext } from './types';

const GEMFILE: Trial = {
  id: 'gemfile-present',
  rule: 'a Gemfile declares the github-pages gem',
  artifact: 'Gemfile',
  factSource: 'repo-files',
  check: { type: 'file-contains', value: 'github-pages' },
  remediation: './docs/adopting.md',
};

const DEPLOY: Trial = {
  id: 'deploy-stub-points-at-volundr',
  rule: 'a job uses the shared workflow',
  artifact: '.github/workflows/deploy.yml',
  factSource: 'repo-files',
  check: {
    type: 'workflow-job-uses',
    value: 'SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@main',
  },
  remediation: './docs/adopting.md',
};

function ctx(files: Record<string, string | Error>): ResolverContext {
  return {
    entity: {} as any,
    sourceUrl: 'https://github.com/SiliconSaga/site/tree/main/',
    reader: {
      readUrl: async (url: string) => {
        const key = Object.keys(files).find(k => url.endsWith(k));
        const value = key ? files[key] : undefined;
        if (value === undefined) {
          const err = new Error('NotFound') as Error;
          err.name = 'NotFoundError';
          throw err;
        }
        if (value instanceof Error) throw value;
        return { buffer: async () => Buffer.from(value, 'utf8') };
      },
    } as any,
  };
}

describe('repo-files resolver', () => {
  it('passes when the file contains the value', async () => {
    const out = await repoFilesResolver.answer(
      GEMFILE,
      ctx({ Gemfile: 'source "https://rubygems.org"\ngem "github-pages"' }),
    );
    expect(out).toEqual({ state: 'pass' });
  });

  it('fails when the file exists without the value', async () => {
    const out = await repoFilesResolver.answer(GEMFILE, ctx({ Gemfile: 'gem "rails"' }));
    expect(out.state).toBe('fail');
  });

  // A MISSING ARTIFACT IS `fail`, NOT `unmeasured`. Absence is the answer — no
  // Gemfile means gemfile-present fails. Getting this backwards reports a
  // genuinely non-compliant repo as one we could not check. Design §3.
  it('fails when the artifact is absent', async () => {
    const out = await repoFilesResolver.answer(GEMFILE, ctx({}));
    expect(out.state).toBe('fail');
  });

  it('passes when a workflow job uses the exact value', async () => {
    const out = await repoFilesResolver.answer(
      DEPLOY,
      ctx({
        'deploy.yml': `jobs:
  deploy:
    uses: SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@main`,
      }),
    );
    expect(out).toEqual({ state: 'pass' });
  });

  // NEGATIVE CONTROL. Without this a substring match passes everything and the
  // trial looks green while checking nothing.
  it.each([
    ['a different ref', 'SiliconSaga/volundr/.github/workflows/jekyll-deploy.yml@v1'],
    ['a different repo', 'Other/volundr/.github/workflows/jekyll-deploy.yml@main'],
    ['a different workflow', 'SiliconSaga/volundr/.github/workflows/pr-preview.yml@main'],
  ])('fails on a near miss: %s', async (_label, uses) => {
    const out = await repoFilesResolver.answer(
      DEPLOY,
      ctx({ 'deploy.yml': `jobs:\n  deploy:\n    uses: ${uses}` }),
    );
    expect(out.state).toBe('fail');
  });

  it('fails a workflow with no jobs at all rather than erroring', async () => {
    const out = await repoFilesResolver.answer(DEPLOY, ctx({ 'deploy.yml': 'name: nothing' }));
    expect(out.state).toBe('fail');
  });

  it('is unmeasured with no source url, because we cannot look', async () => {
    const out = await repoFilesResolver.answer(GEMFILE, {
      ...ctx({}),
      sourceUrl: undefined,
    });
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-source' });
  });

  it('is unmeasured when the read errors for a reason other than absence', async () => {
    const out = await repoFilesResolver.answer(GEMFILE, ctx({ Gemfile: new Error('HTTP 403') }));
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'error' });
  });

  it('is unmeasured when the trial declares no check', async () => {
    const { check: _drop, ...noCheck } = GEMFILE;
    const out = await repoFilesResolver.answer(noCheck as Trial, ctx({ Gemfile: 'anything' }));
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-resolver' });
  });

  it('is unmeasured for a check type belonging to another resolver', async () => {
    const wrong = { ...GEMFILE, check: { type: 'pages-source-branch', value: 'gh-pages' } };
    const out = await repoFilesResolver.answer(wrong as Trial, ctx({ Gemfile: 'x' }));
    expect(out).toMatchObject({ state: 'unmeasured', reason: 'no-resolver' });
  });
});
