import { resolvePackagePath, type DatabaseService } from '@backstage/backend-plugin-api';
import {
  isMedal,
  type TrialOutcomeRow,
  type TrialRun,
} from '@siliconsaga/plugin-gildi-common';

// Derived from the service rather than imported from `knex` directly.
// backend-plugin-api carries its own nested copy of knex, so importing the type
// from our own dependency produces two structurally different `Knex` types and
// a client from one is not assignable to the other. Taking the type from the
// thing that hands us the client sidesteps that entirely — and means this
// package needs no runtime knex dependency at all.
type KnexClient = Awaited<ReturnType<DatabaseService['getClient']>>;

// Declared in gildi-common so the frontend reads exactly the shape this store
// writes, rather than a hand-copied mirror that drifts on the first rename.
// Re-exported here because this package's callers think of it as the store's
// row and should not need to know where the declaration lives.
export type {
  TrialOutcomeRow,
  TrialRun,
} from '@siliconsaga/plugin-gildi-common';

/**
 * The seam that lets the runner and the store be replaced independently later
 * (design §10). Knex-backed today, and the only implementation.
 */
export interface TrialResultStore {
  append(run: TrialRun): Promise<void>;
  latest(entityRef: string, aspectId: string): Promise<TrialRun | undefined>;
  history(entityRef: string, aspectId: string, limit?: number): Promise<TrialRun[]>;
  /**
   * Two-tier retention. Returns how many rows were removed.
   *
   * `now` exists for tests. The day-collapse tier buckets by UTC calendar day,
   * so a suite that derives its fixtures from the wall clock produces runs
   * either side of midnight depending on the hour it runs at — a test that
   * passes all afternoon and fails at 23:30. Injecting the instant is cheaper
   * and less invasive than faking timers under a live sqlite driver.
   */
  prune(opts: { keep: number; hourlyDays: number; now?: number }): Promise<number>;
}

const TABLE = 'gildi_trial_runs';

/**
 * How many runs retention keeps per entity-and-aspect, and therefore the most
 * a caller can usefully ask for.
 *
 * Lives here rather than beside the scheduled sweep so the retention policy and
 * the read-path bound cannot drift apart: a request for more than is ever kept
 * would spend a scan proving there is nothing else to return.
 */
export const RUNS_KEPT_PER_SUBJECT = 500;

// JSON columns rather than a row per trial: we never query by trial, and a blob
// avoids schema churn while the outcome union is young.
const parseJson = <T>(value: unknown): T | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

// SQLite has no dedicated boolean or JSON types, so counts come back needing
// normalisation. Explicitly null-checked rather than `|| null`, because 0 is a
// legitimate stored value — a standard that loaded and applied nothing — and
// must survive the round trip as 0 rather than becoming null.
const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

// Lower is worse. Unevaluated ranks below suppressed, and both below `none`:
// `none` is at least a measurement, while the other two mean the run could not
// say. On a downsampled chart the reader wants the day something went wrong,
// not the day's tidiest number.
function rankOf(row: Record<string, unknown>): number {
  if (row.kind === 'unevaluated') return 0;
  const medal = row.medal as string | null;
  if (!medal) return 1; // suppressed
  return { none: 2, bronze: 3, silver: 4, gold: 5 }[medal] ?? 2;
}

export class DatabaseTrialResultStore implements TrialResultStore {
  static async create(database: DatabaseService): Promise<DatabaseTrialResultStore> {
    const client = await database.getClient();
    await client.migrate.latest({
      directory: resolvePackagePath('@siliconsaga/plugin-gildi-backend', 'migrations'),
    });
    return new DatabaseTrialResultStore(client);
  }

  private constructor(private readonly db: KnexClient) {}

  async append(run: TrialRun): Promise<void> {
    await this.db(TABLE).insert({
      entity_ref: run.entityRef,
      aspect_id: run.aspectId,
      run_at: run.runAt,
      kind: run.kind,
      module_release: run.moduleRelease ?? null,
      medal: run.medal,
      suppressed_reasons: run.suppressedReasons
        ? JSON.stringify(run.suppressedReasons)
        : null,
      applicable: run.applicable,
      passing: run.passing,
      outcomes: run.outcomes ? JSON.stringify(run.outcomes) : null,
      unevaluated_reason: run.unevaluatedReason ?? null,
      unevaluated_detail: run.unevaluatedDetail ?? null,
    });
  }

  async latest(entityRef: string, aspectId: string): Promise<TrialRun | undefined> {
    const [row] = await this.history(entityRef, aspectId, 1);
    return row;
  }

