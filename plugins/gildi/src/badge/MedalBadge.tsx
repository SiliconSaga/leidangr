import { useId } from 'react';
import type { TrialRun } from '@siliconsaga/plugin-gildi-common';
import {
  badgeLabelFor,
  badgeStateFor,
  badgeTitleFor,
  isEarned,
  type BadgeState,
} from './badge';

// Tier metals, drawn from the crest palette so the badge and the arms beside it
// are visibly the same heraldry. `or` and `argent` are the crest's own metals;
// bronze has no heraldic name, so it is tuned away from `or` on hue as well as
// value — a yellow-gold beside a brown-bronze, rather than two close yellows.
const METAL: Record<string, { fill: string; rim: string; charge: string }> = {
  gold: { fill: '#d9b23a', rim: '#8f7220', charge: '#4a3c10' },
  silver: { fill: '#dcdce0', rim: '#9a9aa2', charge: '#4a4a52' },
  bronze: { fill: '#a9713b', rim: '#6d4724', charge: '#2f1e0f' },
};

// Muted and unsaturated on purpose: the gap states must not compete with an
// earned medal for attention, and must never look like a fourth, lesser tier.
const MUTED = '#8a8a94';

const RIBBON = '#6b3a6b'; // purpure, the guildhall's own colour

/**
 * A voided medallion: the same silhouette as an earned one, with no metal in
 * it. `none` belongs on the tier scale — it IS a measurement, the bottom of the
 * same ladder — so it keeps the medal shape and simply holds nothing.
 */
function Medallion({ state }: { state: BadgeState }) {
  const metal = METAL[state];
  return (
    <>
      <path d="M17 6 L24 22 L31 6" fill="none" stroke={RIBBON} strokeWidth="4" opacity={metal ? 1 : 0.4} />
      <circle
        cx="24"
        cy="36"
        r="15"
        fill={metal ? metal.fill : 'none'}
        stroke={metal ? metal.rim : MUTED}
        strokeWidth="2.5"
        strokeDasharray={metal ? undefined : '3 3'}
      />
      {metal && (
        <polygon
          points="24,27 26.6,34.2 34.2,34.2 28.1,38.7 30.4,46 24,41.5 17.6,46 19.9,38.7 13.8,34.2 21.4,34.2"
          fill={metal.charge}
        />
      )}
    </>
  );
}

/**
 * NOT a medallion. Withheld and unevaluated are a different KIND of answer, not
 * a lower rank, so they get a different silhouette — a voided lozenge with a bar
 * through it. A dimmed medal would read as "worse medal" and put a gap in our
 * own knowledge onto the component's record, which is the one thing the outcome
 * model refuses to do.
 */
function NoVerdict() {
  return (
    <>
      <polygon
        points="24,17 39,36 24,55 9,36"
        fill="none"
        stroke={MUTED}
        strokeWidth="2.5"
        strokeDasharray="3 3"
      />
      <rect x="16" y="34.5" width="16" height="3" fill={MUTED} rx="1.5" />
    </>
  );
}

/**
 * The earned tier badge — the component's, never the aspect's (hub design §8:
 * an aspect holds a ladder, a component earns a rung).
 *
 * Renders nothing at all when there is no run, which is why the card can mount
 * this on every row without a placeholder appearing beside components the sweep
 * has not reached.
 */
export function MedalBadge({ run, size = 26 }: { run?: TrialRun; size?: number }) {
  const id = useId();
  const state = badgeStateFor(run);
  if (!state || !run) return null;

  const label = badgeLabelFor(state);
  const title = badgeTitleFor(run, state);

  return (
    <span
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
      data-testid={`medal-${state}`}
    >
      <svg
        width={size}
        height={(size * 60) / 48}
        viewBox="0 0 48 60"
        role="img"
        aria-labelledby={id}
      >
        <title id={id}>{title}</title>
        {state === 'withheld' || state === 'unevaluated' ? (
          <NoVerdict />
        ) : (
          <Medallion state={state} />
        )}
      </svg>
      <span
        style={{
          fontSize: 12,
          // Earned tiers carry their weight; a gap state stays quiet so a row
          // that could not be measured never shouts louder than one that was.
          fontWeight: isEarned(state) ? 600 : 400,
          color: isEarned(state) ? undefined : MUTED,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </span>
  );
}
