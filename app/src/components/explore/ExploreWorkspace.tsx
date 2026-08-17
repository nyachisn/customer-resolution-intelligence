"use client";

/**
 * Explore — the single analytical workspace.
 *
 * Consolidates trend exploration, headline movement, and the attention
 * queue. Filters and policy toggles run client-side over the curated export
 * already loaded on the server, so interaction is immediate.
 *
 * The policy toggles are a real simulation, not a display filter: a record
 * stays in the queue only while at least one of the policies that actually
 * triggered for it is still switched on.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendChart } from "@/components/ui/TrendChart";
import { Chip, ConfidenceChip, EmptyState, PriorityChip } from "@/components/ui/Primitives";
import type { ComplaintRecordContext, OperationsMetric } from "@/lib/types";
import {
  METRIC_LABELS,
  buildAttentionQueue,
  comparePeriods,
  dailySeries,
  dimensionsFor,
  explainReasons,
  formatDate,
  formatPct,
  nextStepFor,
  titleize,
} from "@/lib/analytics";

const RANGES = [
  { days: 28, label: "28 days" },
  { days: 56, label: "56 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All" },
];

const POLICY_LABEL: Record<string, string> = {
  POLICY_UNTIMELY_RESPONSE: "Untimely response",
  POLICY_EMERGING_ISSUE: "Emerging issue",
  POLICY_PUBLICATION_LAG: "Publication lag",
  POLICY_INCOMPLETE_CONTEXT: "Incomplete context",
  POLICY_CRITICAL_COMBINATION: "Critical combination",
  POLICY_STABLE_PATTERN: "Stable pattern",
};

const POLICY_NOTE: Record<string, string> = {
  POLICY_UNTIMELY_RESPONSE: "Company missed the published reporting standard",
  POLICY_EMERGING_ISSUE: "Volume cleared threshold against its own baseline",
  POLICY_PUBLICATION_LAG: "Record may still be incomplete",
  POLICY_INCOMPLETE_CONTEXT: "A field needed to interpret it is missing",
  POLICY_CRITICAL_COMBINATION: "Two independent signals agreed",
  POLICY_STABLE_PATTERN: "Nothing fired — no action needed",
};

// STABLE_PATTERN means "no rule fired", so it never puts a record in the queue.
const QUEUEING_POLICIES = Object.keys(POLICY_LABEL).filter((p) => p !== "POLICY_STABLE_PATTERN");

export function ExploreWorkspace({
  metrics,
  records,
  lagDays,
  initialProduct,
}: {
  metrics: OperationsMetric[];
  records: ComplaintRecordContext[];
  lagDays: number;
  initialProduct?: string;
}) {
  const metricNames = useMemo(() => {
    const dateCount = new Map<string, Set<string>>();
    for (const m of metrics) {
      const set = dateCount.get(m.metricName) ?? new Set<string>();
      set.add(m.metricDate);
      dateCount.set(m.metricName, set);
    }
    return [...dateCount.entries()].filter(([, dates]) => dates.size > 1).map(([name]) => name);
  }, [metrics]);

  const [metricName, setMetricName] = useState("complaint_volume");
  const [rangeDays, setRangeDays] = useState(28);
  const [product, setProduct] = useState<string>(initialProduct ?? "");
  const [excludeLag, setExcludeLag] = useState(true);
  const [enabled, setEnabled] = useState<string[]>(QUEUEING_POLICIES);

  const dimensions = useMemo(() => dimensionsFor(metrics, metricName), [metrics, metricName]);
  const activeProduct = dimensions.includes(product) ? product : "";

  const view = useMemo(() => {
    const full = dailySeries(metrics, metricName, activeProduct || null);
    const trimmed = excludeLag && lagDays > 0 ? full.slice(0, -lagDays) : full;
    const windowed = rangeDays > 0 ? trimmed.slice(-rangeDays) : trimmed;

    let priorAligned: { date: string; value: number }[] | undefined;
    if (rangeDays > 0 && trimmed.length >= rangeDays * 2) {
      const prior = trimmed.slice(-rangeDays * 2, -rangeDays);
      priorAligned = prior.map((p, i) => ({ date: windowed[i]?.date ?? p.date, value: p.value }));
    }

    const cmp = rangeDays > 0 ? comparePeriods(trimmed, rangeDays) : null;
    const total = windowed.reduce((s, p) => s + p.value, 0);
    const peak = windowed.reduce(
      (best, p) => (p.value > best.value ? p : best),
      windowed[0] ?? { date: "", value: 0 },
    );
    return { windowed, priorAligned, cmp, total, peak };
  }, [metrics, metricName, activeProduct, rangeDays, excludeLag, lagDays]);

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

  // How often each policy actually fires across the sample — shown next to
  // each toggle so switching one off has a visible, quantified consequence.
  const policyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      for (const p of r.policyIds) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return counts;
  }, [records]);

  const queue = useMemo(() => {
    const on = new Set(enabled);
    const kept = records.filter((r) => r.policyIds.some((p) => on.has(p)));
    const scoped = activeProduct ? kept.filter((r) => r.product === activeProduct) : kept;
    return buildAttentionQueue(scoped);
  }, [records, enabled, activeProduct]);

  const clearedCount = records.length - queue.reduce((s, q) => s + q.recordCount, 0);

  function togglePolicy(policy: string) {
    setEnabled((cur) =>
      cur.includes(policy) ? cur.filter((p) => p !== policy) : [...cur, policy],
    );
  }

  const isDefault =
    metricName === "complaint_volume" &&
    rangeDays === 28 &&
    !activeProduct &&
    excludeLag &&
    enabled.length === QUEUEING_POLICIES.length;

  function reset() {
    setMetricName("complaint_volume");
    setRangeDays(28);
    setProduct("");
    setExcludeLag(true);
    setEnabled(QUEUEING_POLICIES);
  }

  const measureLabel = METRIC_LABELS[metricName] ?? titleize(metricName);
  const avg = view.windowed.length > 0 ? view.total / view.windowed.length : 0;

  return (
    <div className="explore-layout">
      {/* ---------------- controls ---------------- */}
      <aside className="filter-panel" aria-label="Controls">
        <h2>What are you looking at?</h2>

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
            Time period
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
          <label htmlFor="product">Product</label>
          <select id="product" value={activeProduct} onChange={(e) => setProduct(e.target.value)}>
            <option value="">All products ({dimensions.length})</option>
            {dimensions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <label className="toggle-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
          <input
            type="checkbox"
            checked={excludeLag}
            onChange={(e) => setExcludeLag(e.target.checked)}
          />
          <span className="toggle-copy">
            <span className="toggle-name">Hide incomplete recent days</span>
            <span className="toggle-meta">Last {lagDays} days still publishing</span>
          </span>
        </label>

        <h3>Which rules should apply?</h3>
        {QUEUEING_POLICIES.map((p) => (
          <label className="toggle-row" key={p}>
            <input
              type="checkbox"
              checked={enabled.includes(p)}
              onChange={() => togglePolicy(p)}
            />
            <span className="toggle-copy">
              <span className="toggle-name">{POLICY_LABEL[p]}</span>
              <span className="toggle-meta">
                {POLICY_NOTE[p]} · fires on {policyCounts.get(p) ?? 0}
              </span>
            </span>
          </label>
        ))}

        <button type="button" className="filter-reset" onClick={reset} disabled={isDefault}>
          Reset everything
        </button>
      </aside>

      {/* ---------------- main ---------------- */}
      <section aria-label="Analysis">
        <div className="active-filters">
          <Chip tone="accent">{measureLabel}</Chip>
          <Chip>{rangeDays > 0 ? `Last ${rangeDays} days` : "All time"}</Chip>
          {activeProduct && <Chip>{activeProduct}</Chip>}
          {!excludeLag && <Chip tone="caution">Including incomplete days</Chip>}
          {enabled.length < QUEUEING_POLICIES.length && (
            <Chip tone="caution">
              {enabled.length} of {QUEUEING_POLICIES.length} rules on
            </Chip>
          )}
        </div>

        <div className="stat-row">
          <div className="stat-cell">
            <div className="stat-label">Total in view</div>
            <div className="stat-value">{Math.round(view.total).toLocaleString()}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Daily average</div>
            <div className="stat-value">{Math.round(avg).toLocaleString()}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Busiest day</div>
            <div className="stat-value">{Math.round(view.peak.value).toLocaleString()}</div>
            <div className="stat-foot">{view.peak.date ? formatDate(view.peak.date) : ""}</div>
          </div>
          {view.cmp && (
            <div className="stat-cell">
              <div className="stat-label">Change vs prior period</div>
              <div
                className="stat-value"
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
        </div>

        <div className="panel">
          <h3 className="panel-title">
            {measureLabel}
            {activeProduct ? ` · ${activeProduct}` : ""}
          </h3>
          <p className="panel-sub">
            {view.windowed.length === 0
              ? "No data in this selection"
              : `${formatDate(view.windowed[0].date)} to ${formatDate(view.windowed[view.windowed.length - 1].date)}${
                  view.priorAligned ? ", against the period before it" : ""
                }`}
          </p>
          <TrendChart
            points={view.windowed}
            comparePoints={view.priorAligned}
            compareLabel="Previous period"
            seriesLabel={measureLabel}
          />
        </div>

        {breakdown.length > 0 && (
          <div className="panel" style={{ marginTop: "1.35rem" }}>
            <h3 className="panel-title">Which products make up that total</h3>
            <p className="panel-sub">Select a row to narrow everything to that product.</p>
            <div className="table-wrap" style={{ border: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="num">Total</th>
                    <th scope="col" className="num">Share</th>
                    <th scope="col" className="num">Daily average</th>
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
                        <td>{b.dimension}</td>
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

        {/* ---------------- queue ---------------- */}
        <div style={{ marginTop: "3.5rem" }}>
          <div className="section-head">
            <h2>What these rules flag</h2>
            <p>
              {queue.length > 0 ? (
                <>
                  {queue.length} pattern{queue.length === 1 ? "" : "s"} would reach
                  someone with the rules currently switched on
                  {clearedCount > 0 ? `, and ${clearedCount} records clear with no action` : ""}.
                  Switch a rule off on the left to see what stops being flagged.
                </>
              ) : (
                <>Nothing is flagged with the rules currently switched on.</>
              )}
            </p>
          </div>

          {queue.length === 0 ? (
            <div className="decision-list">
              <EmptyState title="Nothing flagged">
                Every rule is switched off, or no record in this selection
                triggered the ones that remain. Switch a rule back on to
                populate the queue.
              </EmptyState>
            </div>
          ) : (
            <div className="decision-list">
              {queue.slice(0, 10).map((item) => (
                <article className="decision-row" key={item.key}>
                  <div className="decision-meta">
                    <PriorityChip priority={item.priority} />
                    <ConfidenceChip confidence={item.confidence} />
                  </div>
                  <div>
                    <h3 className="decision-title">{item.issue}</h3>
                    <div style={{ marginBottom: ".6rem" }}>
                      <Chip>{item.product}</Chip>
                    </div>
                    <p className="decision-why">{explainReasons(item.reasonCodes)}</p>
                    <p className="decision-next">
                      <strong>Next step:</strong> {nextStepFor(item.recommendedAction)}
                    </p>
                  </div>
                  <div className="decision-signal">
                    {item.volumeChangePct != null ? (
                      <>
                        <div
                          className="ds-value"
                          style={{
                            color: item.volumeChangePct > 0 ? "var(--negative)" : "var(--text)",
                          }}
                        >
                          {formatPct(item.volumeChangePct, { signed: true })}
                        </div>
                        <div className="ds-label">vs baseline</div>
                      </>
                    ) : (
                      <>
                        <div className="ds-value" style={{ color: "var(--text-3)" }}>
                          —
                        </div>
                        <div className="ds-label">no baseline</div>
                      </>
                    )}
                    <div className="ds-label" style={{ marginTop: ".5rem" }}>
                      {item.recordCount} record{item.recordCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <p style={{ marginTop: "1.5rem", fontSize: "var(--fs-min)", color: "var(--text-3)", fontWeight: 300 }}>
            The queue is drawn from a sample that covers every decisioning
            outcome, so rare ones stay visible. A flagged pattern is a prompt to
            investigate, not a confirmed cause ·{" "}
            <Link href="/data-story">How this is built</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
