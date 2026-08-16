"use client";

/**
 * Line/area trend with an optional comparison series and a hover crosshair.
 *
 * Peak and endpoint stay direct-labeled so the chart reads without hovering.
 */

import { useMemo, useRef, useState } from "react";

export interface TrendPoint {
  date: string;
  value: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

export function TrendChart({
  points,
  comparePoints,
  compareLabel,
  seriesLabel = "Volume",
  height = 260,
}: {
  points: TrendPoint[];
  comparePoints?: TrendPoint[];
  compareLabel?: string;
  seriesLabel?: string;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 760;
  const H = height;
  const padL = 52;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const geometry = useMemo(() => {
    const all = [...points.map((p) => p.value), ...(comparePoints ?? []).map((p) => p.value)];
    const max = Math.max(...all, 1);
    const x = (i: number, len: number) => padL + (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW);
    const y = (v: number) => padT + plotH - (v / max) * plotH;

    const toPath = (pts: TrendPoint[]) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i, pts.length).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");

    const linePath = toPath(points);
    const areaPath =
      points.length > 0
        ? `${linePath} L ${x(points.length - 1, points.length).toFixed(1)} ${H - padB} L ${x(0, points.length).toFixed(1)} ${H - padB} Z`
        : "";

    const gridValues = Array.from({ length: 5 }, (_, i) => (max * i) / 4);

    // Roughly six evenly spaced date ticks, always including both ends.
    const tickCount = Math.min(6, points.length);
    const tickIdx =
      tickCount <= 1
        ? [0]
        : Array.from({ length: tickCount }, (_, i) =>
            Math.round((i / (tickCount - 1)) * (points.length - 1)),
          );

    const peakIdx = points.reduce((best, p, i, arr) => (p.value > arr[best].value ? i : best), 0);

    return { max, x, y, linePath, areaPath, comparePath: comparePoints ? toPath(comparePoints) : null, gridValues, tickIdx, peakIdx };
  }, [points, comparePoints, plotW, plotH, H, padB]);

  if (points.length === 0) {
    return (
      <div className="empty-state">
        <h3>No data in this selection</h3>
        <p>Widen the date range or clear a filter to see the trend.</p>
      </div>
    );
  }

  const { x, y, linePath, areaPath, comparePath, gridValues, tickIdx, peakIdx } = geometry;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) * W) / rect.width;
    let i = Math.round(((mx - padL) / plotW) * (points.length - 1));
    i = Math.max(0, Math.min(points.length - 1, i));
    setHoverIdx(i);
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null;
  const hoveredCompare = hoverIdx != null && comparePoints ? comparePoints[hoverIdx] : null;

  return (
    <div className="chart-relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="viz-svg"
        role="img"
        aria-label={`${seriesLabel} from ${shortDate(points[0].date)} to ${shortDate(points[points.length - 1].date)}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {gridValues.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="viz-grid-line" />
            <text x={padL - 10} y={y(v) + 3} className="viz-axis-label" textAnchor="end">
              {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
            </text>
          </g>
        ))}

        {tickIdx.map((i) => (
          <text key={i} x={x(i, points.length)} y={H - 8} className="viz-axis-label" textAnchor="middle">
            {shortDate(points[i].date)}
          </text>
        ))}

        <path d={areaPath} className="viz-area" />
        {comparePath && <path d={comparePath} className="viz-line-compare" />}
        <path d={linePath} className="viz-line" />

        {points.length > 3 && (
          <>
            <circle cx={x(peakIdx, points.length)} cy={y(points[peakIdx].value)} r={3} className="viz-dot" />
            <text
              x={x(peakIdx, points.length)}
              y={y(points[peakIdx].value) - 9}
              className="viz-axis-label"
              textAnchor="middle"
            >
              peak
            </text>
          </>
        )}

        {hoverIdx != null && (
          <>
            <line
              x1={x(hoverIdx, points.length)}
              x2={x(hoverIdx, points.length)}
              y1={padT}
              y2={H - padB}
              className="viz-hover-line"
            />
            <circle
              cx={x(hoverIdx, points.length)}
              cy={y(points[hoverIdx].value)}
              r={4}
              className="viz-hover-dot"
            />
          </>
        )}
      </svg>

      {hovered && hoverIdx != null && (
        <div
          className="viz-tooltip"
          style={{
            left: `${(x(hoverIdx, points.length) / W) * 100}%`,
            top: `${(y(hovered.value) / H) * 100}%`,
          }}
        >
          <span className="tt-title">{shortDate(hovered.date)}</span>
          <span className="tt-value">
            {seriesLabel}: {Math.round(hovered.value).toLocaleString()}
          </span>
          {hoveredCompare && (
            <>
              <br />
              <span className="tt-value">
                {compareLabel ?? "Previous"}: {Math.round(hoveredCompare.value).toLocaleString()}
              </span>
            </>
          )}
        </div>
      )}

      {comparePath && (
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: "var(--viz-1)" }} />
            {seriesLabel}
          </span>
          <span className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: "var(--text-muted)", height: "2px" }}
            />
            {compareLabel ?? "Previous period"}
          </span>
        </div>
      )}
    </div>
  );
}
