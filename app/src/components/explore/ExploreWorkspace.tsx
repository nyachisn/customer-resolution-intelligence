"use client";

/**
 * Explore — a connected, URL-addressable decision workspace.
 *
 * One screen, no page scroll. Every surface reads the same typed filter
 * state, and that state lives in the address bar, so a click and a pasted
 * link produce the same view by the same route.
 *
 * Three populations share this screen and are never blended:
 *
 *   Archive        17.1M records, 2020–2026, from ledger_exhibits.
 *                  Monthly totals only. Powers the growth curve and the
 *                  population trigger rates.
 *   Metric views   operations_overview_metrics: daily × product across six
 *                  months. Powers the KPIs, every chart mode, the readout.
 *                  This is the only population that cross-filters.
 *   Sample         300 stratified records for illustration. Displayed, never
 *                  counted, ranked, or prioritized from.
 *
 * `product` is the only dimension the metric series and the record sample
 * share, so it is the only cross-filtering key. `focus` names a date on the
 * metric series and deliberately does not reach the sample: those records
 * land on two received dates, so a date filter over them would be a
 * interaction that looks like filtering and is not.
 */

import { useMemo, useState } from "react";
import { TrendChart } from "@/components/ui/TrendChart";
import { Chip, ConfidenceChip, PriorityChip } from "@/components/ui/Primitives";
import { RankedBars, Slopegraph, SmallMultiples } from "./MetricCharts";
import { ModelLensRail } from "./ModelLens";
import { VirtualList } from "./VirtualList";
import { ModelDrawer, RecordDrawer, RecordDrawerSkeleton } from "./EvidenceDrawer";
import type {
  ComplaintRecordContext,
  LedgerExhibits,
  MetricBundle,
  SampleRecordIndexRow,
} from "@/lib/types";
import {
  CHART_MODES,
  type DashboardFilters,
  DEFAULT_FILTERS,
  PERIODS,
  RULE_IDS,
  type RuleId,
  isDefaultFilters,
  modelRef,
  recordRef,
} from "@/lib/filters";
import { useDashboardFilters } from "@/lib/use-filters";
import { findModel } from "@/lib/model-registry";
import type { SurfaceId } from "@/lib/model-registry";
import {
  METRIC_LABELS,
  buildReadout,
  buildWindowView,
  dimensionMovements,
  formatCompact,
  formatDate,
  formatMonth,
  formatPct,
  formatRange,
  nextStepFor,
  seriesPoints,
  titleize,
  valueOn,
} from "@/lib/analytics";

const GROWTH_SPANS = [
  { months: 12, label: "1y" },
  { months: 36, label: "3y" },
  { months: 60, label: "5y" },
  { months: 0, label: "All" },
];

const POLICY_LABEL: Record<RuleId, string> = {
  POLICY_UNTIMELY_RESPONSE: "Untimely response",
  POLICY_EMERGING_ISSUE: "Emerging issue",
  POLICY_PUBLICATION_LAG: "Publication lag",
  POLICY_INCOMPLETE_CONTEXT: "Incomplete context",
  POLICY_CRITICAL_COMBINATION: "Critical combination",
};

const POLICY_NOTE: Record<RuleId, string> = {
  POLICY_UNTIMELY_RESPONSE: "Company missed the published reporting standard",
  POLICY_EMERGING_ISSUE: "Volume cleared threshold against its own baseline",
  POLICY_PUBLICATION_LAG: "Record may still be incomplete",
  POLICY_INCOMPLETE_CONTEXT: "A field needed to interpret it is missing",
  POLICY_CRITICAL_COMBINATION: "Two independent signals agreed",
};

/** Products shown at once in ranked, slope and small-multiple modes. */
const TOP_N = 8;

