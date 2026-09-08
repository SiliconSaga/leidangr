import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import {
  ANNOTATION_SOURCE_LOCATION,
  parseLocationRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import type { Entity } from '@backstage/catalog-model';
import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import { Octokit } from '@octokit/rest';
import { evaluate } from './evaluate';
import { resolverFor } from './resolvers/registry';
import { loadStandard, standardUrlFor } from './standard';
import { DatabaseTrialResultStore, type TrialRun } from './store';
import { createRouter } from './router';

const ASPECTS = 'siliconsaga.org/aspects';
const ASPECT = 'siliconsaga.org/aspect';
const MODULE_RELEASE = 'siliconsaga.org/module-release';

// Two tiers, sized so a fixed row budget covers most of a year rather than
// three weeks. A week at full hourly resolution is 168 rows, and every day
// beyond that costs one more — so 500 reaches roughly eleven months. A flat
// count at hourly resolution would run out after twenty days, which is inside
// the window where "when did this break" is usually asked.
const RUNS_KEPT_PER_SUBJECT = 500;
const HOURLY_RETENTION_DAYS = 7;

// The scheduler's `timeout` releases the task but does NOT stop `fn`, so the
// sweep needs a deadline of its own, set inside the scheduled timeout so the
// workers stop before the next invocation can overlap them.
const SWEEP_DEADLINE_MS = 9 * 60 * 1000;
const SWEEP_CONCURRENCY = 3;

// `https://github.com/owner/repo/tree/main/` -> { owner, repo }. The Pages API
// needs the slug, and the source location is a tree URL rather than a repo URL.
function parseGithubSlug(sourceUrl: string): { owner: string; repo: string } {
  const [, owner, repo] = new URL(sourceUrl).pathname.split('/');
  if (!owner || !repo) {
    throw new Error(`cannot parse an owner and repo from ${sourceUrl}`);
  }
  return { owner, repo };
}

const sourceUrlOf = (entity: Entity): string | undefined => {
  const raw = entity.metadata.annotations?.[ANNOTATION_SOURCE_LOCATION];
  if (!raw) return undefined;
  try {
    return parseLocationRef(raw).target;
  } catch {
    return undefined;
  }
};

const aspectsOf = (entity: Entity): string[] =>
  (entity.metadata.annotations?.[ASPECTS] ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// stringifyEntityRef rather than hand-formatting: it lowercases kind, namespace
// and name, which is the canonical spelling every reader uses. Formatting the
// metadata verbatim stores `component:default/MySite` while the frontend asks
// for `component:default/mysite`, and the two never meet — a permanent 404 that
// reads as though the sweep never ran.
const refOf = (entity: Entity): string => stringifyEntityRef(entity);

export const gildiPlugin = createBackendPlugin({
  pluginId: 'gildi',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        scheduler: coreServices.scheduler,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        reader: coreServices.urlReader,
        catalog: catalogServiceRef,
      },
      async init({
        config,
        logger,
        database,
        scheduler,
        httpRouter,
        httpAuth,
        auth,
        reader,
        catalog,
      }) {
        const store = await DatabaseTrialResultStore.create(database);

        // WITHOUT THIS THE FEATURE NEVER AWARDS A MEDAL. pages-source-is-gh-pages
        // applies to every website component, and a resolver with no way to ask
        // returns unmeasured — which suppresses the medal. One unwired lookup
        // therefore suppresses every medal in the catalog, permanently and
        // silently. The resolver was built with the lookup on its context to
        // stay testable, and this is where that context gets filled in.
        const integrations = ScmIntegrations.fromConfig(config);
        const githubCredentials =
          DefaultGithubCredentialsProvider.fromIntegrations(integrations);

        // Hosts we can actually ask, taken from the configured integrations so
        // GitHub Enterprise counts too. Derived from the integration LIST
        // rather than from `byUrl` returning something, because a missing
        // credential and a non-GitHub host are different problems that
        // `byUrl` cannot tell apart.
        const githubHosts = new Set(
          integrations.github.list().map(i => i.config.host),
        );

        const pagesSourceBranch = async (
          sourceUrl: string,
        ): Promise<string | undefined> => {
          // A Gitea or GitLab component cannot be asked about GitHub Pages, and
          // must not be told it FAILED the trial — `undefined` means "Pages is
          // off", a real verdict about a repository we never queried. Throwing
          // reaches the resolver as unmeasured{error}, which withholds the
          // medal and says why instead of blaming the component.
          const host = new URL(sourceUrl).hostname;
          if (!githubHosts.has(host)) {
            throw new Error(
              `${host} is not a configured GitHub host, so its Pages settings cannot be read`,
            );
          }
          const { owner, repo } = parseGithubSlug(sourceUrl);
          const { token } = await githubCredentials.getCredentials({
            url: sourceUrl,
          });
          const octokit = new Octokit({
            auth: token,
            baseUrl: integrations.github.byUrl(sourceUrl)?.config.apiBaseUrl,
          });
          try {
            const { data } = await octokit.rest.repos.getPages({ owner, repo });
            return data.source?.branch;
          } catch (err) {
            // 404 means Pages is NOT CONFIGURED, which is an answer the trial
            // can act on rather than an error. Anything else genuinely failed
            // and must reach the resolver as one.
            if ((err as { status?: number }).status === 404) {
              return undefined;
            }
            throw err;
          }
        };

        // The practice that owns an aspect. Filtered on `spec.type` as well as
        // the annotation, matching how practices are identified everywhere else
        // in the catalog, so a stray Component carrying the same annotation
        // cannot be picked instead.
        const findPractice = async (
          aspectId: string,
          credentials: Awaited<ReturnType<typeof auth.getOwnServiceCredentials>>,
        ): Promise<Entity | undefined> => {
          const practices = await catalog.getEntities(
            {
              filter: {
                kind: 'Component',
                'spec.type': 'practice',
                [`metadata.annotations.${ASPECT}`]: aspectId,
              },
            },
            { credentials },
          );
          return practices.items[0];
        };

        /**
         * One entity, one aspect, one run row. Shared by the scheduled sweep
         * and the refresh endpoint so both paths cannot drift.
         *
         * `practices` is an optional lookup cache. Every component enrolled in
         * an aspect resolves the SAME practice, so a fleet sweep would
         * otherwise repeat one identical catalog query per component per
         * aspect. The sweep passes a cache scoped to that sweep — never a
         * long-lived one, since a practice's standard URL and release are
         * exactly the things a run is meant to notice changing. Refresh passes
         * nothing and always reads fresh.
         */
        const runOne = async (
          entityRef: string,
          aspectId: string,
          practices?: Map<string, Promise<Entity | undefined>>,
        ): Promise<TrialRun> => {
          const credentials = await auth.getOwnServiceCredentials();
          const entity = await catalog.getEntityByRef(entityRef, {
            credentials,
          });
          if (!entity) {
            throw new Error(`no such entity: ${entityRef}`);
          }

          // The PROMISE is cached, not the result, so concurrent workers
          // reaching the same aspect at once share one query rather than each
          // starting their own before the first has resolved.
          let pending = practices?.get(aspectId);
          if (!pending) {
            pending = findPractice(aspectId, credentials);
            practices?.set(aspectId, pending);
          }
          const practice = await pending;
          const standardUrl = practice ? standardUrlFor(practice) : undefined;

          let standard;
          let detail: string | undefined;
          if (standardUrl) {
            try {
              standard = await loadStandard(reader, standardUrl);
            } catch (err) {
              detail = String(err);
            }
          } else {
            detail = `practice for ${aspectId} declares no standard`;
          }

          const result = await evaluate({
            entity,
            standard,
            sourceUrl: sourceUrlOf(entity),
            reader,
            moduleRelease: practice?.metadata.annotations?.[MODULE_RELEASE],
            resolverFor,
            pagesSourceBranch,
          });

          const v = result.verdict;
          const run: TrialRun = {
            entityRef,
            aspectId,
            runAt: new Date().toISOString(),
            kind: v.kind === 'unevaluated' ? 'unevaluated' : 'evaluated',
            moduleRelease: result.moduleRelease,
            medal: v.kind === 'medal' ? v.medal : null,
            suppressedReasons: v.kind === 'suppressed' ? v.reasons : null,
            applicable: v.kind === 'unevaluated' ? null : v.applicable,
            passing: v.kind === 'unevaluated' ? null : v.passing,
            outcomes: v.kind === 'unevaluated' ? null : result.outcomes,
            unevaluatedReason: v.kind === 'unevaluated' ? v.reason : undefined,
            unevaluatedDetail:
              v.kind === 'unevaluated' ? (v.detail ?? detail) : undefined,
          };
          await store.append(run);
          return run;
        };

        httpRouter.use(createRouter({ store, httpAuth, refresh: runOne }));

        await scheduler.scheduleTask({
          id: 'gildi-trial-sweep',
          frequency: { hours: 1 },
          timeout: { minutes: 10 },
          // Staggered so a restart does not run a network sweep during boot,
          // when the process is already busy.
          initialDelay: { minutes: 2 },
          async fn() {
            const credentials = await auth.getOwnServiceCredentials();
            const { items } = await catalog.getEntities(
              { filter: { kind: 'Component' } },
              { credentials },
            );
            const enrolled = items.filter(e => aspectsOf(e).length > 0);

            // Fleet-level bound, distinct from the per-trial timeout in
            // evaluate.ts: that one stops a slow trial stretching a run, this
            // one stops N components' worth of GitHub calls going out at once.
            // Small fixed concurrency rather than Promise.all over every
            // component, so the sweep cannot saturate the GitHub API or the
            // event loop as adoption grows.
            //
            // The deadline is checked before admitting work rather than
            // mid-flight, so a run in progress is never abandoned
            // half-recorded.
            const sweepDeadline = Date.now() + SWEEP_DEADLINE_MS;
            const queue = [...enrolled];
            // Scoped to this sweep and discarded with it. A practice's standard
            // URL and module release are what a run exists to notice changing,
            // so caching them across sweeps would hide the change the next
            // sweep is there to catch.
            const practices = new Map<string, Promise<Entity | undefined>>();
            const worker = async () => {
              for (let e = queue.shift(); e; e = queue.shift()) {
                if (Date.now() > sweepDeadline) {
                  logger.warn(
                    `gildi: sweep deadline reached, ${queue.length + 1} components deferred to the next run`,
                  );
                  return;
                }
                const ref = refOf(e);
                for (const aspectId of aspectsOf(e)) {
                  try {
                    await runOne(ref, aspectId, practices);
                  } catch (err) {
                    logger.warn(
                      `gildi: run failed for ${ref} / ${aspectId}: ${err}`,
                    );
                  }
                }
              }
            };
            await Promise.all(
              Array.from({ length: SWEEP_CONCURRENCY }, () => worker()),
            );

            // Retention runs with the sweep rather than on its own schedule:
            // it only has work to do when rows were just added, and one task is
            // one thing to reason about. Design §8.
            //
            // Skipped when the sweep ran out of time: pruning against a
            // half-finished sweep is not wrong, but the next run will do it
            // with a complete picture and there is no value in racing the
            // scheduler for it.
            if (Date.now() <= sweepDeadline) {
              const removed = await store.prune({
                keep: RUNS_KEPT_PER_SUBJECT,
                hourlyDays: HOURLY_RETENTION_DAYS,
              });
              if (removed > 0) {
                logger.info(`gildi: pruned ${removed} old trial runs`);
              }
            }
          },
        });
      },
    });
  },
});

export default gildiPlugin;
