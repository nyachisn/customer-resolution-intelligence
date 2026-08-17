"use client";

/**
 * Explore — the published archive, drilled.
 *
 * The surface leads with the population that actually has a story: 176
 * months, 2011-12 to 2026-07, ~16.9M published complaints. Everything else
 * on the screen drills into that curve rather than switching to a separate,
 * thinner view.
 *
 * Why monthly and why families: the daily product series this page used to
 * lead with is dominated by the working week (Sunday averages 6,328 against
 * 26,571 on a Wednesday), so a daily line mostly draws the calendar. And the
 * CFPB renamed its product taxonomy in 2017 and 2023, so a 15-year chart on
 * raw labels shows every category dying and being reborn. Month grain plus
 * the families in product-families.ts fix both.
 *
 * The rules rail is a real population instrument here: switching a rule off
 * changes how many of the archive's records reach a rule, per family, from
 * policy_by_product. The 300-row sample remains illustration only — it is
 * displayed, never counted, ranked or prioritized from.
 */

import { useMemo } from "react";
import { TrendChart } from "@/components/ui/TrendChart";
import { Chip, ConfidenceChip, PriorityChip } from "@/components/ui/Primitives";
import { FamilyGrowthTable, FamilyMultiples } from "./FamilyViews";
import { ModelLensRail } from "./ModelLens";
import { VirtualList } from "./VirtualList";
import { ModelDrawer, RecordDrawer, RecordDrawerSkeleton } from "./EvidenceDrawer";
import type { ArchiveExplorer, ComplaintRecordContext, SampleRecordIndexRow } from "@/lib/types";
import {
  ARCHIVE_VIEWS,
  CHART_MODES,
  type DashboardFilters,
  DEFAULT_FILTERS,
  RULE_IDS,
  type RuleId,
  isDefaultFilters,
  modelRef,
  recordRef,
} from "@/lib/filters";
import { useDashboardFilters } from "@/lib/use-filters";
import { findModel } from "@/lib/model-registry";
import type { SurfaceId } from "@/lib/model-registry";
import { TAXONOMY_CHANGES, familyById } from "@/lib/product-families";
import {
  archiveMonths,
  archiveTotals,
  cumulative,
  familySeries,
  inflections,
  issueContributions,
  policyRatesFor,
} from "@/lib/archive-analytics";
import { formatCompact, formatMonth, formatPct, nextStepFor } from "@/lib/analytics";

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

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; help?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          title={o.help}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Trailing 12 months of a curve, allowing for the cumulative view's carry. */
function lastTwelve(points: { value: number }[], view: string): number {
  if (points.length === 0) return 0;
  if (view === "cumulative") {
    const end = points[points.length - 1].value;
    const start = points[Math.max(points.length - 13, 0)].value;
    return end - start;
  }
  return points.slice(-12).reduce((s, p) => s + p.value, 0);
}

