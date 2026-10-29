import { useState } from 'react';
import { makeStyles } from '@material-ui/core';
import type { HistoryEvent, Medal, TrialRun } from '@siliconsaga/plugin-gildi-common';
import { RUNGS, seriesFor, type SeriesPoint } from './series';

// The badge's metals, and its rims. The METAL alone fails a chart's contrast
// floor — gold manages 1.97:1 and silver 1.33:1 against a light surface — so
// the rim is not decoration here, it is what gives the marker an edge. Measured
// with the dataviz validator rather than judged by eye.
//
// ⚠ COLOUR IS REDUNDANT ON THIS CHART, deliberately. The rung is carried by
// POSITION and named on the axis, because bronze and the gap grey are only
// ΔE 11.8 apart even for full-colour vision — close enough that a reader could
// confuse "earned bronze" with "we could not see", which is the one confusion
// this whole model exists to prevent. The metals tie the chart to the badge
// visually and carry nothing the axis does not already say.
const METAL: Record<Medal, { fill: string; rim: string }> = {
  gold: { fill: '#d9b23a', rim: '#8f7220' },
  silver: { fill: '#dcdce0', rim: '#9a9aa2' },
  bronze: { fill: '#a9713b', rim: '#6d4724' },
  none: { fill: 'transparent', rim: '#8a8a94' },
};

// The plot box. A fixed viewBox scaled to the card's width: the chart has no
// quantitative y axis to distort, so uniform scaling is safe, and it avoids a
// resize observer for a card that is only ever one column wide.
//
// The bottom band is INSIDE the box on purpose. A container sized to the plot
// alone leaves the date labels outside it and the card grows a nested
// scrollbar to reach them.
const W = 640;
const H = 180;
const PAD = { top: 14, right: 20, bottom: 30, left: 62 };
const PLOT_H = H - PAD.top - PAD.bottom;

const rungY = (rung: number) =>
  PAD.top + PLOT_H * (1 - rung / (RUNGS.length - 1));

const useStyles = makeStyles(theme => ({
  figure: { margin: 0, position: 'relative' },
  svg: { display: 'block', width: '100%', height: 'auto' },
  // Hairline and SOLID. Dashing is reserved for the data here — it is what
  // says "unconfirmed" — so a dashed gridline would be read as meaning
  // something it does not.
  grid: { stroke: theme.palette.divider, strokeWidth: 1 },
  axisText: {
    fill: theme.palette.text.secondary,
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
  },
  rungText: { fill: theme.palette.text.secondary, fontSize: 11 },
  // The line takes a theme token rather than a literal: it is the one mark
  // that must hold its weight in both modes.
  line: {
    stroke: theme.palette.text.primary,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  },
  unconfirmed: { stroke: theme.palette.text.secondary },
  // 2px of the surface colour, so a marker reads as a marker where it crosses
  // the line it sits on.
  ring: {
    fill: 'none',
    stroke: theme.palette.background.paper,
    strokeWidth: 2,
  },
  hollow: {
    fill: theme.palette.background.paper,
    stroke: theme.palette.text.secondary,
  },
  release: { stroke: theme.palette.divider, strokeWidth: 1 },
  releaseText: { fill: theme.palette.text.secondary, fontSize: 10 },
  endLabel: {
    fill: theme.palette.text.primary,
    fontSize: 11,
    fontWeight: 600,
  },
  caption: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: theme.spacing(0.5),
  },
  tooltip: {
    position: 'absolute',
    pointerEvents: 'none',
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    boxShadow: theme.shadows[2],
    padding: theme.spacing(0.5, 1),
    fontSize: 12,
    color: theme.palette.text.primary,
    maxWidth: 260,
    zIndex: 1,
  },
  // Present for assistive tech and removed from sight, so every value the
  // chart draws is also readable as text. A tooltip must never be the only
  // way to reach a value.
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: 0,
    padding: 0,
    margin: -1,
  },
}));

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** What a point says in words — the tooltip, and the table's state column. */
export function describePoint(point: SeriesPoint): string {
  if (point.gap === 'withheld') {
    return 'withheld — a trial could not be measured, so no medal was awarded';
  }
  if (point.gap === 'unevaluated') {
    return 'not evaluated — the standard could not be read';
  }
  return point.medal === 'none'
    ? 'none — measured, and nothing passed'
    : `${point.medal} — earned`;
}

/**
 * The medal over time: sub-project 4's second pass, against fact-source
 * design §9.
 *
 * A STEP, not a slope. A straight line from bronze to gold would put the
 * component at silver somewhere in the middle, which never happened — a medal
 * holds the value of its last run until a new run changes it.
 *
 * Gaps are DASHED AND HOLLOW, never a drop. See `series.ts` for the argument:
 * plotting an unmeasured run at the bottom of the ladder draws a cliff that
 * reads as a measured regression, which inverts a gap in our knowledge into a
 * verdict about the component.
 */
