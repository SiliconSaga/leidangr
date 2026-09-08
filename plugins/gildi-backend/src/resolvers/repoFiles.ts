import { parse } from 'yaml';
import {
  fail,
  pass,
  unmeasured,
  type Outcome,
  type Trial,
} from '@siliconsaga/plugin-gildi-common';
import type { Resolver, ResolverContext } from './types';

// Absence of the artifact is an ANSWER, not an obstacle. Distinguished from a
// transport failure by the reader's NotFoundError, because "no Gemfile" must
// fail the trial while "HTTP 403" must not.
function isNotFound(err: unknown): boolean {
  return (err as { name?: string })?.name === 'NotFoundError';
}

function jobUses(body: string, expected: string): boolean {
  // Structural, not substring: `@v1` and `@main` differ by two characters, and
  // a substring match would accept either — the trial would look green while
  // checking nothing. Parsed so a job's `uses` is compared whole.
  let jobs: unknown;
  try {
    jobs = parse(body)?.jobs;
  } catch {
    return false;
  }
  if (!jobs || typeof jobs !== 'object') {
    return false;
  }
  return Object.values(jobs as Record<string, { uses?: unknown }>).some(
    job => typeof job?.uses === 'string' && job.uses.trim() === expected,
  );
}

export const repoFilesResolver: Resolver = {
  async answer(trial: Trial, ctx: ResolverContext): Promise<Outcome> {
    if (!ctx.sourceUrl) {
      return unmeasured('no-source', 'the component declares no source location');
    }
    const check = trial.check;
    if (!check) {
      return unmeasured('no-resolver', `trial ${trial.id} declares no check`);
    }
    if (check.type !== 'file-contains' && check.type !== 'workflow-job-uses') {
      // pages-source-branch belongs to the other resolver. Never a pass.
      return unmeasured('no-resolver', `repo-files cannot answer ${check.type}`);
    }

    let body: string;
    try {
      const base = ctx.sourceUrl.endsWith('/') ? ctx.sourceUrl : `${ctx.sourceUrl}/`;
      // signal forwarded so the trial's budget stops the request rather than
      // only the wait for it.
      const response = await ctx.reader.readUrl(new URL(trial.artifact, base).toString(), {
        signal: ctx.signal,
      });
      body = (await response.buffer()).toString('utf8');
    } catch (err) {
      if (isNotFound(err)) {
        return fail(`${trial.artifact} is not present`);
      }
      return unmeasured('error', `could not read ${trial.artifact}: ${err}`);
    }

    if (check.type === 'file-contains') {
      return body.includes(check.value)
        ? pass()
        : fail(`${trial.artifact} does not contain ${check.value}`);
    }
    return jobUses(body, check.value)
      ? pass()
      : fail(`no job in ${trial.artifact} uses ${check.value}`);
  },
};
