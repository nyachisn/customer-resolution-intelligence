"use client";

/**
 * The four metric chart modes, all reading the same product-level aggregate
 * from operations_overview_metrics and all cross-filtering on the same key.
 *
 * Ranked, slope and small multiples each render one mark per product, so
 * they share a single rule: colour never encodes rank. The accent marks the
 * selected product and nothing else, which keeps a mark's meaning stable
 * when the ordering changes underneath it.
 */

import { useMemo } from "react";
import type { DimensionMovement, SeriesPoint } from "@/lib/analytics";
import { formatCompact, formatPct } from "@/lib/analytics";

/* ------------------------------------------------------------------ */
/* Ranked bars — absolute volume with a period-change marker            */
/* ------------------------------------------------------------------ */

export function RankedBars({
  rows,
  selected,
  onSelect,
  valueLabel,
}: {
  rows: DimensionMovement[];
  selected: string | null;
  onSelect: (product: string | null) => void;
  valueLabel: string;
}) {
  const max = Math.max(...rows.map((r) => r.current), 1);

  return (
    <div className="ranked">
      <div className="ranked-head">
        <span>Product</span>
        <span>{valueLabel}</span>
        <span className="ranked-change">vs previous period</span>
      </div>
      <div className="ranked-body">
        {rows.map((r) => {
          const isSelected = r.dimension === selected;
          const dir = r.changePct == null ? "flat" : r.changePct > 0.02 ? "up" : r.changePct < -0.02 ? "down" : "flat";
          return (
            <button
              key={r.dimension}
              type="button"
              className={`ranked-row${isSelected ? " is-selected" : ""}`}
              onClick={() => onSelect(isSelected ? null : r.dimension)}
              aria-pressed={isSelected}
              title={`${r.dimension} — ${Math.round(r.current).toLocaleString()} (${formatPct(r.share)} of the window)`}
            >
              <span className="ranked-label">{r.dimension}</span>
              <span className="ranked-track">
                <span className="ranked-fill" style={{ width: `${(r.current / max) * 100}%` }} />
                {/* The marker sits where the previous period ended, so the
                    gap between it and the bar end *is* the change. */}
                {r.previous != null && r.previous > 0 && (
                  <span
                    className="ranked-marker"
                    style={{ left: `${Math.min((r.previous / max) * 100, 100)}%` }}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="ranked-value">{formatCompact(Math.round(r.current))}</span>
              <span className={`ranked-change is-${dir}`}>
                {r.changePct == null ? "—" : formatPct(r.changePct, { signed: true })}
              </span>
            </button>
          );
        })}
      </div>
      <p className="chart-note">
        The tick on each bar marks where the previous period ended. Bar length is the
        current window; the gap is the change.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slopegraph — previous period against current, one line per product   */
/* ------------------------------------------------------------------ */

export function Slopegraph({
  rows,
  selected,
  onSelect,
  periodDays,
}: {
  rows: DimensionMovement[];
  selected: string | null;
  onSelect: (product: string | null) => void;
  periodDays: number;
}) {
  const usable = rows.filter((r) => r.previous != null && r.previous > 0);

  if (usable.length === 0) {
    return (
      <div className="empty-state">
        <h3>No comparison available</h3>
        <p>
          This selection does not hold two complete periods, so there is no previous
          window to slope against. Shorten the period or switch comparison on.
        </p>
      </div>
    );
  }

  const max = Math.max(...usable.flatMap((r) => [r.current, r.previous ?? 0]), 1);
  const y = (v: number) => 100 - (v / max) * 100;

  return (
    <div className="slope">
      <div className="slope-plot">
        <span className="slope-axis is-left">Previous {periodDays} days</span>
        <span className="slope-axis is-right">Current {periodDays} days</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="slope-svg" aria-hidden="true">
          {usable.map((r) => (
            <line
              key={r.dimension}
              x1="0"
              x2="100"
              y1={y(r.previous ?? 0)}
              y2={y(r.current)}
              className={`slope-line${r.dimension === selected ? " is-selected" : ""}`}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <ul className="slope-legend">
        {usable.map((r) => {
          const isSelected = r.dimension === selected;
          const dir = r.changePct == null ? "flat" : r.changePct > 0.02 ? "up" : r.changePct < -0.02 ? "down" : "flat";
          return (
            <li key={r.dimension}>
              <button
                type="button"
                className={`slope-item${isSelected ? " is-selected" : ""}`}
                onClick={() => onSelect(isSelected ? null : r.dimension)}
                aria-pressed={isSelected}
              >
                <span className="slope-name">{r.dimension}</span>
                <span className="slope-nums">
                  {formatCompact(Math.round(r.previous ?? 0))} → {formatCompact(Math.round(r.current))}
                </span>
                <span className={`ranked-change is-${dir}`}>
                  {r.changePct == null ? "—" : formatPct(r.changePct, { signed: true })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small multiples — one trend per product, on a shared scale           */
/* ------------------------------------------------------------------ */

export function SmallMultiples({
  series,
  selected,
  onSelect,
}: {
  series: { dimension: string; points: SeriesPoint[]; total: number; changePct: number | null }[];
  selected: string | null;
  onSelect: (product: string | null) => void;
}) {
  // A shared y-scale across every card: the point of small multiples is that
  // the cards are comparable, which per-card scaling would quietly destroy.
  const max = useMemo(
    () => Math.max(...series.flatMap((s) => s.points.map((p) => p.value)), 1),
    [series],
  );

  if (series.length === 0) {
    return (
      <div className="empty-state">
        <h3>Nothing to compare</h3>
        <p>No product in this selection has data across the chosen period.</p>
      </div>
    );
  }

  return (
    <div className="multiples">
      {series.map((s) => {
        const isSelected = s.dimension === selected;
        const dir = s.changePct == null ? "flat" : s.changePct > 0.02 ? "up" : s.changePct < -0.02 ? "down" : "flat";
        const path = s.points
          .map((p, i) => {
            const x = s.points.length <= 1 ? 50 : (i / (s.points.length - 1)) * 100;
            return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${(100 - (p.value / max) * 100).toFixed(1)}`;
          })
          .join(" ");
        return (
          <button
            key={s.dimension}
            type="button"
            className={`multiple${isSelected ? " is-selected" : ""}`}
            onClick={() => onSelect(isSelected ? null : s.dimension)}
            aria-pressed={isSelected}
            title={`${s.dimension} — ${Math.round(s.total).toLocaleString()} in this window`}
          >
            <span className="multiple-name">{s.dimension}</span>
            <span className="multiple-figures">
              <span className="multiple-total">{formatCompact(Math.round(s.total))}</span>
              <span className={`ranked-change is-${dir}`}>
                {s.changePct == null ? "—" : formatPct(s.changePct, { signed: true })}
              </span>
            </span>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="multiple-svg" aria-hidden="true">
              <path d={`${path} L 100 100 L 0 100 Z`} className="multiple-area" />
              <path d={path} className="multiple-line" vectorEffect="non-scaling-stroke" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
