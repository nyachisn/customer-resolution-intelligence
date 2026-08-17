"use client";

/**
 * The two ways of reading every product family at once.
 *
 * Both draw each family's whole 15-year shape rather than a single number,
 * because "growing" and "steady" are claims about a shape. Both share one
 * y-scale so the cards stay comparable, and both cross-filter on the same
 * family id as everything else on the screen.
 */

import type { FamilySeries } from "@/lib/archive-analytics";
import { TREND_LABEL } from "@/lib/archive-analytics";
import { formatCompact, formatMonth, formatPct } from "@/lib/analytics";

/** Sparkline path for a family, scaled against a shared maximum. */
function sparkPath(series: FamilySeries, max: number): string {
  const pts = series.points;
  if (pts.length === 0) return "";
  return pts
    .map((p, i) => {
      const x = pts.length <= 1 ? 50 : (i / (pts.length - 1)) * 100;
      const y = 100 - (p.value / max) * 100;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function FamilyGrowthTable({
  series,
  selected,
  onSelect,
}: {
  series: FamilySeries[];
  selected: string | null;
  onSelect: (familyId: string | null) => void;
}) {
  // Shared scale across every row: per-row scaling would make a 9,852-record
  // category look exactly as large as an 11.6M one.
  const max = Math.max(...series.flatMap((s) => s.points.map((p) => p.value)), 1);

  return (
    <div className="fam-table">
      <div className="fam-head">
        <span>Product family</span>
        <span>2011 → 2026</span>
        <span className="num">Total</span>
        <span className="num">Last 12m</span>
        <span className="num">vs prior 12m</span>
        <span>Direction</span>
      </div>
      <div className="fam-body">
        {series.map((s) => {
          const isSelected = s.family.id === selected;
          const dir =
            s.changePct == null ? "flat" : s.changePct > 0.1 ? "up" : s.changePct < -0.1 ? "down" : "flat";
          return (
            <button
              key={s.family.id}
              type="button"
              className={`fam-row${isSelected ? " is-selected" : ""}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : s.family.id)}
              title={
                s.firstActive && s.lastActive
                  ? `${s.family.label} — reported ${formatMonth(`${s.firstActive}-01`)} to ${formatMonth(`${s.lastActive}-01`)}`
                  : s.family.label
              }
            >
              <span className="fam-name">
                {s.family.label}
                {s.family.note && (
                  <span className="fam-flag" title={s.family.note}>
                    caveat
                  </span>
                )}
              </span>
              <span className="fam-spark">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path d={`${sparkPath(s, max)} L 100 100 L 0 100 Z`} className="fam-spark-area" />
                  <path d={sparkPath(s, max)} className="fam-spark-line" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>
              <span className="num fam-total">{formatCompact(s.total)}</span>
              <span className="num fam-recent">{formatCompact(s.recent12m)}</span>
              <span className={`num fam-change is-${dir}`}>
                {s.changePct == null ? "—" : formatPct(s.changePct, { signed: true })}
              </span>
              <span className={`fam-trend is-${s.trend}`}>{TREND_LABEL[s.trend]}</span>
            </button>
          );
        })}
      </div>
      <p className="chart-note">
        Shared scale, so sparklines compare. Direction is the last 12 complete months against
        the 12 before. &ldquo;Category retired&rdquo; and &ldquo;New category&rdquo; are
        taxonomy changes, not falls or rises.
      </p>
    </div>
  );
}

export function FamilyMultiples({
  series,
  selected,
  onSelect,
}: {
  series: FamilySeries[];
  selected: string | null;
  onSelect: (familyId: string | null) => void;
}) {
  const max = Math.max(...series.flatMap((s) => s.points.map((p) => p.value)), 1);

  return (
    <div className="multiples">
      {series.map((s) => {
        const isSelected = s.family.id === selected;
        const dir =
          s.changePct == null ? "flat" : s.changePct > 0.1 ? "up" : s.changePct < -0.1 ? "down" : "flat";
        return (
          <button
            key={s.family.id}
            type="button"
            className={`multiple${isSelected ? " is-selected" : ""}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? null : s.family.id)}
            title={`${s.family.label} — ${s.total.toLocaleString()} complaints, ${formatPct(s.share)} of the archive`}
          >
            <span className="multiple-name">{s.family.label}</span>
            <span className="multiple-figures">
              <span className="multiple-total">{formatCompact(s.total)}</span>
              <span className={`ranked-change is-${dir}`}>
                {s.changePct == null ? "—" : formatPct(s.changePct, { signed: true })}
              </span>
            </span>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="multiple-svg" aria-hidden="true">
              <path d={`${sparkPath(s, max)} L 100 100 L 0 100 Z`} className="multiple-area" />
              <path d={sparkPath(s, max)} className="multiple-line" vectorEffect="non-scaling-stroke" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
