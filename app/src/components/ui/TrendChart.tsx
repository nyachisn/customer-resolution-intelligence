"use client";

/**
 * Container-filling line/area trend with a hover crosshair.
 *
 * The chart measures its parent with a ResizeObserver and draws at real
 * pixel dimensions instead of scaling a fixed viewBox. That matters on the
 * dashboard: panels there are sized by the viewport, so a fixed aspect
 * ratio would either overflow the screen or leave the panel half empty,
 * and scaled SVG text would drift away from the 1rem type floor.
 *
 * Peak and endpoint stay direct-labeled so the shape reads without hovering.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface TrendPoint {
  date: string;
  value: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function monthLabel(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** Axis ticks stay short so they never collide at narrow panel widths. */
function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
}

/** Live size of an element, so the SVG can be drawn at device pixels. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setSize({ w: Math.round(box.width), h: Math.round(box.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}

export function TrendChart({
  points,
  comparePoints,
  compareLabel,
  seriesLabel = "Volume",
  labelMode = "day",
  fill = true,
  showPeak = true,
  focusDate = null,
  onSelectPoint,
  emptyMessage = "Widen the date range or clear a filter to see the trend.",
}: {
  points: TrendPoint[];
  comparePoints?: TrendPoint[];
  compareLabel?: string;
  seriesLabel?: string;
  /** Month mode labels ticks and tooltips as "Jan 2020" instead of "Jan 5". */
  labelMode?: "day" | "month";
  fill?: boolean;
  /** Off for monotonic series, where "peak" is always the last point. */
  showPeak?: boolean;
  /** ISO date pinned by the shared filter state. Metric views only. */
  focusDate?: string | null;
  /** Clicking a point publishes it as the focused date. */
  onSelectPoint?: (date: string) => void;
  emptyMessage?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [wrapRef, { w, h }] = useElementSize<HTMLDivElement>();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const fmtDate = labelMode === "month" ? monthLabel : shortDate;

  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const plotW = Math.max(w - padL - padR, 10);
  const plotH = Math.max(h - padT - padB, 10);

  const geometry = useMemo(() => {
    const all = [...points.map((p) => p.value), ...(comparePoints ?? []).map((p) => p.value)];
    const max = Math.max(...all, 1);
    const x = (i: number, len: number) => padL + (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW);
    const y = (v: number) => padT + plotH - (v / max) * plotH;

    const toPath = (pts: TrendPoint[]) =>
      pts
        .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i, pts.length).toFixed(1)} ${y(p.value).toFixed(1)}`)
        .join(" ");

    const linePath = toPath(points);
    const baseline = padT + plotH;
    const areaPath =
      points.length > 0
        ? `${linePath} L ${x(points.length - 1, points.length).toFixed(1)} ${baseline} L ${x(0, points.length).toFixed(1)} ${baseline} Z`
        : "";

    const gridValues = Array.from({ length: 5 }, (_, i) => (max * i) / 4);

    // One tick per ~110px of plot width, always including both ends, so the
    // axis thins out gracefully as the panel narrows.
    const tickCount = Math.max(2, Math.min(Math.floor(plotW / 110), points.length));
    const tickIdx =
      points.length <= 1
        ? [0]
        : [
            ...new Set(
              Array.from({ length: tickCount }, (_, i) =>
                Math.round((i / (tickCount - 1)) * (points.length - 1)),
              ),
            ),
          ];

    const peakIdx = points.reduce((best, p, i, arr) => (p.value > arr[best].value ? i : best), 0);

    return {
      max,
      x,
      y,
      linePath,
      areaPath,
      comparePath: comparePoints && comparePoints.length > 0 ? toPath(comparePoints) : null,
      gridValues,
      tickIdx,
      peakIdx,
    };
  }, [points, comparePoints, plotW, plotH]);

  if (points.length === 0) {
    return (
      <div className="chart-fill" ref={wrapRef}>
        <div className="empty-state">
          <h3>No data in this selection</h3>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const { x, y, linePath, areaPath, comparePath, gridValues, tickIdx, peakIdx } = geometry;
  const ready = w > 60 && h > 60;

  /** Nearest point index under a pointer position. */
  function indexAt(e: React.MouseEvent<SVGSVGElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const i = Math.round(((mx - padL) / plotW) * (points.length - 1));
    return Math.max(0, Math.min(points.length - 1, i));
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    setHoverIdx(indexAt(e));
  }

  const focusIdx = focusDate ? points.findIndex((p) => p.date === focusDate) : -1;
  const hovered = hoverIdx != null ? points[hoverIdx] : null;
  const hoveredCompare = hoverIdx != null && comparePoints ? comparePoints[hoverIdx] : null;
  const lastIdx = points.length - 1;

  // Flip the tooltip to the left of the crosshair near the right edge so it
  // never gets clipped by the panel it lives in.
  const hoverX = hoverIdx != null ? x(hoverIdx, points.length) : 0;
  const flip = hoverX > w - 150;

  return (
    <div className="chart-fill" ref={wrapRef}>
      {ready && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className={`viz-svg${onSelectPoint ? " is-selectable" : ""}`}
          role="img"
          aria-label={`${seriesLabel} from ${fmtDate(points[0].date)} to ${fmtDate(points[lastIdx].date)}`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
          onClick={onSelectPoint ? (e) => onSelectPoint(points[indexAt(e)].date) : undefined}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--viz-1)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--viz-1)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {gridValues.map((v, i) => (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} className="viz-grid-line" />
              <text x={padL - 8} y={y(v) + 4} className="viz-axis-label" textAnchor="end">
                {compact(v)}
              </text>
            </g>
          ))}

          {tickIdx.map((i) => (
            <text
              key={i}
              x={x(i, points.length)}
              y={h - 7}
              className="viz-axis-label"
              textAnchor={i === 0 ? "start" : i === lastIdx ? "end" : "middle"}
            >
              {fmtDate(points[i].date)}
            </text>
          ))}

          {fill && <path d={areaPath} fill={`url(#${gradientId})`} />}
          {comparePath && <path d={comparePath} className="viz-line-compare" />}
          <path d={linePath} className="viz-line" />

          {showPeak && points.length > 3 && (
            <>
              <circle cx={x(peakIdx, points.length)} cy={y(points[peakIdx].value)} r={3} className="viz-dot" />
              <text
                x={x(peakIdx, points.length)}
                y={y(points[peakIdx].value) - 9}
                className="viz-axis-label"
                textAnchor={peakIdx === lastIdx ? "end" : "middle"}
              >
                peak {compact(points[peakIdx].value)}
              </text>
            </>
          )}

          {focusIdx >= 0 && (
            <>
              <line
                x1={x(focusIdx, points.length)}
                x2={x(focusIdx, points.length)}
                y1={padT}
                y2={padT + plotH}
                className="viz-focus-line"
              />
              <circle
                cx={x(focusIdx, points.length)}
                cy={y(points[focusIdx].value)}
                r={4.5}
                className="viz-focus-dot"
              />
            </>
          )}

          {hoverIdx != null && (
            <>
              <line x1={hoverX} x2={hoverX} y1={padT} y2={padT + plotH} className="viz-hover-line" />
              <circle cx={hoverX} cy={y(points[hoverIdx].value)} r={4} className="viz-hover-dot" />
            </>
          )}
        </svg>
      )}

      {ready && hovered && hoverIdx != null && (
        <div
          className={`viz-tooltip${flip ? " is-flipped" : ""}`}
          style={{ left: `${hoverX}px`, top: `${y(hovered.value)}px` }}
        >
          <span className="tt-title">{fmtDate(hovered.date)}</span>
          <span className="tt-value">
            {seriesLabel}: {Math.round(hovered.value).toLocaleString()}
          </span>
          {hoveredCompare && (
            <span className="tt-value">
              {compareLabel ?? "Previous"}: {Math.round(hoveredCompare.value).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
