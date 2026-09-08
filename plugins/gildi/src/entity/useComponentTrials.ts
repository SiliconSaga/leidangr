import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { isMedal, type Medal, type TrialRun } from '@siliconsaga/plugin-gildi-common';
import useAsync from 'react-use/lib/useAsync';

// The SAME type the backend serialises, imported rather than restated. A
// hand-copied mirror of a response shape drifts silently on the first rename,
// and the card would keep compiling while reading a field that no longer
// exists.
export type TrialRunView = TrialRun;

/**
 * The medal to render, or undefined when there is none TO render.
 *
 * Suppressed and unevaluated runs return undefined rather than 'none'. `none`
 * is a real verdict about a component — measured, and nothing passed — while
 * the other two are statements about us, and collapsing them would tell a
 * component it earned nothing on a run that measured nothing.
 *
 * Checked at runtime rather than cast. The value arrives over HTTP, where the
 * declared type is a claim about the response and not a fact about it, so a
 * serialisation bug on the far side would otherwise render as a medal that does
 * not exist.
 *
 * Gated on `kind` for the same reason the history events are: an unevaluated
 * run measured nothing, so whatever medal a row carries it cannot have been
 * awarded by that run. This is the consumer that would put the badge on screen,
 * which makes it the one that must not be talked into it.
 */
export function medalFromRun(run: TrialRunView | undefined): Medal | undefined {
  if (run?.kind !== 'evaluated') return undefined;
  return isMedal(run.medal) ? run.medal : undefined;
}

export function useComponentTrials(entity: Entity, aspectId: string) {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const { value, loading, error } = useAsync(async () => {
    const base = await discovery.getBaseUrl('gildi');
    const ref = encodeURIComponent(stringifyEntityRef(entity));
    const res = await fetchApi.fetch(
      `${base}/trials/${ref}?aspect=${encodeURIComponent(aspectId)}`,
    );
    // A component with no run yet is a normal state, not an error — nothing has
    // swept it. The card shows no badge, which is already its empty rendering.
    if (res.status === 404) {
      return undefined;
    }
    if (!res.ok) {
      throw new Error(`trials request failed: ${res.status}`);
    }
    return (await res.json()) as TrialRunView;
  }, [entity, aspectId]);

  return { run: value, medal: medalFromRun(value), loading, error };
}
