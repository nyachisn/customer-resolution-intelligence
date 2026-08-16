"use client";

/**
 * Explore — the analytical workspace.
 *
 * Filters, period comparison and drill-down all run client-side over the
 * curated export already loaded on the server. No request is made while
 * exploring, so interaction is immediate.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendChart } from "@/components/ui/TrendChart";
import { Chip, EmptyState } from "@/components/ui/Primitives";
import type { OperationsMetric } from "@/lib/types";
import {
  METRIC_LABELS,
  comparePeriods,
  dailySeries,
  dimensionsFor,
  formatDate,
  formatPct,
  titleize,
} from "@/lib/analytics";

const RANGES = [
  { days: 28, label: "28d" },
  { days: 56, label: "56d" },
  { days: 90, label: "90d" },
  { days: 0, label: "All" },
];

export function ExploreWorkspace({
  metrics,
  lagDays,
  initialProduct,
  initialMetric,
}: {
  metrics: OperationsMetric[];
  lagDays: number;
  initialProduct?: string;
  initialMetric?: string;
}) {
  // Only measures that are genuinely a daily series belong here. action_count
  // is published as a single point-in-time snapshot, so offering it as a
  // trend would render one point and make period comparison meaningless.
  const metricNames = useMemo(() => {
    const dateCount = new Map<string, Set<string>>();
    for (const m of metrics) {
      const set = dateCount.get(m.metricName) ?? new Set<string>();
      set.add(m.metricDate);
      dateCount.set(m.metricName, set);
    }
    return [...dateCount.entries()].filter(([, dates]) => dates.size > 1).map(([name]) => name);
  }, [metrics]);

  const [metricName, setMetricName] = useState(
    initialMetric && metricNames.includes(initialMetric) ? initialMetric : "complaint_volume",
  );
  const [rangeDays, setRangeDays] = useState(56);
  const [product, setProduct] = useState<string>(initialProduct ?? "");
  const [compare, setCompare] = useState(true);
  const [excludeLag, setExcludeLag] = useState(true);

  const dimensions = useMemo(() => dimensionsFor(metrics, metricName), [metrics, metricName]);

  // A dimension selected for one measure may not exist for another.
  const activeProduct = dimensions.includes(product) ? product : "";

  const view = useMemo(() => {
    const full = dailySeries(metrics, metricName, activeProduct || null);
    const trimmed = excludeLag && lagDays > 0 ? full.slice(0, -lagDays) : full;
    const windowed = rangeDays > 0 ? trimmed.slice(-rangeDays) : trimmed;

    // Prior window of equal length, for the dashed comparison series.
    let priorAligned: { date: string; value: number }[] | undefined;
    if (compare && rangeDays > 0 && trimmed.length >= rangeDays * 2) {
      const prior = trimmed.slice(-rangeDays * 2, -rangeDays);
      priorAligned = prior.map((p, i) => ({ date: windowed[i]?.date ?? p.date, value: p.value }));
    }

    const cmp = rangeDays > 0 ? comparePeriods(trimmed, rangeDays) : null;
    const total = windowed.reduce((s, p) => s + p.value, 0);
    const peak = windowed.reduce(
      (best, p) => (p.value > best.value ? p : best),
      windowed[0] ?? { date: "", value: 0 },
    );

    return { windowed, priorAligned, cmp, total, peak, trimmedLength: trimmed.length };
  }, [metrics, metricName, activeProduct, rangeDays, compare, excludeLag, lagDays]);

  // The breakdown must describe exactly the slice the chart is showing.
  // Deriving its bounds from the rendered points — rather than recomputing a
  // day count — keeps the two from drifting apart when the lag window or the
  // range changes, which is what produced shares above 100%.
  const breakdown = useMemo(() => {
    if (activeProduct || view.windowed.length === 0) return [];
    const from = view.windowed[0].date;
    const to = view.windowed[view.windowed.length - 1].date;
    const totals = new Map<string, number>();
    for (const m of metrics) {
      if (m.metricName !== metricName) continue;
      if (m.metricDate < from || m.metricDate > to) continue;
      totals.set(m.dashboardDimension, (totals.get(m.dashboardDimension) ?? 0) + m.metricValue);
    }
    return [...totals.entries()]
      .map(([dimension, value]) => ({ dimension, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [metrics, metricName, activeProduct, view.windowed]);

  const isDefault =
    metricName === "complaint_volume" &&
    rangeDays === 56 &&
    !activeProduct &&
    compare &&
    excludeLag;

  function reset() {
    setMetricName("complaint_volume");
    setRangeDays(56);
    setProduct("");
    setCompare(true);
    setExcludeLag(true);
  }

  const measureLabel = METRIC_LABELS[metricName] ?? titleize(metricName);
  const avg = view.windowed.length > 0 ? view.total / view.windowed.length : 0;

  return (
    <div className="explore-layout">
      {/* ---------------- filters ---------------- */}
      <aside className="filter-panel" aria-label="Filters">
        <h2>Filters</h2>

        <div className="filter-group">
          <label htmlFor="measure">Measure</label>
          <select id="measure" value={metricName} onChange={(e) => setMetricName(e.target.value)}>
            {metricNames.map((n) => (
              <option key={n} value={n}>
                {METRIC_LABELS[n] ?? titleize(n)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-legend" id="range-legend">
            Period
          </span>
          <div className="segmented" role="group" aria-labelledby="range-legend">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                aria-pressed={rangeDays === r.days}
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label htmlFor="product">
            {metricName === "action_count" ? "Action" : "Product"}
          </label>
          <select id="product" value={activeProduct} onChange={(e) => setProduct(e.target.value)}>
            <option value="">All ({dimensions.length})</option>
            {dimensions.map((d) => (
              <option key={d} value={d}>
                {metricName === "action_count" ? titleize(d) : d}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
              style={{ width: "auto" }}
            />
            Compare with prior period
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={excludeLag}
              onChange={(e) => setExcludeLag(e.target.checked)}
              style={{ width: "auto" }}
            />
            Exclude incomplete recent days
          </label>
        </div>

        <button type="button" className="filter-reset" onClick={reset} disabled={isDefault}>
          Reset filters
        </button>
      </aside>

      {/* ---------------- main visualization ---------------- */}
      <section aria-label="Trend">
        <div className="active-filters">
          <Chip tone="accent">{measureLabel}</Chip>
          <Chip tone="neutral">{rangeDays > 0 ? `Last ${rangeDays} days` : "All time"}</Chip>
          {activeProduct && <Chip tone="neutral">{activeProduct}</Chip>}
          {!excludeLag && <Chip tone="caution">Including incomplete days</Chip>}
        </div>

        <div className="chart-frame">
          <h3 className="chart-title">
            {measureLabel}
            {activeProduct ? ` · ${activeProduct}` : ""}
          </h3>
          <p className="chart-sub">
            {view.windowed.length > 0
              ? `${formatDate(view.windowed[0].date)} – ${formatDate(view.windowed[view.windowed.length - 1].date)}`
              : "No data in this selection"}
          </p>
          <TrendChart
            points={view.windowed}
            comparePoints={view.priorAligned}
            compareLabel="Prior period"
            seriesLabel={measureLabel}
          />
        </div>

        {breakdown.length > 0 && (
          <div className="chart-frame" style={{ marginTop: "1.25rem" }}>
            <h3 className="chart-title">Breakdown</h3>
            <p className="chart-sub">
              {measureLabel} by {metricName === "action_count" ? "action" : "product"} over the
              selected period. Select one to filter the trend above.
            </p>
            <div className="table-wrap" style={{ border: "none", boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{metricName === "action_count" ? "Action" : "Product"}</th>
                    <th scope="col" className="num">
                      Total
                    </th>
                    <th scope="col" className="num">
                      Share
                    </th>
                    <th scope="col" className="num">
                      Daily avg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b) => {
                    const share = view.total > 0 ? b.value / view.total : 0;
                    const days = view.windowed.length || 1;
                    return (
                      <tr
                        key={b.dimension}
                        onClick={() => setProduct(b.dimension)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          {metricName === "action_count" ? titleize(b.dimension) : b.dimension}
                        </td>
                        <td className="num">{Math.round(b.value).toLocaleString()}</td>
                        <td className="num">{formatPct(share)}</td>
                        <td className="num">{Math.round(b.value / days).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- context ---------------- */}
      <aside className="explore-context" aria-label="Context">
        <h2>This selection</h2>

        {view.windowed.length === 0 ? (
          <EmptyState title="Nothing to summarize">
            Adjust the filters to bring data into view.
          </EmptyState>
        ) : (
          <>
            <div className="context-stat">
              <div className="cs-label">Total</div>
              <div className="cs-value">{Math.round(view.total).toLocaleString()}</div>
            </div>
            <div className="context-stat">
              <div className="cs-label">Daily average</div>
              <div className="cs-value">{Math.round(avg).toLocaleString()}</div>
            </div>
            <div className="context-stat">
              <div className="cs-label">Peak day</div>
              <div className="cs-value">{Math.round(view.peak.value).toLocaleString()}</div>
              <div className="cs-label" style={{ marginTop: "0.2rem" }}>
                {view.peak.date ? formatDate(view.peak.date) : ""}
              </div>
            </div>
            {view.cmp && (
              <div className="context-stat">
                <div className="cs-label">Change vs prior period</div>
                <div
                  className="cs-value"
                  style={{
                    color:
                      view.cmp.changePct == null || Math.abs(view.cmp.changePct) < 0.02
                        ? "var(--text)"
                        : view.cmp.changePct > 0
                          ? "var(--negative)"
                          : "var(--positive)",
                  }}
                >
                  {formatPct(view.cmp.changePct, { signed: true })}
                </div>
              </div>
            )}

            <p className="context-readout">
              {activeProduct ? (
                <>
                  <strong>{activeProduct}</strong> accounts for this view.{" "}
                  {view.cmp && view.cmp.changePct != null
                    ? `It moved ${formatPct(view.cmp.changePct, { signed: true })} against its own prior period.`
                    : "Select a shorter period to compare against the prior one."}
                </>
              ) : (
                <>
                  Showing all {dimensions.length}{" "}
                  {metricName === "action_count" ? "actions" : "products"} combined. Select one to
                  isolate its trend — comparisons are most meaningful within a single product area.
                </>
              )}
            </p>

            {excludeLag && (
              <p className="context-readout">
                The most recent {lagDays} days are held back while records finish publishing.{" "}
                <Link href="/data-story">Why →</Link>
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