export function MedalHistoryChart({
  runs,
  events = [],
}: {
  runs: TrialRun[];
  events?: HistoryEvent[];
}) {
  const classes = useStyles();
  const [hover, setHover] = useState<number | undefined>(undefined);
  const { points, segments } = seriesFor(runs);
  const drawable = points.filter(p => p.carried !== null);

  // Counted on what can actually be DRAWN, not on how many runs came back. One
  // run cannot show a trend, and a history that is nothing but gaps has no
  // line to hold — gridlines and an axis with no data on them would be a
  // confident picture of nothing.
  if (drawable.length < 2) return null;

  const first = Date.parse(points[0].at);
  const last = Date.parse(points[points.length - 1].at);
  const span = last - first || 1;
  const x = (iso: string) =>
    PAD.left + ((Date.parse(iso) - first) / span) * (W - PAD.left - PAD.right);

  const endPoint = drawable[drawable.length - 1];
  // flatMap rather than filter: a `.filter()` on a discriminated union does
  // not narrow it, so the renderer would have to re-test `type` to reach
  // fields the filter already guaranteed.
  const releases = events.flatMap(e => (e.type === 'release-changed' ? [e] : []));

  // Above the line normally, below it when there is no room above — measured
  // against the plot's own top edge rather than assumed.
  const endY = rungY(endPoint.carried as number);
  const endLabelY = endY - 10 >= PAD.top + 8 ? endY - 10 : endY + 18;

  return (
    <figure className={classes.figure} data-testid="medal-history">
      {/* Decorative: the table below carries every value this draws, which is
          what keeps the chart from being the only way to read the data. Making
          each of up to sixty points focusable instead would turn one card into
          sixty tab stops. */}
      <svg
        className={classes.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="presentation"
        aria-hidden="true"
        focusable="false"
      >
        {RUNGS.map((rung, i) => (
          <g key={rung}>
            <line
              className={classes.grid}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={rungY(i)}
              y2={rungY(i)}
            />
            <text
              className={classes.rungText}
              x={PAD.left - 10}
              y={rungY(i)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {rung}
            </text>
          </g>
        ))}

        {/* A release change explains a medal that moved without the component
            moving — the bar got higher. A solid hairline, so it reads as
            chrome rather than as data. */}
        {releases.map(e => (
          <g key={`rel-${e.at}`}>
            <line
              className={classes.release}
              x1={x(e.at)}
              x2={x(e.at)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
            />
            <text
              className={classes.releaseText}
              x={x(e.at)}
              y={PAD.top - 4}
              textAnchor="middle"
            >
              {e.to}
            </text>
          </g>
        ))}

        {segments.map(seg => (
          <path
            key={`${seg.fromAt}-${seg.toAt}`}
            className={`${classes.line} ${seg.dashed ? classes.unconfirmed : ''}`}
            strokeDasharray={seg.dashed ? '4 4' : undefined}
            data-testid="history-segment"
            data-dashed={seg.dashed}
            // H then V: a STEP, not a slope. A diagonal would put the
            // component at a rung it never held, somewhere in the middle.
            d={`M ${x(seg.fromAt)} ${rungY(seg.fromRung)} H ${x(seg.toAt)} V ${rungY(seg.toRung)}`}
          />
        ))}

        {points.map((point, i) => {
          if (point.carried === null) return null;
          const cx = x(point.at);
          const cy = rungY(point.carried);
          const metal = point.medal ? METAL[point.medal] : undefined;
          return (
            <g
              key={point.at}
              data-testid="history-point"
              data-state={point.gap ?? point.medal ?? ''}
            >
              {/* The surface ring, drawn first and underneath. It is what keeps
                  a marker legible where it sits on the line, rather than a
                  border drawn around the mark — a border adds ink that is not
                  data, and this adds none. */}
              <circle className={classes.ring} cx={cx} cy={cy} r={5.5} />
              {/* HOLLOW where a run told us nothing. A filled marker would
                  assert a medal at this moment — the honest claim is only that
                  a run happened and did not confirm one. The hollow centre
                  takes the surface colour rather than `transparent`, so the
                  line does not show through and read as a filled dot. */}
              <circle
                cx={cx}
                cy={cy}
                r={4.5}
                className={metal ? undefined : classes.hollow}
                fill={metal ? metal.fill : undefined}
                stroke={metal ? metal.rim : undefined}
                strokeWidth={1.5}
              />
              {/* The hit area, not the mark. A 9px dot you must land on
                  dead-centre is a pinpoint target, so the hover surface is the
                  24px minimum regardless of how small the marker is. */}
              <rect
                x={cx - 12}
                y={cy - 12}
                width={24}
                height={24}
                fill="transparent"
                style={{ pointerEvents: 'all' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(undefined)}
              />
            </g>
          );
        })}

        {/* Labelled selectively — the endpoint only. A value on every point is
            chaos and goes unread, and the axis already names every rung.

            FLIPPED BELOW THE POINT at the top of the ladder. Always placing it
            above put a gold endpoint's label at y=4 in a box that starts at
            14 — clipped by the viewBox, which is the one thing a label must
            never be. */}
        {endPoint && (
          <text
            className={classes.endLabel}
            x={W - PAD.right}
            y={endLabelY}
            textAnchor="end"
          >
            {endPoint.gap ? 'unconfirmed' : endPoint.medal ?? ''}
          </text>
        )}

        <text
          className={classes.axisText}
          x={PAD.left}
          y={H - 10}
          textAnchor="start"
        >
          {day(points[0].at)}
        </text>
        <text
          className={classes.axisText}
          x={W - PAD.right}
          y={H - 10}
          textAnchor="end"
        >
          {day(points[points.length - 1].at)}
        </text>
      </svg>

      {hover !== undefined && points[hover] && (
        <div
          className={classes.tooltip}
          style={{
            left: `${(x(points[hover].at) / W) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <strong>{day(points[hover].at)}</strong> — {describePoint(points[hover])}
        </div>
      )}

      <figcaption className={classes.caption}>
        A dashed line means we could not confirm the medal in that stretch, not
        that it was lost.
      </figcaption>

      <table className={classes.srOnly}>
        <caption>Trial runs, oldest first</caption>
        <tbody>
          {points.map(point => (
            <tr key={point.at}>
              <th scope="row">{new Date(point.at).toISOString()}</th>
              <td>{describePoint(point)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
