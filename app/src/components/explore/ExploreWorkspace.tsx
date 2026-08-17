"use client";

/**
 * Explore — the operating dashboard.
 *
 * One screen, no page scroll: a control rail, a KPI strip, the long-range
 * growth chart, a filtered daily view, the product mix, and the decision
 * queue all stay visible at once. Panels scroll internally when their
 * content is longer than the space the viewport gives them.
 *
 * Built for someone who lives in Salesforce or a BI tool: switches rather
 * than checkboxes, every chart responds to the same filter bar, bars and
 * queue rows are clickable, and a plain-language readout says what the
 * current selection shows and what to do about it.
 *
 * The rule switches are a real simulation, not a display filter: a record
 * stays in the queue only while at least one of the policies that actually
 * triggered for it is still switched on.
 */

import { useMemo, useState } from "react";
import { TrendChart } from "@/components/ui/TrendChart";
import { Chip, ConfidenceChip, PriorityChip } from "@/components/ui/Primitives";
import type { ComplaintRecordContext, LedgerExhibits, OperationsMetric } from "@/lib/types";
import {
  METRIC_LABELS,
  buildAttentionQueue,
  buildReadout,
  comparePeriods,
  dailySeries,
  dimensionsFor,
  explainReasons,
  formatCompact,
  formatMonth,
  formatPct,
  formatRange,
  nextStepFor,
  titleize,
} from "@/lib/analytics";

const RANGES = [
  { days: 28, label: "28d" },
  { days: 56, label: "56d" },
  { days: 90, label: "90d" },
  { days: 0, label: "All" },
];

const GROWTH_SPANS = [
  { months: 12, label: "1y" },
  { months: 36, label: "3y" },
  { months: 60, label: "5y" },
  { months: 0, label: "All" },
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

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ranked bars that filter the dashboard when a row is chosen. */
function BarPicker({
  rows,
  activeLabel,
  onPick,
  total,
}: {
  rows: { label: string; value: number }[];
  activeLabel?: string;
  onPick?: (label: string) => void;
  total?: number;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const denominator = total ?? rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="bar-picker">
      {rows.map((r) => {
        const isActive = r.label === activeLabel;
        const share = denominator > 0 ? r.value / denominator : 0;
        const Tag = onPick ? "button" : "div";
        return (
          <Tag
            key={r.label}
            type={onPick ? "button" : undefined}
            className={`bar-row${isActive ? " is-active" : ""}${onPick ? " is-clickable" : ""}`}
            onClick={onPick ? () => onPick(isActive ? "" : r.label) : undefined}
            title={`${r.label} — ${Math.round(r.value).toLocaleString()} (${formatPct(share)})`}
          >
            <span className="bar-label">{r.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }} />
            </span>
            <span className="bar-value">{formatCompact(Math.round(r.value))}</span>
          </Tag>
        );
      })}
    </div>
  );
}

