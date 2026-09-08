import { InputError, NotFoundError } from '@backstage/errors';
import type { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import type { TrialResultStore, TrialRun } from './store';

export interface HistoryEvent {
  type: 'release-changed' | 'medal-earned';
  at: string;
  from?: string;
  to?: string;
  medal?: string;
  first?: boolean;
}

/**
 * Derived SERVER-SIDE so every client agrees on the semantics and no consumer
 * re-implements them. Takes runs newest-first and reads them oldest-first,
 * because both event kinds are about transitions.
 */
export function eventsFor(runsNewestFirst: TrialRun[]): HistoryEvent[] {
  const runs = [...runsNewestFirst].reverse();
  const events: HistoryEvent[] = [];
  const seenMedals = new Set<string>();
  let release: string | undefined;
  let heldMedal: string | undefined;

  for (const run of runs) {
    if (run.moduleRelease && run.moduleRelease !== release) {
      if (release !== undefined) {
        events.push({
          type: 'release-changed',
          at: run.runAt,
          from: release,
          to: run.moduleRelease,
        });
      }
      release = run.moduleRelease;
    }

    // `none` is a real verdict but not an earned medal, and a suppressed run
    // has medal null — neither is a moment worth marking on a chart.
    const medal = run.medal && run.medal !== 'none' ? run.medal : undefined;

    // TRANSITIONS, not occurrences. Emitting per run would put twenty-four
    // identical "earned gold" marks on a day where nothing happened, burying
    // the one day it changed. `heldMedal` tracks what the component currently
    // holds, so losing gold and regaining it is two events while holding it is
    // none.
    if (medal && medal !== heldMedal) {
      events.push({
        type: 'medal-earned',
        at: run.runAt,
        medal,
        first: !seenMedals.has(medal),
      });
      seenMedals.add(medal);
    }
    heldMedal = medal;
  }
  return events;
}

export function createRouter(options: {
  store: TrialResultStore;
  httpAuth: HttpAuthService;
  refresh: (entityRef: string, aspectId: string) => Promise<TrialRun>;
}): express.Router {
  const { store, httpAuth, refresh } = options;
  const router = express.Router();
  router.use(express.json());

  const aspectOf = (req: express.Request): string => {
    const aspect = req.query.aspect;
    if (typeof aspect !== 'string' || !aspect.trim()) {
      throw new InputError('an aspect query parameter is required');
    }
    return aspect.trim();
  };

  router.get('/trials/:entityRef', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const run = await store.latest(req.params.entityRef, aspectOf(req));
    if (!run) {
      throw new NotFoundError(`no run recorded for ${req.params.entityRef}`);
    }
    res.json(run);
  });

  router.get('/trials/:entityRef/history', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new InputError('limit must be a positive number');
    }
    const runs = await store.history(req.params.entityRef, aspectOf(req), limit);
    res.json({ runs, events: eventsFor(runs) });
  });

  router.post('/trials/:entityRef/refresh', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    res.json(await refresh(req.params.entityRef, aspectOf(req)));
  });

  return router;
}
