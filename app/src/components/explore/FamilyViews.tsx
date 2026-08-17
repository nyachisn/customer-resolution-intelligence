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

/**
 * Sparkline path for a family.
 *
 * Scaled to the row's own maximum, not a shared one. On a shared scale
 * Credit reporting's 13.7M flattens every other category into a straight
 * line at the axis — which reads as "nothing happened here" when Debt
 * collection actually grew 45% last year. Magnitude is carried by the share
 * bar and the totals column instead, where it can be read exactly.
 */
function sparkPath(series: FamilySeries): string {
  const pts = series.points;
  if (pts.length === 0) return "";
  const max = Math.max(...pts.map((p) => p.value), 1);
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
  const maxTotal = Math.max(...series.map((s) => s.total), 1);

  return (
    <div className="fam-table">
      <div className="fam-head">
        <span>Category</span>
        <span>Share of archive</span>
        <span>Its own shape, 2011 → 2026</span>
        <span className="num">Total</span>
        <span className="num">Last 12m</span>
        <span className="num">vs prior</span>
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
                    naming change
                  </span>
                )}
              </span>
              <span className="fam-share">
                <span className="fam-share-bar">
                  <span className="fam-share-fill" style={{ width: `${(s.total / maxTotal) * 100}%` }} />
                </span>
                <span className="fam-share-pct">{formatPct(s.share)}</span>
              </span>
              <span className="fam-spark">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path d={`${sparkPath(s)} L 100 100 L 0 100 Z`} className="fam-spark-area" />
                  <path d={sparkPath(s)} className="fam-spark-line" vectorEffect="non-scaling-stroke" />
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
      <p
        className="chart-note"
        title="Each sparkline is scaled to its own category, so a small category still shows its shape; absolute size is in the share bar and the totals column. Direction compares the last 12 complete months with the 12 before them. Retired and New mean the CFPB removed or added the category."
      >
        Sparklines use each category&rsquo;s own scale — size is in the share bar. Direction
        compares the last 12 months with the 12 before.
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
              <path d={`${sparkPath(s)} L 100 100 L 0 100 Z`} className="multiple-area" />
              <path d={sparkPath(s)} className="multiple-line" vectorEffect="non-scaling-stroke" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
