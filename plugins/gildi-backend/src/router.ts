import { InputError, NotFoundError } from '@backstage/errors';
import type { HttpAuthService } from '@backstage/backend-plugin-api';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import express from 'express';
// NOT express.Router(). Express 4 does not forward a rejected promise from an
// async handler to the error middleware: the rejection goes unhandled and the
// request hangs open until the client gives up. Every handler here is async and
// every one of them can throw on a normal path — a missing `aspect` parameter
// is an InputError, not an exception — so the plain router would turn routine
// bad input into a hung connection. Backstage's own backends use this adapter
// for the same reason.
import PromiseRouter from 'express-promise-router';
import {
  RUNS_KEPT_PER_SUBJECT,
  type TrialResultStore,
  type TrialRun,
} from './store';

export interface HistoryEvent {
  type: 'release-changed' | 'medal-earned';
  at: string;
  from?: string;
  to?: string;
  medal?: string;
  first?: boolean;
}

/**
 * The one spelling of an entity reference this plugin stores and looks up.
 *
 * Backstage treats kind, namespace and name as case-insensitive and lowercases
 * all three when it canonicalises. The writer and the reader must therefore
 * agree on the canonical form or they will never meet: a component named
 * `MySite` swept under one spelling and requested under another is a permanent
 * 404 that looks like the sweep never ran. Throws on input that is not an
 * entity reference at all.
 */
export function canonicalRef(ref: string): string {
  return stringifyEntityRef(parseEntityRef(ref));
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
    //
    // Gated on `kind` as well as on the medal itself. An unevaluated run is a
    // statement about US, never about the component, so it can never be the
    // moment a medal was earned however the row was written. The invariant is
    // held by the writer, but this is the consumer that would publish a false
    // achievement if a row ever escaped it, so it checks rather than trusts.
    const medal =
      run.kind === 'evaluated' && run.medal && run.medal !== 'none'
        ? run.medal
        : undefined;

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
  const router = PromiseRouter();
  router.use(express.json());

  const aspectOf = (req: express.Request): string => {
    const aspect = req.query.aspect;
    if (typeof aspect !== 'string' || !aspect.trim()) {
      throw new InputError('an aspect query parameter is required');
    }
    return aspect.trim();
  };

  const refOf = (req: express.Request): string => {
    try {
      return canonicalRef(req.params.entityRef);
    } catch {
      throw new InputError(`not an entity reference: ${req.params.entityRef}`);
    }
  };

  router.get('/trials/:entityRef', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const run = await store.latest(refOf(req), aspectOf(req));
    if (!run) {
      throw new NotFoundError(`no run recorded for ${req.params.entityRef}`);
    }
    res.json(run);
  });

  router.get('/trials/:entityRef/history', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    // Integer, not merely finite: 2.5 is a finite number that reaches knex's
    // .limit() and fails at the database rather than at the boundary that
    // could have said why.
    //
    // Capped at what retention keeps, so an unbounded number cannot make the
    // database scan for rows that provably do not exist. Retention is a
    // scheduled sweep rather than a read-path guarantee, so the bound has to be
    // stated here too.
    if (
      limit !== undefined &&
      (!Number.isInteger(limit) || limit <= 0 || limit > RUNS_KEPT_PER_SUBJECT)
    ) {
      throw new InputError(
        `limit must be a positive integer no greater than ${RUNS_KEPT_PER_SUBJECT}`,
      );
    }
    const runs = await store.history(refOf(req), aspectOf(req), limit);
    res.json({ runs, events: eventsFor(runs) });
  });

  router.post('/trials/:entityRef/refresh', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    res.json(await refresh(refOf(req), aspectOf(req)));
  });

  return router;
}
