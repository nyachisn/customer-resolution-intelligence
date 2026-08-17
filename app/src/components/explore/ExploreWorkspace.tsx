"use client";

/**
 * Explore — the operating dashboard.
 *
 * Built for someone who works in Salesforce or a BI tool: switches rather
 * than checkboxes, KPIs above the fold, charts that respond immediately,
 * and a plain-language readout that says what the current selection shows
 * and what to do about it.
 *
 * The rule switches are a real simulation, not a display filter: a record
 * stays in the queue only while at least one of the policies that actually
 * triggered for it is still switched on.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendChart } from "@/components/ui/TrendChart";
import { Chip, ConfidenceChip, EmptyState, PriorityChip, RankedBars } from "@/components/ui/Primitives";
import type { ComplaintRecordContext, OperationsMetric } from "@/lib/types";
import {
  METRIC_LABELS,
  buildAttentionQueue,
  buildReadout,
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
};

const POLICY_NOTE: Record<string, string> = {
  POLICY_UNTIMELY_RESPONSE: "Company missed the published reporting standard",
  POLICY_EMERGING_ISSUE: "Volume cleared threshold against its own baseline",
  POLICY_PUBLICATION_LAG: "Record may still be incomplete",
  POLICY_INCOMPLETE_CONTEXT: "A field needed to interpret it is missing",
  POLICY_CRITICAL_COMBINATION: "Two independent signals agreed",
};

const QUEUEING_POLICIES = Object.keys(POLICY_LABEL);

function Switch({
  checked,
  onChange,
  name,
  meta,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  meta: React.ReactNode;
}) {
  return (
    <label className={`switch-row${checked ? "" : " is-off"}`}>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="switch-track">
          <span className="switch-thumb" />
        </span>
      </span>
      <span className="switch-copy">
        <span className="switch-name">{name}</span>
        <span className="switch-meta">{meta}</span>
      </span>
    </label>
  );
}

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
  const [showCompare, setShowCompare] = useState(true);
  const [enabled, setEnabled] = useState<string[]>(QUEUEING_POLICIES);

  const dimensions = useMemo(() => dimensionsFor(metrics, metricName), [metrics, metricName]);
  const activeProduct = dimensions.includes(product) ? product : "";

  const view = useMemo(() => {
    const full = dailySeries(metrics, metricName, activeProduct || null);
    const trimmed = excludeLag && lagDays > 0 ? full.slice(0, -lagDays) : full;
    const windowed = rangeDays > 0 ? trimmed.slice(-rangeDays) : trimmed;

    let priorAligned: { date: string; value: number }[] | undefined;
    if (showCompare && rangeDays > 0 && trimmed.length >= rangeDays * 2) {
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
  }, [metrics, metricName, activeProduct, rangeDays, excludeLag, showCompare, lagDays]);

  const breakdown = useMemo(() => {
    if (view.windowed.length === 0) return [];
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
      .sort((a, b) => b.value - a.value);
  }, [metrics, metricName, view.windowed]);

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

  const criticalCount = queue.filter((q) => q.priority === "CRITICAL").length;
  const flaggedRecords = queue.reduce((s, q) => s + q.recordCount, 0);
  const clearedCount = records.length - flaggedRecords;

  const priorityMix = useMemo(() => {
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const counts = new Map<string, number>();
    for (const q of queue) counts.set(q.priority, (counts.get(q.priority) ?? 0) + q.recordCount);
    return order
      .filter((p) => counts.has(p))
      .map((p) => ({ label: titleize(p), value: counts.get(p) ?? 0 }));
  }, [queue]);

  const measureLabel = METRIC_LABELS[metricName] ?? titleize(metricName);
  const avg = view.windowed.length > 0 ? view.total / view.windowed.length : 0;

  const readout = useMemo(
    () =>
      buildReadout({
        measureLabel,
        product: activeProduct || null,
        windowDays: rangeDays > 0 ? rangeDays : view.windowed.length,
        total: view.total,
        changePct: view.cmp?.changePct ?? null,
        hasComparison: Boolean(view.cmp),
        topShare:
          !activeProduct && breakdown.length > 0 && view.total > 0
            ? { label: breakdown[0].dimension, share: breakdown[0].value / view.total }
            : null,
        peak: view.peak.date ? view.peak : null,
        dailyAverage: avg,
        queueCount: queue.length,
        criticalCount,
        rulesOn: enabled.length,
        rulesTotal: QUEUEING_POLICIES.length,
      }),
    [measureLabel, activeProduct, rangeDays, view, breakdown, avg, queue.length, criticalCount, enabled.length],
  );

  function togglePolicy(policy: string) {
    setEnabled((cur) => (cur.includes(policy) ? cur.filter((p) => p !== policy) : [...cur, policy]));
  }

  const isDefault =
    metricName === "complaint_volume" &&
    rangeDays === 28 &&
    !activeProduct &&
    excludeLag &&
    showCompare &&
    enabled.length === QUEUEING_POLICIES.length;

  function reset() {
    setMetricName("complaint_volume");
    setRangeDays(28);
    setProduct("");
    setExcludeLag(true);
    setShowCompare(true);
    setEnabled(QUEUEING_POLICIES);
  }

  const changeDir =
    view.cmp?.changePct == null || Math.abs(view.cmp.changePct) < 0.02
      ? "flat"
      : view.cmp.changePct > 0
        ? "up"
        : "down";

  return (
    <div className="explore-layout">
      {/* ================= control rail ================= */}
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
          <span className="filter-legend" id="range-legend">Time period</span>
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
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <h3>Chart options</h3>
        <Switch
          checked={showCompare}
          onChange={() => setShowCompare(!showCompare)}
          name="Compare with previous period"
          meta="Adds a dashed line for the window before"
        />
        <Switch
          checked={excludeLag}
          onChange={() => setExcludeLag(!excludeLag)}
          name="Hide incomplete recent days"
          meta={`Last ${lagDays} days are still publishing`}
        />

        <h3>Which rules should apply?</h3>
        {QUEUEING_POLICIES.map((p) => (
          <Switch
            key={p}
            checked={enabled.includes(p)}
            onChange={() => togglePolicy(p)}
            name={POLICY_LABEL[p]}
            meta={
              <>
                {POLICY_NOTE[p]} · fires on{" "}
                <span className="switch-count">{policyCounts.get(p) ?? 0}</span>
              </>
            }
          />
        ))}

        <button type="button" className="filter-reset" onClick={reset} disabled={isDefault}>
          Reset everything
        </button>
      </aside>

      {/* ================= main ================= */}
      <section aria-label="Dashboard">
        <div className="active-filters">
          <Chip tone="accent">{measureLabel}</Chip>
          <Chip>{rangeDays > 0 ? `Last ${rangeDays} days` : "All time"}</Chip>
          <Chip>{activeProduct || `All ${dimensions.length} products`}</Chip>
          {!excludeLag && <Chip tone="caution">Including incomplete days</Chip>}
          {enabled.length < QUEUEING_POLICIES.length && (
            <Chip tone="caution">
              {enabled.length} of {QUEUEING_POLICIES.length} rules on
            </Chip>
          )}
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-label">Total in view</div>
            <div className="kpi-value">{Math.round(view.total).toLocaleString()}</div>
            <div className="kpi-foot">
              {view.windowed.length > 0
                ? `${formatDate(view.windowed[0].date)} – ${formatDate(view.windowed[view.windowed.length - 1].date)}`
                : "No data"}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Daily average</div>
            <div className="kpi-value">{Math.round(avg).toLocaleString()}</div>
            <div className="kpi-foot">Across {view.windowed.length} days</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Change vs previous period</div>
            <div className={`kpi-value kpi-delta is-${changeDir}`}>
              {view.cmp ? formatPct(view.cmp.changePct, { signed: true }) : "—"}
            </div>
            <div className="kpi-foot">
              {view.cmp ? "Like-for-like windows" : "Not enough history to compare"}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Patterns flagged</div>
            <div className="kpi-value">{queue.length}</div>
            <div className="kpi-foot">
              {criticalCount > 0 ? `${criticalCount} critical · ` : ""}
              {clearedCount} records clear
            </div>
          </div>
        </div>

        {/* trend */}
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

        {/* two-up: product mix + priority mix */}
        <div className="panel-pair" style={{ marginTop: "1.35rem" }}>
          <div className="panel">
            <h3 className="panel-title">Where the volume sits</h3>
            <p className="panel-sub">
              {activeProduct
                ? "Showing all products for context — the trend above is filtered."
                : "Select a row below to filter everything to that product."}
            </p>
            <RankedBars
              rows={breakdown.slice(0, 8).map((b) => ({
                label: b.dimension,
                value: Math.round(b.value),
              }))}
            />
          </div>

          <div className="panel">
            <h3 className="panel-title">What the rules produce</h3>
            <p className="panel-sub">
              Records by priority, under the rules currently switched on.
            </p>
            {priorityMix.length > 0 ? (
              <RankedBars rows={priorityMix} />
            ) : (
              <EmptyState title="Nothing flagged">
                Switch a rule back on to populate this.
              </EmptyState>
            )}
          </div>
        </div>

        {/* readout */}
        <div className="readout" style={{ marginTop: "1.35rem" }}>
          <div className="readout-head">
            <h3>What this is showing</h3>
            <p>{readout.headline}</p>
          </div>
          <div className="readout-body">
            <div className="readout-col">
              <h4>What stands out</h4>
              <ul>
                {readout.observations.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
            <div className="readout-col is-action">
              <h4>Suggested next steps</h4>
              <ul>
                {readout.actions.length > 0 ? (
                  readout.actions.map((a) => <li key={a}>{a}</li>)
                ) : (
                  <li>Nothing is flagged in this selection — no action required.</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* breakdown table */}
        {breakdown.length > 0 && (
          <div className="panel" style={{ marginTop: "1.35rem" }}>
            <h3 className="panel-title">Product detail</h3>
            <p className="panel-sub">Select a row to filter everything above to that product.</p>
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
                  {breakdown.slice(0, 12).map((b) => {
                    const share = view.total > 0 ? b.value / view.total : 0;
                    const days = view.windowed.length || 1;
                    const isActive = b.dimension === activeProduct;
                    return (
                      <tr
                        key={b.dimension}
                        onClick={() => setProduct(isActive ? "" : b.dimension)}
                        style={{
                          cursor: "pointer",
                          background: isActive ? "var(--blue-soft)" : undefined,
                        }}
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

        {/* queue */}
        <div style={{ marginTop: "3rem" }}>
          <div className="section-head">
            <h2>What needs a decision</h2>
            <p>
              {queue.length > 0
                ? `${queue.length} pattern${queue.length === 1 ? "" : "s"} qualify under the rules switched on, ranked by priority. Switch a rule off to see what stops being flagged.`
                : "Nothing qualifies under the rules currently switched on."}
            </p>
          </div>

          {queue.length === 0 ? (
            <div className="decision-list">
              <EmptyState title="Nothing flagged">
                Every rule is switched off, or no record in this selection
                triggered the ones that remain.
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
                          style={{ color: item.volumeChangePct > 0 ? "var(--negative)" : "var(--text)" }}
                        >
                          {formatPct(item.volumeChangePct, { signed: true })}
                        </div>
                        <div className="ds-label">vs baseline</div>
                      </>
                    ) : (
                      <>
                        <div className="ds-value" style={{ color: "var(--text-3)" }}>—</div>
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
            The queue is drawn from a sample covering every decisioning outcome,
            so rare ones stay visible. A flagged pattern is a prompt to
            investigate, not a confirmed cause ·{" "}
            <Link href="/data-story">How this is built</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