export function ExploreWorkspace({
  metrics,
  records,
  ledger,
  lagDays,
  initialProduct,
}: {
  metrics: OperationsMetric[];
  records: ComplaintRecordContext[];
  ledger: LedgerExhibits | null;
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
  const [growthSpan, setGrowthSpan] = useState(0);
  const [growthMode, setGrowthMode] = useState<"monthly" | "cumulative">("monthly");
  const [openQueueKey, setOpenQueueKey] = useState<string | null>(null);

  const dimensions = useMemo(() => dimensionsFor(metrics, metricName), [metrics, metricName]);
  const activeProduct = dimensions.includes(product) ? product : "";

  /* ---------------- long-range growth (whole published archive) --------- */

  const growth = useMemo(() => {
    const months = ledger?.monthlyVolume ?? [];
    if (months.length === 0) return null;

    let running = 0;
    const cumulative = months.map((m) => {
      running += m.total;
      return { date: `${m.month}-01`, value: running };
    });
    const monthly = months.map((m) => ({ date: `${m.month}-01`, value: m.total }));

    const source = growthMode === "cumulative" ? cumulative : monthly;
    const points = growthSpan > 0 ? source.slice(-growthSpan) : source;

    const first = months[0];
    const last = months[months.length - 1];
    const multiple = first.total > 0 ? last.total / first.total : null;

    return { points, first, last, multiple, archiveTotal: running };
  }, [ledger, growthMode, growthSpan]);

  /* ---------------- filtered daily view -------------------------------- */

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
    // The breakdown must describe exactly the slice the chart is showing.
    // Deriving its bounds from the rendered points — rather than recomputing
    // a day count — keeps the two from drifting apart.
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

  /* ---------------- policy simulation ---------------------------------- */

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

  const growthLabel = growthMode === "cumulative" ? "Published to date" : "Published that month";

  const windowLabel =
    view.windowed.length > 0
      ? formatRange(view.windowed[0].date, view.windowed[view.windowed.length - 1].date)
      : "No data in this selection";

  return (
    <div className="dash-shell">
      {/* ===================== filter bar ===================== */}
      <div className="dash-bar">
        <label className="db-field">
          <span>Measure</span>
          <select value={metricName} onChange={(e) => setMetricName(e.target.value)}>
            {metricNames.map((n) => (
              <option key={n} value={n}>
                {METRIC_LABELS[n] ?? titleize(n)}
              </option>
            ))}
          </select>
        </label>

        <label className="db-field">
          <span>Product</span>
          <select value={activeProduct} onChange={(e) => setProduct(e.target.value)}>
            <option value="">All {dimensions.length} products</option>
            {dimensions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <div className="db-field">
          <span>Period</span>
          <Segmented
            label="Time period"
            options={RANGES.map((r) => ({ value: r.days, label: r.label }))}
            value={rangeDays}
            onChange={setRangeDays}
          />
        </div>

        <span className="db-spacer" />

        <div className="db-chips">
          {!excludeLag && <Chip tone="caution">Incomplete days included</Chip>}
          {enabled.length < QUEUEING_POLICIES.length && (
            <Chip tone="caution">
              {enabled.length} of {QUEUEING_POLICIES.length} rules on
            </Chip>
          )}
          {activeProduct && <Chip tone="accent">{activeProduct}</Chip>}
        </div>

        <button type="button" className="db-reset" onClick={reset} disabled={isDefault}>
          Reset
        </button>
      </div>

      {/* ===================== body ===================== */}
      <div className="dash-body">
        {/* ---------- control rail ---------- */}
        <aside className="dpanel dash-rail" aria-label="Controls">
          <div className="dpanel-head">
            <h2 className="dpanel-title">Rules and options</h2>
          </div>
          <div className="dpanel-body">
            <h3 className="rail-head">Which rules should apply?</h3>
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

            <h3 className="rail-head">Chart options</h3>
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
          </div>
        </aside>

        {/* ---------- centre column ---------- */}
        <div className="dash-col dash-center">
          <div className="dash-kpis">
            <div className="dkpi">
              <div className="dkpi-label">{measureLabel}</div>
              <div className="dkpi-value">{Math.round(view.total).toLocaleString()}</div>
              <div className="dkpi-foot" title={windowLabel}>
                {windowLabel}
              </div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">Daily average</div>
              <div className="dkpi-value">{Math.round(avg).toLocaleString()}</div>
              <div className="dkpi-foot">Across {view.windowed.length} days</div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">vs previous period</div>
              <div className={`dkpi-value is-${changeDir}`}>
                {view.cmp ? formatPct(view.cmp.changePct, { signed: true }) : "—"}
              </div>
              <div className="dkpi-foot">
                {view.cmp ? "Like-for-like windows" : "Too little history to compare"}
              </div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">Patterns flagged</div>
              <div className="dkpi-value">{queue.length}</div>
              <div className="dkpi-foot">
                {criticalCount > 0 ? `${criticalCount} critical · ` : ""}
                {clearedCount} clear
              </div>
            </div>
          </div>

          {/* growth */}
          <section className="dpanel">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">How the complaint archive grew</h2>
                <p className="dpanel-sub">
                  {!growth
                    ? "Monthly totals across every published complaint"
                    : growthMode === "cumulative"
                      ? `${growth.archiveTotal.toLocaleString()} complaints published in total since ${formatMonth(growth.first.month)}`
                      : `${growth.first.total.toLocaleString()} published in ${formatMonth(growth.first.month)} · ${growth.last.total.toLocaleString()} in ${formatMonth(growth.last.month)}${
                          growth.multiple ? ` · ${growth.multiple.toFixed(1)}× more per month` : ""
                        }`}
                </p>
              </div>
              <div className="dpanel-tools">
                <Segmented
                  label="Growth view"
                  options={[
                    { value: "monthly", label: "Per month" },
                    { value: "cumulative", label: "Running total" },
                  ]}
                  value={growthMode}
                  onChange={setGrowthMode}
                />
                <Segmented
                  label="Growth span"
                  options={GROWTH_SPANS.map((g) => ({ value: g.months, label: g.label }))}
                  value={growthSpan}
                  onChange={setGrowthSpan}
                />
              </div>
            </div>
            <div className="dpanel-body is-chart">
              <TrendChart
                points={growth?.points ?? []}
                seriesLabel={growthLabel}
                labelMode="month"
                showPeak={growthMode === "monthly"}
                emptyMessage="The archive summary has not been exported into this build."
              />
            </div>
          </section>

          {/* daily detail + product mix */}
          <div className="dash-pair">
            <section className="dpanel">
              <div className="dpanel-head">
                <div>
                  <h2 className="dpanel-title">
                    {measureLabel}
                    {activeProduct ? ` · ${activeProduct}` : " · all products"}
                  </h2>
                  <p className="dpanel-sub">
                    {view.windowed.length === 0
                      ? "No data in this selection"
                      : `${windowLabel}${view.priorAligned ? ", against the period before it" : ""}`}
                  </p>
                </div>
              </div>
              <div className="dpanel-body is-chart">
                <TrendChart
                  points={view.windowed}
                  comparePoints={view.priorAligned}
                  compareLabel="Previous period"
                  seriesLabel={measureLabel}
                />
              </div>
            </section>

            <section className="dpanel">
              <div className="dpanel-head">
                <div>
                  <h2 className="dpanel-title">Where the volume sits</h2>
                  <p className="dpanel-sub">Choose a product to filter the whole dashboard</p>
                </div>
              </div>
              <div className="dpanel-body">
                {breakdown.length > 0 ? (
                  <BarPicker
                    rows={breakdown.map((b) => ({ label: b.dimension, value: b.value }))}
                    activeLabel={activeProduct}
                    onPick={setProduct}
                    total={breakdown.reduce((s, b) => s + b.value, 0)}
                  />
                ) : (
                  <p className="dpanel-sub">Nothing to break down in this selection.</p>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* ---------- right column ---------- */}
        <div className="dash-col dash-right">
          <section className="dpanel dpanel-accent">
            <div className="dpanel-head">
              <h2 className="dpanel-title">What this is showing</h2>
            </div>
            <div className="dpanel-body">
              <p className="readout-lede">{readout.headline}</p>
              <h3 className="rail-head">What stands out</h3>
              <ul className="readout-list">
                {readout.observations.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
              <h3 className="rail-head">Suggested next steps</h3>
              <ul className="readout-list is-action">
                {readout.actions.length > 0 ? (
                  readout.actions.map((a) => <li key={a}>{a}</li>)
                ) : (
                  <li>Nothing is flagged in this selection — no action required.</li>
                )}
              </ul>
            </div>
          </section>

          <section className="dpanel">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">What needs a decision</h2>
                <p className="dpanel-sub">
                  {queue.length > 0
                    ? `${queue.length} pattern${queue.length === 1 ? "" : "s"} qualify · ranked by priority`
                    : "Nothing qualifies under the rules switched on"}
                </p>
              </div>
            </div>
            <div className="dpanel-body">
              {queue.length === 0 ? (
                <p className="dpanel-sub">
                  Every rule is switched off, or no record in this selection triggered the ones
                  that remain. Switch a rule back on in the rail to repopulate the queue.
                </p>
              ) : (
                <div className="dq-list">
                  {queue.map((item) => {
                    const open = openQueueKey === item.key;
                    return (
                      <div className={`dq-row${open ? " is-open" : ""}`} key={item.key}>
                        <button
                          type="button"
                          className="dq-head"
                          aria-expanded={open}
                          onClick={() => setOpenQueueKey(open ? null : item.key)}
                        >
                          <span className="dq-top">
                            <PriorityChip priority={item.priority} />
                            {item.volumeChangePct != null && (
                              <span className="dq-delta">
                                {formatPct(item.volumeChangePct, { signed: true })} vs baseline
                              </span>
                            )}
                          </span>
                          <span className="dq-issue">{item.issue}</span>
                          <span className="dq-product">{item.product}</span>
                          <span className="dq-next">{nextStepFor(item.recommendedAction)}</span>
                        </button>
                        {open && (
                          <div className="dq-detail">
                            <p>{explainReasons(item.reasonCodes)}</p>
                            {item.limitation && <p className="dq-limit">{item.limitation}</p>}
                            <p className="dq-meta">
                              {item.recordCount} record{item.recordCount === 1 ? "" : "s"} in this
                              pattern
                            </p>
                            <span className="dq-chips">
                              <ConfidenceChip confidence={item.confidence} />
                            </span>
                            <button
                              type="button"
                              className="dq-filter"
                              onClick={() =>
                                setProduct(item.product === activeProduct ? "" : item.product)
                              }
                            >
                              {item.product === activeProduct
                                ? "Clear product filter"
                                : `Filter dashboard to ${item.product}`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
