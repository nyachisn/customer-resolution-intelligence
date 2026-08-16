"use client";

/**
 * Monthly volume trend line. The only interactive/client piece on the
 * homepage — a hover crosshair + tooltip over an otherwise fully
 * server-rendered page. Peak and endpoint are direct-labeled regardless,
 * so the chart is still legible without hovering.
 */

import { useRef, useState } from "react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(month: string): string {
  const [yr, mo] = month.split("-");
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${yr}`;
}

export function LedgerTrendChart({ points }: { points: { month: string; total: number }[] }) {
  const W = 620;
  const H = 220;
  const padL = 48;
  const padR = 12;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(...points.map((p) => p.total));
  const x = (i: number) => padL + (i / (points.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.total).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${H - padB} L ${x(0).toFixed(1)} ${H - padB} Z`;

  const gridSteps = 4;
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => (max * i) / gridSteps);
  const yearTicks = points
    .map((p, i) => ({ i, year: p.month.slice(0, 4), isJan: p.month.endsWith("-01") }))
    .filter((t) => t.isJan);

  const last = points[points.length - 1];
  const peakIdx = points.reduce((best, p, i, arr) => (p.total > arr[best].total ? i : best), 0);

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    let i = Math.round(((mx - padL) / plotW) * (points.length - 1));
    i = Math.max(0, Math.min(points.length - 1, i));
    setHoverIdx(i);
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div className="ledger-trend-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="ledger-trend-svg"
        role="img"
        aria-label="Monthly complaint volume trend"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {grid.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="ledger-gridline" />
            <text x={padL - 8} y={y(v) + 3} className="ledger-axislabel" textAnchor="end">
              {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
            </text>
          </g>
        ))}
        {yearTicks.map((t) => (
          <g key={t.i}>
            <line x1={x(t.i)} x2={x(t.i)} y1={padT} y2={H - padB} className="ledger-gridline" />
            <text x={x(t.i)} y={H - 6} className="ledger-axislabel" textAnchor="middle">
              {t.year}
            </text>
          </g>
        ))}
        <path d={areaPath} className="ledger-trend-area" />
        <path d={linePath} className="ledger-trend-line" />
        <circle cx={x(peakIdx)} cy={y(points[peakIdx].total)} r={3} className="ledger-trend-dot" />
        <text x={x(peakIdx)} y={y(points[peakIdx].total) - 8} className="ledger-axislabel" textAnchor="middle">
          peak
        </text>
        <circle cx={x(points.length - 1)} cy={y(last.total)} r={3.5} className="ledger-trend-dot ledger-trend-dot-end" />
        {hoverIdx != null && (
          <>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={H - padB} className="ledger-trend-hoverline" />
            <circle cx={x(hoverIdx)} cy={y(points[hoverIdx].total)} r={4} className="ledger-trend-hoverdot" />
          </>
        )}
      </svg>
      {hovered && hoverIdx != null && (
        <div
          className="ledger-chart-tooltip"
          style={{
            left: `${(x(hoverIdx) / W) * 100}%`,
            top: `${(y(hovered.total) / H) * 100}%`,
          }}
        >
          {monthLabel(hovered.month)}: {hovered.total.toLocaleString()}
        </div>
      )}
    </div>
  );
}
