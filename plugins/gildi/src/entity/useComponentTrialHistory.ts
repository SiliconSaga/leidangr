import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import type { TrialHistory } from '@siliconsaga/plugin-gildi-common';
import useAsync from 'react-use/lib/useAsync';

/**
 * How many runs the chart asks for.
 *
 * Bounded deliberately rather than left to the server's own cap: the endpoint
 * rejects anything above its retention limit, and a chart that asked for
 * everything would widen its time axis every sweep until individual runs were
 * a pixel apart. A window is also the honest framing — the chart answers
 * "what has happened lately", and the audit trail answers "what ever
 * happened".
 */
export const HISTORY_LIMIT = 60;

/**
 * The runs behind the badge, for the history chart.
 *
 * Separate from `useComponentTrials` rather than folded into it. The badge is
 * on every aspect row of every component card and needs one cheap latest-run
 * read; the history is one entity page's chart and pulls a window of runs.
 * Fetching the window on every badge would multiply the cost of the card by
 * the retention limit for data nothing on it draws.
 *
 * Events are NOT derived here. The backend derives them so every client agrees
 * on the semantics — a second implementation in the frontend is exactly the
 * drift the server-side derivation exists to prevent.
 */
export function useComponentTrialHistory(entity: Entity, aspectId: string) {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const { value, loading, error } = useAsync(async () => {
    const base = await discovery.getBaseUrl('gildi');
    const ref = encodeURIComponent(stringifyEntityRef(entity));
    const res = await fetchApi.fetch(
      `${base}/trials/${ref}/history?aspect=${encodeURIComponent(aspectId)}` +
        `&limit=${HISTORY_LIMIT}`,
    );
    // A component the sweep has not reached has no history, which is a normal
    // state and not an error — the same reading `useComponentTrials` gives a
    // 404 on the latest run. The chart renders nothing rather than an error.
    if (res.status === 404) {
      return undefined;
    }
    if (!res.ok) {
      throw new Error(`trial history request failed: ${res.status}`);
    }
    const body = (await res.json()) as TrialHistory;
    // Checked at runtime, not cast. The declared type is a claim about the
    // response rather than a fact about it, and a chart handed a non-array
    // would throw somewhere deep in its own layout code, where the stack says
    // nothing about the response that caused it.
    if (!Array.isArray(body?.runs) || !Array.isArray(body?.events)) {
      throw new Error('trial history response was not in the expected shape');
    }
    return body;
  }, [entity, aspectId]);

  return { history: value, loading, error };
}
