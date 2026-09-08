import type { Entity } from '@backstage/catalog-model';
import type { UrlReaderService } from '@backstage/backend-plugin-api';
import {
  unevaluatedVerdict,
  unmeasured,
  verdictFor,
  type Outcome,
  type Standard,
  type Verdict,
} from '@siliconsaga/plugin-gildi-common';
import { applicableTrials } from './facets';
import type { Resolver, ResolverContext } from './resolvers/types';

export interface EvaluateInput {
  entity: Entity;
  /** Undefined when the standard could not be found or read. */
  standard: Standard | undefined;
  sourceUrl?: string;
  reader: UrlReaderService;
  moduleRelease?: string;
  resolverFor: (factSource: string) => Resolver | undefined;
  pagesSourceBranch?: ResolverContext['pagesSourceBranch'];
  /** Per-trial budget. Defaults to TRIAL_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface RunResult {
  verdict: Verdict;
  outcomes: Array<{ trialId: string } & Outcome>;
  moduleRelease?: string;
}

// A trial is meant to be small: read one artifact, compare one value. Five
// minutes is not a performance target, it is the point past which the trial is
// the problem rather than the network. Bounding each trial rather than only the
// sweep means one slow resolver cannot stretch every component's run, and the
// detail says what to do about it.
export const TRIAL_TIMEOUT_MS = 5 * 60 * 1000;

// Races the budget AND aborts the work. Racing alone only stops waiting: the
// resolver's request would keep running, spending rate limit on an answer
// nobody will read, and at hourly sweeps those accumulate.
function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new Error(
          `${label} exceeded ${ms}ms. A trial should read one artifact and compare one value — make it smaller or faster rather than raising this budget.`,
        ),
      );
    }, ms);
  });
  return Promise.race([run(controller.signal), expiry]).finally(() =>
    clearTimeout(timer),
  ) as Promise<T>;
}

export async function evaluate(input: EvaluateInput): Promise<RunResult> {
  // No standard means we never learned what the trials ARE. Passing [] to
  // verdictFor would derive medal `none` — "measured, and nothing passed" —
  // publishing a verdict about a component on the strength of our own failure.
  // Design §7.
  if (!input.standard) {
    return {
      verdict: unevaluatedVerdict('no-standard'),
      outcomes: [],
      moduleRelease: input.moduleRelease,
    };
  }

  const ctx: ResolverContext = {
    entity: input.entity,
    sourceUrl: input.sourceUrl,
    reader: input.reader,
    pagesSourceBranch: input.pagesSourceBranch,
  };

  const trials = applicableTrials(input.entity, input.standard);
  const outcomes: Array<{ trialId: string } & Outcome> = [];

  for (const trial of trials) {
    const resolver = input.resolverFor(trial.factSource);
    if (!resolver) {
      outcomes.push({
        trialId: trial.id,
        ...unmeasured('no-resolver', `no resolver for ${trial.factSource}`),
      });
      continue;
    }
    // Isolated per trial, and BOUNDED per trial: a throwing or hanging resolver
    // marks only its own and never takes the rest of the run with it. Design §7.
    //
    // A timeout is unmeasured{error}, NOT fail. We never got an answer, and
    // calling that a failure would blame the component for our slow resolver —
    // the same inversion as treating a missing resolver as a failing trial. The
    // actionable message rides in the detail, where the trial's author reads it.
    try {
      outcomes.push({
        trialId: trial.id,
        ...(await withTimeout(
          signal => resolver.answer(trial, { ...ctx, signal }),
          input.timeoutMs ?? TRIAL_TIMEOUT_MS,
          `trial ${trial.id}`,
        )),
      });
    } catch (err) {
      outcomes.push({ trialId: trial.id, ...unmeasured('error', String(err)) });
    }
  }

  return {
    verdict: verdictFor(outcomes.map(({ trialId: _id, ...o }) => o as Outcome)),
    outcomes,
    moduleRelease: input.moduleRelease,
  };
}