  async history(entityRef: string, aspectId: string, limit = 100): Promise<TrialRun[]> {
    const rows = await this.db(TABLE)
      .where({ entity_ref: entityRef, aspect_id: aspectId })
      .orderBy([
        { column: 'run_at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .limit(limit);
    return rows.map((r: Record<string, unknown>) => ({
      entityRef: String(r.entity_ref),
      aspectId: String(r.aspect_id),
      runAt: new Date(r.run_at as string).toISOString(),
      kind: r.kind as TrialRun['kind'],
      moduleRelease: (r.module_release as string) ?? undefined,
      // Validated on the way out, not cast. The column is free text, so a row
      // written by an older release or edited by hand could hold anything, and
      // a cast would hand that straight to a card as a medal. An unrecognised
      // value reads as no medal, which is the safe direction: withholding one
      // that was earned is a visible bug, while inventing one is not.
      medal: isMedal(r.medal) ? r.medal : null,
      suppressedReasons: parseJson<string[]>(r.suppressed_reasons),
      applicable: num(r.applicable),
      passing: num(r.passing),
      outcomes: parseJson<TrialOutcomeRow[]>(r.outcomes),
      unevaluatedReason: (r.unevaluated_reason as string) ?? undefined,
      unevaluatedDetail: (r.unevaluated_detail as string) ?? undefined,
    }));
  }

  /**
   * Two-tier retention: full resolution recently, one run per day beyond that.
   *
   * Flat count retention does not stretch far enough to be useful. At hourly
   * sweeps, 500 rows is under three weeks — shorter than the window in which
   * "when did this break" is usually asked. Keeping every run for a week and
   * then one per day makes the same 500 rows reach most of a year.
   *
   * The survivor for an older day is the WORST run of that day, not the newest.
   * A day where the medal dropped or the run could not be evaluated is the day
   * worth seeing on the chart, and keeping the last run of the day would hide
   * an outage that recovered before midnight.
   */
  async prune(opts: { keep: number; hourlyDays: number; now?: number }): Promise<number> {
    const cutoff = (opts.now ?? Date.now()) - opts.hourlyDays * 24 * 60 * 60 * 1000;
    const subjects = await this.db(TABLE).distinct('entity_ref', 'aspect_id');
    let removed = 0;

    for (const s of subjects) {
      const rows: Array<Record<string, unknown>> = await this.db(TABLE)
        .where({ entity_ref: s.entity_ref, aspect_id: s.aspect_id })
        .orderBy([
          { column: 'run_at', order: 'desc' },
          { column: 'id', order: 'desc' },
        ]);

      // Survivors carry their timestamp, because the cap below must order by
      // RUN TIME and not by row id. `runAt` is caller-supplied, so insertion
      // order and chronological order are not the same thing — capping by id
      // silently keeps the oldest runs when history is backfilled.
      const survivors: Array<{ id: number; at: number }> = [];
      const bestOfDay = new Map<string, Record<string, unknown>>();

      for (const row of rows) {
        const at = new Date(row.run_at as string).getTime();
        if (at >= cutoff) {
          survivors.push({ id: Number(row.id), at });
          continue;
        }
        const day = new Date(at).toISOString().slice(0, 10);
        const held = bestOfDay.get(day);
        if (!held || rankOf(row) < rankOf(held)) {
          bestOfDay.set(day, row);
        }
      }
      for (const row of bestOfDay.values()) {
        survivors.push({
          id: Number(row.id),
          at: new Date(row.run_at as string).getTime(),
        });
      }

      // Hard cap last, newest first, so a very long history still cannot grow
      // without bound however the tiers fall.
      const capped = survivors
        .sort((a, b) => b.at - a.at || b.id - a.id)
        .slice(0, opts.keep)
        .map(v => v.id);

      // Deleted inside a transaction, bounded to rows that existed when the
      // snapshot was taken. A refresh can append while this runs, and without
      // the id ceiling that brand-new row is absent from `capped` and would be
      // deleted — losing the very run someone just asked for.
      const ceiling = rows.length ? Math.max(...rows.map(r => Number(r.id))) : 0;
      const subject = { entity_ref: s.entity_ref, aspect_id: s.aspect_id };
      // Returns the count rather than accumulating into `removed` from inside
      // the closure: a function declared in a loop that mutates an outer
      // variable is the shape lint refuses, and it refuses it for good reason.
      removed += await this.db.transaction(tx =>
        tx(TABLE)
          .where(subject)
          .where('id', '<=', ceiling)
          .whereNotIn('id', capped)
          .delete(),
      );
    }
    return removed;
  }
}
