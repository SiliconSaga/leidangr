// A write path for FABRICATED trial runs, for local development only.
//
// ⚠ WHY THIS IS DANGEROUS AND WHY IT EXISTS ANYWAY. Everything else in this
// plugin is built so a component's record carries only what we measured — the
// whole seven-state outcome model exists to stop our own gaps being read as
// verdicts. An endpoint that accepts arbitrary medals is the one thing that
// could put a fiction on that record. It exists because the history chart
// cannot otherwise be seen: a chart needs several runs spread over time, the
// real sweep writes one run an hour with `runAt` fixed to now, and a dev
// database is `:memory:` and starts empty on every boot. Nobody can look at the
// thing they built.
//
// ⚠ GATED ON AN ENVIRONMENT VARIABLE, NOT ON CONFIG, deliberately. A config key
// lives in a file, and files get copied from the dev environment to the next one
// along with whatever is in them. An environment variable has to be set by
// whoever starts the process, every time. The NODE_ENV check is the second gate:
// both must agree, and neither alone is enough.
//
// It does not replace existing rows and has no delete. A dev database is
// `:memory:`, so restarting the app IS the clean slate — which is cheaper than
// giving the production store a delete method only this file would ever call.

import { InputError } from '@backstage/errors';
import type { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import PromiseRouter from 'express-promise-router';
import { isMedal } from '@siliconsaga/plugin-gildi-common';
import { canonicalRef } from './router';
import type { TrialResultStore, TrialRun } from './store';

/**
 * Both gates, in one place that can be tested without starting a backend.
 *
 * The env is a parameter rather than a `process.env` read so the refusals are
 * tests rather than claims.
 *
 * ⚠ AN ALLOWLIST, NOT A DENYLIST. Refusing `production` and admitting everything
 * else inverts the burden of proof: an unset or misspelled `NODE_ENV` — staging,
 * `Production`, nothing at all — would then be enough to open the endpoint, and
 * the one environment that must never have it is the one most likely to be
 * started by something other than our own scripts. So a named development
 * environment has to assert itself, and silence keeps the gate shut.
 */
export function devSeedEnabled(env: {
  GILDI_DEV_SEED?: string;
  NODE_ENV?: string;
}): boolean {
  if (env.GILDI_DEV_SEED !== '1') return false;
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}

const asCount = (value: unknown, field: string): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new InputError(`${field} must be a non-negative integer or null`);
  }
  return value;
};

/**
 * One fabricated run, checked as strictly as a real one.
 *
 * ⚠ STRICT ON PURPOSE, even though the only caller is a script we wrote. A
 * fixture that writes a malformed row does not fail here — it fails later, in
 * the chart, looking exactly like a bug in the chart. Rejecting at the boundary
 * means a bad fixture is reported as a bad fixture.
 *
 * `entityRef` and `aspectId` come from the URL, not the body: a body that could
 * name its own subject would let one request write to a component the caller did
 * not ask about, and the two spellings would drift the first time one was edited.
 */
export function asRun(
  body: unknown,
  entityRef: string,
  aspectId: string,
): TrialRun {
  const raw = (body ?? {}) as Record<string, unknown>;

  if (typeof raw.runAt !== 'string' || !Number.isFinite(Date.parse(raw.runAt))) {
    throw new InputError('runAt must be a parseable timestamp');
  }
  if (raw.kind !== 'evaluated' && raw.kind !== 'unevaluated') {
    throw new InputError("kind must be 'evaluated' or 'unevaluated'");
  }
  const medal = raw.medal ?? null;
  if (medal !== null && !(typeof medal === 'string' && isMedal(medal))) {
    throw new InputError(`not a medal: ${String(medal)}`);
  }
  // The invariant the real writer holds, held here too. A run that measured
  // nothing cannot have awarded anything, and a seeded row that broke this
  // would teach every consumer downstream that the invariant is negotiable.
  if (raw.kind === 'unevaluated' && medal !== null) {
    throw new InputError('an unevaluated run cannot carry a medal');
  }
  if (
    raw.suppressedReasons !== null &&
    raw.suppressedReasons !== undefined &&
    !(
      Array.isArray(raw.suppressedReasons) &&
      raw.suppressedReasons.every(r => typeof r === 'string')
    )
  ) {
    throw new InputError('suppressedReasons must be an array of strings or null');
  }

  return {
    entityRef,
    aspectId,
    runAt: new Date(raw.runAt).toISOString(),
    kind: raw.kind,
    moduleRelease:
      typeof raw.moduleRelease === 'string' ? raw.moduleRelease : undefined,
    medal,
    suppressedReasons: (raw.suppressedReasons as string[] | null) ?? null,
    applicable: asCount(raw.applicable, 'applicable'),
    passing: asCount(raw.passing, 'passing'),
    // Never seeded. Outcomes are per-trial detail the badge's popover reads,
    // and fabricating them would put invented trial names on a component.
    outcomes: null,
    unevaluatedReason:
      typeof raw.unevaluatedReason === 'string' ? raw.unevaluatedReason : undefined,
  };
}

/**
 * `POST /dev/trials/:entityRef/seed?aspect=<id>` with `{ runs: [...] }`.
 *
 * Mounted beside the real router and only when both gates agree — see
 * `devSeedEnabled` and the mount in plugin.ts.
 */
export function createDevSeedRouter(options: {
  store: TrialResultStore;
  httpAuth: HttpAuthService;
}): express.Router {
  const { store, httpAuth } = options;
  const router = PromiseRouter();
  router.use(express.json({ limit: '1mb' }));

  router.post('/dev/trials/:entityRef/seed', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });

    const aspect = req.query.aspect;
    if (typeof aspect !== 'string' || !aspect.trim()) {
      throw new InputError('an aspect query parameter is required');
    }
    let ref: string;
    try {
      ref = canonicalRef(req.params.entityRef);
    } catch {
      throw new InputError(`not an entity reference: ${req.params.entityRef}`);
    }

    const runs = (req.body as { runs?: unknown })?.runs;
    if (!Array.isArray(runs) || runs.length === 0) {
      throw new InputError('runs must be a non-empty array');
    }

    // VALIDATED IN FULL BEFORE ANYTHING IS WRITTEN. Validating as we go would
    // leave half a history behind on the first bad row — a partial seed that
    // then draws a chart nobody asked for and nobody can explain.
    const checked = runs.map(run => asRun(run, ref, aspect.trim()));
    for (const run of checked) {
      await store.append(run);
    }

    res.json({ seeded: checked.length, entityRef: ref, aspectId: aspect.trim() });
  });

  return router;
}