export function ExploreWorkspace({
  initialFilters,
  archive,
  sampleIndex,
  sampleRecord,
}: {
  initialFilters: DashboardFilters;
  archive: ArchiveExplorer | null;
  sampleIndex: SampleRecordIndexRow[];
  sampleRecord: ComplaintRecordContext | null;
}) {
  const { filters, set, reset, pending } = useDashboardFilters(initialFilters, DEFAULT_FILTERS);
  const { family: familyId, view, selectedRules, chartMode, focus, item } = filters;

  const rows = useMemo(() => archive?.monthlyProductVolume ?? [], [archive]);
  const months = useMemo(() => archiveMonths(rows), [rows]);
  const families = useMemo(() => familySeries(rows, months), [rows, months]);
  const activeFamily = familyById(familyId);
  const activeSeries = families.find((f) => f.family.id === familyId) ?? null;

  /* ---------------- the archive curve ------------------------------ */

  const baseCurve = useMemo(
    () => (activeSeries ? activeSeries.points : archiveTotals(rows, months)),
    [activeSeries, rows, months],
  );
  const curve = useMemo(
    () => (view === "cumulative" ? cumulative(baseCurve) : baseCurve),
    [baseCurve, view],
  );
  const moves = useMemo(() => (view === "volume" ? inflections(baseCurve) : []), [view, baseCurve]);

  const archiveTotal = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const scopeTotal = activeSeries ? activeSeries.total : archiveTotal;
  const peak = useMemo(
    () => (baseCurve.length > 0 ? baseCurve.reduce((b, p) => (p.value > b.value ? p : b), baseCurve[0]) : null),
    [baseCurve],
  );

  const focusPoint = focus ? (curve.find((p) => p.date.slice(0, 7) === focus) ?? null) : null;

  /* ---------------- what drove the change -------------------------- */

  const contributions = useMemo(
    () => issueContributions(archive?.productIssueMovement ?? [], activeFamily),
    [archive, activeFamily],
  );

  /* ---------------- rules as a population instrument --------------- */

  const policyRates = useMemo(
    () => policyRatesFor(archive?.policyByProduct ?? [], activeFamily),
    [archive, activeFamily],
  );

  const rateById = useMemo(() => new Map(policyRates.map((r) => [r.policyId, r])), [policyRates]);
  const evaluated = policyRates[0]?.evaluated ?? 0;

  // The headline the switches move. Summing triggers would double-count a
  // record that fired two policies, so this is an upper bound and says so.
  const flaggedUpperBound = selectedRules.reduce((s, id) => s + (rateById.get(id)?.triggered ?? 0), 0);

  /* ---------------- illustrative sample (display only) ------------- */

  const sampleRows = useMemo(() => {
    const on = new Set(selectedRules);
    const members = activeFamily ? new Set(activeFamily.members) : null;
    return sampleIndex.filter(
      (r) => r.policyIds.some((p) => on.has(p as RuleId)) && (!members || members.has(r.product)),
    );
  }, [sampleIndex, selectedRules, activeFamily]);

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

  const scopeLabel = activeFamily ? activeFamily.label : "every product";
  const first = months[0];
  const last = months[months.length - 1];

  // Deliberately not "last month over first month". The archive's first
  // month holds 2,536 records because the programme had just launched, so
  // that ratio reports the launch, not the growth. The share of the whole
  // archive that arrived in the last twelve months needs no baseline at all.
  const recent12m = activeSeries ? activeSeries.recent12m : lastTwelve(baseCurve, "volume");
  const recentShare = scopeTotal > 0 ? recent12m / scopeTotal : null;

  return (
    <div className={`dash-shell${item ? " has-drawer" : ""}`}>
      {/* ===================== filter bar ===================== */}
      <div className="dash-bar">
        <label className="db-field">
          <span>Product family</span>
          <select value={familyId ?? ""} onChange={(e) => set({ family: e.target.value || null })}>
            <option value="">Every product ({families.length} families)</option>
            {families.map((f) => (
              <option key={f.family.id} value={f.family.id}>
                {f.family.label}
              </option>
            ))}
          </select>
        </label>

        <div className="db-field">
          <span>Curve</span>
          <Segmented label="Archive view" options={ARCHIVE_VIEWS} value={view} onChange={(v) => set({ view: v })} />
        </div>

        <span className="db-spacer" />

        <div className="db-chips">
          {focus && (
            <button
              type="button"
              className="chip chip-accent is-clearable"
              onClick={() => set({ focus: null })}
            >
              {formatMonth(`${focus}-01`)} ✕
            </button>
          )}
          {activeFamily?.note && <Chip tone="caution">Taxonomy caveat</Chip>}
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
          <aside className={`dpanel dash-rail${surfaceClass("rules")}`} aria-label="Decision rules">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">Decision rules</h2>
                <p className="dpanel-sub">Trigger rates within {scopeLabel}</p>
              </div>
            </div>
            <div className="dpanel-body">
              <div className="rule-headline">
                <div className="rule-headline-value">{formatCompact(flaggedUpperBound)}</div>
                <div className="rule-headline-label">
                  records reach a rule that is switched on, out of {formatCompact(evaluated)} in{" "}
                  {scopeLabel}
                </div>
                <div className="rule-headline-note">
                  Upper bound — a record triggering two rules is counted under both.
                </div>
              </div>

              {RULE_IDS.map((id) => {
                const rate = rateById.get(id);
                return (
                  <Switch
                    key={id}
                    checked={selectedRules.includes(id)}
                    onChange={() => toggleRule(id)}
                    name={POLICY_LABEL[id]}
                    meta={
                      <>
                        {POLICY_NOTE[id]}
                        {rate?.rate != null && (
                          <>
                            {" · "}
                            <span className="switch-count">{formatPct(rate.rate)}</span>
                            {` (${formatCompact(rate.triggered)})`}
                          </>
                        )}
                      </>
                    }
                  />
                );
              })}

              <button
                type="button"
                className="rail-link"
                onClick={() => set({ item: "model:fct_issue_daily_metrics" })}
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
              <div className="dkpi-label">Complaints published</div>
              <div className="dkpi-value">{scopeTotal.toLocaleString()}</div>
              <div className="dkpi-foot">
                {first && last ? `${formatMonth(`${first}-01`)} – ${formatMonth(`${last}-01`)}` : "—"}
              </div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">Last 12 months</div>
              <div className="dkpi-value">
                {formatCompact(recent12m)}
              </div>
              <div className="dkpi-foot">
                {activeSeries?.changePct != null
                  ? `${formatPct(activeSeries.changePct, { signed: true })} vs the 12 before`
                  : "Complete months only"}
              </div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">Busiest month</div>
              <div className="dkpi-value">{peak ? formatCompact(peak.value) : "—"}</div>
              <div className="dkpi-foot">{peak ? formatMonth(peak.date) : "—"}</div>
            </div>
            <div className="dkpi">
              <div className="dkpi-label">Arrived in the last year</div>
              <div className="dkpi-value">{recentShare == null ? "—" : formatPct(recentShare)}</div>
              <div className="dkpi-foot">
                {activeSeries
                  ? `${formatPct(activeSeries.share)} of the whole archive is ${activeFamily?.label ?? ""}`
                  : "of everything published since 2011"}
              </div>
            </div>
          </div>

          <section className={`dpanel${surfaceClass("archive-growth")}`} data-surface="archive-growth">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">
                  {activeFamily ? activeFamily.label : "Every complaint ever published"}
                  {view === "cumulative" ? " · running total" : " · per month"}
                </h2>
                <p className="dpanel-sub">
                  {first && last
                    ? `${formatMonth(`${first}-01`)} to ${formatMonth(`${last}-01`)} · ${scopeTotal.toLocaleString()} records · click a month to pin it`
                    : "No archive data in this build"}
                </p>
              </div>
            </div>
            <div className="dpanel-body is-chart">
              <TrendChart
                points={curve}
                seriesLabel={view === "cumulative" ? "Published to date" : "Published that month"}
                labelMode="month"
                showPeak={view === "volume"}
                focusDate={focusPoint?.date ?? null}
                onSelectPoint={(date) => set({ focus: date.slice(0, 7) === focus ? null : date.slice(0, 7) })}
                markers={TAXONOMY_CHANGES.map((t) => ({ date: `${t.month}-01`, label: t.label }))}
                emptyMessage="The archive export has not been generated in this build."
              />
            </div>
            {(moves.length > 0 || activeFamily?.note) && (
              <div className="chart-annotations">
                {activeFamily?.note && <p className="chart-caveat">{activeFamily.note}</p>}
                {moves.map((m) => (
                  <p key={m.date} className="chart-move">
                    <strong>{formatMonth(m.date)}</strong> {m.label} — {m.previous.toLocaleString()} to{" "}
                    {m.value.toLocaleString()}. The archive records what moved, not why.
                  </p>
                ))}
              </div>
            )}
          </section>

          <section className={`dpanel${surfaceClass("metric-chart")}`} data-surface="metric-chart">
            <div className="dpanel-head">
              <div>
                <h2 className="dpanel-title">Which categories are growing</h2>
                <p className="dpanel-sub">
                  All {families.length} families across the same 15 years · click one to filter everything
                </p>
              </div>
              <div className="dpanel-tools">
                <Segmented
                  label="Comparison mode"
                  options={CHART_MODES}
                  value={chartMode}
                  onChange={(v) => set({ chartMode: v })}
                />
              </div>
            </div>
            <div className="dpanel-body">
              {chartMode === "growth" ? (
                <FamilyGrowthTable series={families} selected={familyId} onSelect={(id) => set({ family: id })} />
              ) : (
                <FamilyMultiples series={families} selected={familyId} onSelect={(id) => set({ family: id })} />
              )}
            </div>
          </section>
        </div>

        {/* ---------- right column ---------- */}
        <div className="dash-col dash-right">
          <section className={`dpanel dpanel-accent${surfaceClass("readout")}`} data-surface="readout">
            <div className="dpanel-head">
              <h2 className="dpanel-title">What drove the change</h2>
            </div>
            <div className="dpanel-body">
              <p className="readout-lede">
                {contributions.rows.length === 0
                  ? "No issue-level movement is available for this selection."
                  : `Across ${scopeLabel}, the last 12 complete months ran ${
                      contributions.totalDelta >= 0 ? "up" : "down"
                    } ${Math.abs(contributions.totalDelta).toLocaleString()} against the 12 before. These issues account for most of it.`}
              </p>
              <div className="contrib-list">
                {contributions.rows.map((c) => (
                  <div className="contrib-row" key={c.issue}>
                    <span className="contrib-issue">{c.issue}</span>
                    <span className="contrib-bar">
                      <span
                        className={`contrib-fill${c.delta < 0 ? " is-negative" : ""}`}
                        style={{ width: `${Math.min(Math.abs(c.contribution) * 100, 100)}%` }}
                      />
                    </span>
                    <span className="contrib-num">
                      {c.delta >= 0 ? "+" : "−"}
                      {formatCompact(Math.abs(c.delta))}
                    </span>
                  </div>
                ))}
              </div>
              <p className="scope-note is-foot">
                A decomposition, not an explanation. The archive holds no data on why volume moved —
                no awareness, marketing or company-side inputs exist in it.
              </p>
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
              {sampleRows.length === 0 ? (
                <p className="dpanel-sub">
                  No record in the sample matches the rules currently switched on
                  {activeFamily ? ` for ${activeFamily.label}` : ""}.
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
                      onClick={() => set({ item: openRecordId === r.id ? null : `rec:${r.id}` })}
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
        Every figure above is the whole published archive: {archiveTotal.toLocaleString()} complaints
        across {months.length} complete months and {families.length} product families. Record context
        is a separate {sampleIndex.length}-row demonstration sample and is never counted into these
        totals.
        {focusPoint && (
          <span className="dash-foot-compact">
            {formatMonth(focusPoint.date)}: {focusPoint.value.toLocaleString()}
          </span>
        )}
      </p>
    </div>
  );
}
