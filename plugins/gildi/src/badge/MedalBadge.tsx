import { useId } from 'react';
import { Tooltip, makeStyles } from '@material-ui/core';
import type { TrialRun } from '@siliconsaga/plugin-gildi-common';
import {
  badgeLabelFor,
  badgeStateFor,
  badgeTitleFor,
  badgeTitleForError,
  isEarned,
  isGap,
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

// ⚠ BOTH MARKS ARE CENTRED ON (24, 24) IN A SQUARE 48×48 BOX, and that is not
// incidental tidiness. `align-items: center` centres the SVG BOX, so any gap
// between the box's centre and the drawn content's centre shows up as a mark
// floating against its own label — and if the two shapes sit at different
// heights inside the box, they float by different amounts and the row reads as
// crooked. An earlier version used a 48×60 box with the medallion's content
// centred near y=28 and the lozenge's near y=25, which did exactly that. The
// square box also keeps the badge from standing taller than the 20px version
// pills beside it and stretching the row.
const MEDALLION_STAR =
  '24,22 26,27.3 31.6,27.5 27.2,31.1 28.7,36.5 24,33.4 19.3,36.5 20.8,31.1 16.4,27.5 22,27.3';

/**
 * A voided medallion: the same silhouette as an earned one, with no metal in
 * it. `none` belongs on the tier scale — it IS a measurement, the bottom of the
 * same ladder — so it keeps the medal shape and simply holds nothing.
 */
function Medallion({ state }: { state: BadgeState }) {
  const metal = METAL[state];
  return (
    <>
      <path
        d="M18 6 L24 18 L30 6"
        fill="none"
        stroke={RIBBON}
        strokeWidth="3.5"
        opacity={metal ? 1 : 0.4}
      />
      <circle
        cx="24"
        cy="30"
        r="13"
        fill={metal ? metal.fill : 'none'}
        stroke={metal ? metal.rim : MUTED}
        strokeWidth="2.5"
        strokeDasharray={metal ? undefined : '3 3'}
      />
      {metal && <polygon points={MEDALLION_STAR} fill={metal.charge} />}
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
        points="24,9 39,24 24,39 9,24"
        fill="none"
        stroke={MUTED}
        strokeWidth="2.5"
        strokeDasharray="3 3"
      />
      <rect x="16" y="22.5" width="16" height="3" fill={MUTED} rx="1.5" />
    </>
  );
}

// The LABEL takes a theme token, while the mark keeps its own grey. #8a8a94
// clears the 3:1 that a graphic is held to, but not the 4.5:1 that 12px text
// needs — and a literal would only be right in one theme anyway.
const useStyles = makeStyles(theme => ({
  gapLabel: { color: theme.palette.text.secondary },
  // A focusable span, NOT a button. The tooltip has to open on keyboard focus
  // as well as hover, which needs focusability — but a <button> is announced as
  // one, and activating this does nothing, so screen-reader users would be
  // promised an action that is not there. A span with tabIndex is the ARIA
  // tooltip pattern's own answer for a non-interactive trigger: it takes focus
  // and announces its label, and nothing more.
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'help',
    // So the focus ring hugs the badge rather than the whole grid cell.
    borderRadius: 4,
  },
}));

/**
 * `undefined` means draw nothing: no run and nothing went wrong, so the sweep
 * has simply not reached this component yet.
 */
function stateFor(run?: TrialRun, error?: Error): BadgeState | undefined {
  if (run) return badgeStateFor(run);
  return error ? 'unavailable' : undefined;
}

/**
 * The earned tier badge — the component's, never the aspect's (hub design §8:
 * an aspect holds a ladder, a component earns a rung).
 *
 * Renders nothing at all when there is no run AND nothing went wrong, which is
 * why the card can mount this on every row without a placeholder appearing
 * beside components the sweep has not reached.
 *
 * `error` is the case that absence cannot cover. A request that FAILED is our
 * gap, and drawing nothing for it would make our own outage indistinguishable
 * from a component the sweep simply has not got to — so it takes the lozenge
 * and says so.
 */
export function MedalBadge({
  run,
  error,
  size = 26,
}: {
  run?: TrialRun;
  error?: Error;
  size?: number;
}) {
  const id = useId();
  const classes = useStyles();
  const state = stateFor(run, error);
  if (!state) return null;

  const label = badgeLabelFor(state);
  const title = run ? badgeTitleFor(run, state) : badgeTitleForError(error);

  return (
    // Tooltip rather than a `title` attribute: `title` surfaces on hover only,
    // so a sighted keyboard user never learns WHY a medal was withheld.
    <Tooltip title={title}>
      {/* The rule exists to stop focus being put on things that do nothing with
          it. Here focus is the whole point — it is what opens the tooltip — and
          the alternative the rule pushes you toward, a <button>, would announce
          an action this has none of. Suppressed deliberately, per the ARIA
          tooltip pattern for a non-interactive trigger. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <span tabIndex={0}
        role="note"
        aria-label={title}
        className={classes.trigger}
        data-testid={`medal-${state}`}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          role="img"
          aria-labelledby={id}
          style={{ display: 'block', flex: 'none' }}
        >
          <title id={id}>{title}</title>
          {isGap(state) ? <NoVerdict /> : <Medallion state={state} />}
        </svg>
        <span
          className={isEarned(state) ? undefined : classes.gapLabel}
          style={{
            fontSize: 12,
            // Explicit, so the label's own line box cannot add leading above and
            // below the text and shift it off the mark's centre line.
            lineHeight: 1,
            // Earned tiers carry their weight; a gap state stays quiet so a row
            // that could not be measured never shouts louder than one that was.
            fontWeight: isEarned(state) ? 600 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </span>
    </Tooltip>
  );
}