/** Must match the .sample-row height in globals.css — see VirtualList. */
const SAMPLE_ROW_HEIGHT = 104;

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
  options: { value: T; label: string; title?: string }[];
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
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ExploreWorkspace({
  initialFilters,
  bundle,
  ledger,
  sampleIndex,
  sampleRecord,
  lagDays,
}: {
  initialFilters: DashboardFilters;
  bundle: MetricBundle;
  ledger: LedgerExhibits | null;
  sampleIndex: SampleRecordIndexRow[];
  sampleRecord: ComplaintRecordContext | null;
  lagDays: number;
}) {
  const { filters, set, reset, pending } = useDashboardFilters(initialFilters, DEFAULT_FILTERS);
  const {
    product, measure, period, compare, hideRecentIncompleteDays, selectedRules, chartMode, focus, item,
  } = filters;

  const measureNames = useMemo(() => Object.keys(bundle), [bundle]);
  const series = bundle[measure] ?? bundle[DEFAULT_FILTERS.measure];
  const products = series?.dimensions ?? [];
  const activeProduct = product && products.includes(product) ? product : null;
  const measureLabel = METRIC_LABELS[measure] ?? titleize(measure);

  /* ---------------- metric views ---------------------------------- */

  const view = useMemo(
    () =>
      buildWindowView(seriesPoints(series, activeProduct), {
        periodDays: period,
        lagDays,
        hideLag: hideRecentIncompleteDays,
        compare,
      }),
    [series, activeProduct, period, lagDays, hideRecentIncompleteDays, compare],
  );

  const movements = useMemo(
    () =>
      dimensionMovements(series, {
        periodDays: period,
        lagDays,
        hideLag: hideRecentIncompleteDays,
      }),
    [series, period, lagDays, hideRecentIncompleteDays],
  );

  const topMovements = movements.slice(0, TOP_N);

  const multiples = useMemo(
    () =>
      topMovements.map((m) => {
        const v = buildWindowView(seriesPoints(series, m.dimension), {
          periodDays: period,
          lagDays,
          hideLag: hideRecentIncompleteDays,
          compare: false,
        });
        return {
          dimension: m.dimension,
          points: v.points,
          total: m.current,
          changePct: m.changePct,
        };
      }),
    [topMovements, series, period, lagDays, hideRecentIncompleteDays],
  );

  /** The other measure's total for the same window — never the sample's. */
  const companionMeasure = measure === "complaint_volume" ? "emerging_issue_count" : "complaint_volume";
  const companion = useMemo(() => {
    const other = bundle[companionMeasure];
    if (!other) return null;
    const v = buildWindowView(seriesPoints(other, activeProduct), {
      periodDays: period,
      lagDays,
      hideLag: hideRecentIncompleteDays,
      compare: false,
    });
    return { total: v.total, label: METRIC_LABELS[companionMeasure] ?? titleize(companionMeasure) };
  }, [bundle, companionMeasure, activeProduct, period, lagDays, hideRecentIncompleteDays]);

  const focusValue = focus ? valueOn(series, activeProduct, focus) : null;

  const windowLabel =
    view.points.length > 0
      ? formatRange(view.points[0].date, view.points[view.points.length - 1].date)
      : "No data in this selection";

  const readout = useMemo(
    () =>
      buildReadout({
        measureLabel,
        product: activeProduct,
        productCount: products.length,
        windowDays: period > 0 ? period : view.points.length,
        total: view.total,
        changePct: view.comparison?.changePct ?? null,
        hasComparison: Boolean(view.comparison),
        topShare:
          !activeProduct && movements.length > 0
            ? { label: movements[0].dimension, share: movements[0].share }
            : null,
        peak: view.peak,
        dailyAverage: view.dailyAverage,
        focus: focus ? { date: focus, value: focusValue } : null,
        signalDays: measure === "complaint_volume" ? (companion?.total ?? null) : null,
      }),
    [measureLabel, activeProduct, products.length, period, view, movements, focus, focusValue, measure, companion],
  );

  /* ---------------- archive growth (population) -------------------- */

  const [span, setSpan] = useState(0);
  const growth = useMemo(() => {
    const months = ledger?.monthlyVolume ?? [];
    if (months.length === 0) return null;
    const points = months.map((m) => ({ date: `${m.month}-01`, value: m.total }));
    return {
      points: span > 0 ? points.slice(-span) : points,
      first: months[0],
      last: months[months.length - 1],
      multiple: months[0].total > 0 ? months[months.length - 1].total / months[0].total : null,
    };
  }, [ledger, span]);

  /* ---------------- illustrative sample (never counted) ------------ */

  const ruleRates = useMemo(() => {
    const byId = new Map((ledger?.policyTriggerRates ?? []).map((r) => [r.policyId, r]));
    return RULE_IDS.map((id) => ({ id, rate: byId.get(id) ?? null }));
  }, [ledger]);

  const sampleRows = useMemo(() => {
    const on = new Set(selectedRules);
    return sampleIndex.filter(
      (r) =>
        r.policyIds.some((p) => on.has(p as RuleId)) &&
        (!activeProduct || r.product === activeProduct),
    );
  }, [sampleIndex, selectedRules, activeProduct]);

  /* ---------------- model lens ------------------------------------- */

  const openModel = findModel(modelRef(item));
  const openRecordId = recordRef(item);
  const highlighted = new Set<SurfaceId>(openModel?.surfaces ?? []);
  const lensOn = Boolean(openModel);

  function surfaceClass(id: SurfaceId): string {
    if (!lensOn) return "";
    return highlighted.has(id) ? " is-lit" : " is-dimmed";
  }

  function toggleRule(id: RuleId) {
    set({
      selectedRules: selectedRules.includes(id)
        ? selectedRules.filter((r) => r !== id)
        : [...selectedRules, id],
    });
  }

  const changeDir =
    view.comparison?.changePct == null || Math.abs(view.comparison.changePct) < 0.02
      ? "flat"
      : view.comparison.changePct > 0
        ? "up"
        : "down";

  return (
    <div className={`dash-shell${item ? " has-drawer" : ""}`}>
      {/* ===================== filter bar ===================== */}
      <div className="dash-bar">
        <label className="db-field">
          <span>Measure</span>
          <select value={measure} onChange={(e) => set({ measure: e.target.value, focus: null })}>
            {measureNames.map((n) => (
              <option key={n} value={n}>
                {METRIC_LABELS[n] ?? titleize(n)}
              </option>
            ))}
          </select>
        </label>

        <label className="db-field">
          <span>Product</span>
          <select
            value={activeProduct ?? ""}
            onChange={(e) => set({ product: e.target.value || null })}
          >
            <option value="">All {products.length} products</option>
            {products.map((d) => (
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
            options={PERIODS.map((d) => ({ value: d, label: d === 0 ? "All" : `${d}d` }))}
            value={period}
            onChange={(d) => set({ period: d, focus: null })}
          />
        </div>

        <span className="db-spacer" />

        <div className="db-chips">
          {focus && (
            <button type="button" className="chip chip-accent is-clearable" onClick={() => set({ focus: null })}>
              Focus {formatDate(focus)} ✕
            </button>
          )}
          {!hideRecentIncompleteDays && <Chip tone="caution">Incomplete days included</Chip>}
          {selectedRules.length < RULE_IDS.length && (
            <Chip tone="caution">
              {selectedRules.length} of {RULE_IDS.length} rules on
            </Chip>
          )}
        </div>

        <button type="button" className="db-reset" onClick={reset} disabled={isDefaultFilters(filters)}>
          Reset
        </button>
      </div>

      {/* ===================== body ===================== */}
      <div className="dash-body">
        {/* ---------- left rail ---------- */}
        {lensOn ? (
          <ModelLensRail
            activeName={openModel?.name ?? null}
            onSelect={(name) => set({ item: name ? `model:${name}` : null })}
          />
        ) : (
          <aside className={`dpanel dash-rail${surfaceClass("rules")}`} aria-label="Rules and options">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">Rules in this view</h2>
                <p className="dpanel-sub">Trigger rates across all 17.1M published records</p>
              </div>
            </div>
            <div className="dpanel-body">
              {ruleRates.map(({ id, rate }) => (
                <Switch
                  key={id}
                  checked={selectedRules.includes(id)}
                  onChange={() => toggleRule(id)}
                  name={POLICY_LABEL[id]}
                  meta={
                    <>
                      {POLICY_NOTE[id]}
                      {rate?.triggerRate != null && (
                        <>
                          {" · fires on "}
                          <span className="switch-count">{formatPct(rate.triggerRate)}</span>
                          {" of the archive"}
                        </>
                      )}
                    </>
                  }
                />
              ))}

              <h3 className="rail-head">Chart options</h3>
              <Switch
                checked={compare}
                onChange={() => set({ compare: !compare })}
                name="Compare with previous period"
                meta="Adds the previous window to trend, ranked and slope"
              />
              <Switch
                checked={hideRecentIncompleteDays}
                onChange={() => set({ hideRecentIncompleteDays: !hideRecentIncompleteDays })}
                name="Hide incomplete recent days"
                meta={`Last ${lagDays} days are still publishing`}
              />

              <button
                type="button"
                className="rail-link"
                onClick={() => set({ item: "model:operations_overview_metrics" })}
              >
                Open Model Lens
              </button>
            </div>
          </aside>
        )}

        {/* ---------- centre column ---------- */}
        <div className="dash-col dash-center">
          <div className={`dash-kpis${surfaceClass("kpis")}`}>
            <div className="dkpi">
              <div className="dkpi-label">{measureLabel}</div>
              <div className="dkpi-value">{Math.round(view.total).toLocaleString()}</div>
              <div className="dkpi-foot" title={windowLabel}>{windowLabel}</div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">Daily average</div>
              <div className="dkpi-value">{Math.round(view.dailyAverage).toLocaleString()}</div>
              <div className="dkpi-foot">Across {view.points.length} days</div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">vs previous period</div>
              <div className={`dkpi-value is-${changeDir}`}>
                {view.comparison ? formatPct(view.comparison.changePct, { signed: true }) : "—"}
              </div>
              <div className="dkpi-foot">
                {view.comparison ? "Like-for-like windows" : "Too little history to compare"}
              </div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">{focus ? "Focused day" : (companion?.label ?? "Products")}</div>
              <div className="dkpi-value">
                {focus
                  ? focusValue == null
                    ? "—"
                    : Math.round(focusValue).toLocaleString()
                  : Math.round(companion?.total ?? products.length).toLocaleString()}
              </div>
              <div className="dkpi-foot">
                {focus ? formatDate(focus) : "Same window and product"}
              </div>
            </div>
          </div>

          <section className={`dpanel${surfaceClass("metric-chart")}`} data-surface="metric-chart">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">
                  {measureLabel}
                  {activeProduct ? ` · ${activeProduct}` : " · all products"}
                </h2>
                <p className="dpanel-sub">
                  {view.points.length === 0
                    ? "No data in this selection"
                    : chartMode === "trend"
                      ? `${windowLabel}${view.priorAligned ? ", against the period before it" : ""}. Click a point to focus it.`
                      : `${windowLabel} · top ${Math.min(TOP_N, movements.length)} products · click to filter everything`}
                </p>
              </div>
              <div className="dpanel-tools">
                <Segmented
                  label="Chart mode"
                  options={CHART_MODES.map((m) => ({ value: m.value, label: m.label, title: m.help }))}
                  value={chartMode}
                  onChange={(v) => set({ chartMode: v })}
                />
              </div>
            </div>
            <div className={`dpanel-body${chartMode === "trend" ? " is-chart" : ""}`}>
              {chartMode === "trend" && (
                <TrendChart
                  points={view.points}
                  comparePoints={view.priorAligned ?? undefined}
                  compareLabel="Previous period"
                  seriesLabel={measureLabel}
                  focusDate={focus}
                  onSelectPoint={(date) => set({ focus: date === focus ? null : date })}
                />
              )}
              {chartMode === "ranked" && (
                <RankedBars
                  rows={topMovements}
                  selected={activeProduct}
                  onSelect={(p) => set({ product: p })}
                  valueLabel={measureLabel}
                />
              )}
              {chartMode === "slope" && (
                <Slopegraph
                  rows={topMovements}
                  selected={activeProduct}
                  onSelect={(p) => set({ product: p })}
                  periodDays={period > 0 ? period : view.points.length}
                />
              )}
              {chartMode === "multiples" && (
                <SmallMultiples
                  series={multiples}
                  selected={activeProduct}
                  onSelect={(p) => set({ product: p })}
                />
              )}
            </div>
          </section>

          <section className={`dpanel${surfaceClass("archive-growth")}`} data-surface="archive-growth">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">How the complaint archive grew</h2>
                <p className="dpanel-sub">
                  {growth
                    ? `Whole archive, all products · ${growth.first.total.toLocaleString()} published in ${formatMonth(growth.first.month)} · ${growth.last.total.toLocaleString()} in ${formatMonth(growth.last.month)}${
                        growth.multiple ? ` · ${growth.multiple.toFixed(1)}× more per month` : ""
                      }`
                    : "Monthly totals across every published complaint"}
                </p>
              </div>
              <div className="dpanel-tools">
                <Segmented
                  label="Growth span"
                  options={GROWTH_SPANS.map((g) => ({ value: g.months, label: g.label }))}
                  value={span}
                  onChange={setSpan}
                />
              </div>
            </div>
            <div className="dpanel-body is-chart">
              <TrendChart
                points={growth?.points ?? []}
                seriesLabel="Published that month"
                labelMode="month"
                emptyMessage="The archive summary has not been exported into this build."
              />
            </div>
          </section>
        </div>

        {/* ---------- right column ---------- */}
        <div className="dash-col dash-right">
          <section className={`dpanel dpanel-accent${surfaceClass("readout")}`} data-surface="readout">
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
                {readout.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className={`dpanel${surfaceClass("sample")}`} data-surface="sample">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">Illustrative record context</h2>
                <p className="dpanel-sub">
                  Stratified 300-row demonstration sample · not a ranking or a population count
                </p>
              </div>
            </div>
            <div className="dpanel-body is-stacked">
              {focus && (
                <p className="scope-note">
                  The focused date applies to the metric views above. These records are a
                  fixed sample and are not date-scoped.
                </p>
              )}
              {sampleRows.length === 0 ? (
                <p className="dpanel-sub">
                  No record in the sample matches the rules currently switched on
                  {activeProduct ? ` for ${activeProduct}` : ""}.
                </p>
              ) : (
                <VirtualList
                  className="sample-list"
                  items={sampleRows}
                  rowHeight={SAMPLE_ROW_HEIGHT}
                  keyFor={(r) => r.id}
                  renderRow={(r) => (
                    <button
                      type="button"
                      className={`sample-row${openRecordId === r.id ? " is-open" : ""}`}
                      onClick={() =>
                        set({ item: openRecordId === r.id ? null : `rec:${r.id}` })
                      }
                    >
                      <span className="sample-top">
                        <PriorityChip priority={r.priority} />
                        <ConfidenceChip confidence={r.signalConfidence} />
                      </span>
                      <span className="sample-issue">{r.issue}</span>
                      <span className="sample-product">{r.product}</span>
                      <span className="sample-next">{nextStepFor(r.recommendedAction)}</span>
                    </button>
                  )}
                />
              )}
              <p className="scope-note is-foot">
                {sampleRows.length} of {sampleIndex.length} sampled records · the mix is by
                construction, not by measurement
              </p>
            </div>
          </section>
        </div>

        {/* ---------- drawer ---------- */}
        {openModel && <ModelDrawer model={openModel} onClose={() => set({ item: null })} />}
        {openRecordId &&
          (pending || !sampleRecord ? (
            <RecordDrawerSkeleton onClose={() => set({ item: null })} />
          ) : (
            <RecordDrawer record={sampleRecord} onClose={() => set({ item: null })} />
          ))}
      </div>

      <p className="dash-foot">
        Archive figures cover all {ledger ? ledger.totalRecords.toLocaleString() : "17.1M"}{" "}
        published records. Metric views cover {series?.dates.length ?? 0} days across{" "}
        {products.length} products. Record context is a {sampleIndex.length}-row
        demonstration sample. The three are never combined.{" "}
        <span className="dash-foot-compact">{formatCompact(view.total)} in view</span>
      </p>
    </div>
  );
}
