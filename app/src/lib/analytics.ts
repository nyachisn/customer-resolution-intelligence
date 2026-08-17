/**
 * Derived analytics over the curated export.
 *
 * Everything here is computed from data that already exists in
 * operations_overview_metrics / agent_case_context / ledger_exhibits.
 * Nothing is fabricated: if the underlying series is too short or too
 * sparse to support a comparison, the function returns null and the UI
 * shows nothing rather than a guess.
 */

import type { MetricSeries, OperationsMetric } from "./types";

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  changePct: number | null;
  currentDays: number;
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
}

export const METRIC_LABELS: Record<string, string> = {
  complaint_volume: "Complaint volume",
  emerging_issue_count: "Emerging signals",
  action_count: "Recommended actions",
};

/** Distinct sorted dates present for a metric. */
export function datesFor(metrics: OperationsMetric[], metricName: string): string[] {
  const set = new Set<string>();
  for (const m of metrics) {
    if (m.metricName === metricName) set.add(m.metricDate);
  }
  return [...set].sort();
}

/** Distinct dimensions present for a metric, ordered by total volume desc. */
export function dimensionsFor(metrics: OperationsMetric[], metricName: string): string[] {
  const totals = new Map<string, number>();
  for (const m of metrics) {
    if (m.metricName !== metricName) continue;
    totals.set(m.dashboardDimension, (totals.get(m.dashboardDimension) ?? 0) + m.metricValue);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
}

/**
 * Compare the trailing `windowDays` against the equally-sized window
 * immediately before it. Returns null when the series is too short to
 * hold two complete windows — a partial comparison would overstate or
 * understate the change purely as an artifact of the window length.
 */
export function comparePeriods(series: SeriesPoint[], windowDays: number): PeriodComparison | null {
  if (series.length < windowDays * 2) return null;
  const currentSlice = series.slice(-windowDays);
  const previousSlice = series.slice(-windowDays * 2, -windowDays);
  const current = currentSlice.reduce((s, p) => s + p.value, 0);
  const previous = previousSlice.reduce((s, p) => s + p.value, 0);
  return {
    current,
    previous,
    changePct: previous > 0 ? (current - previous) / previous : null,
    currentDays: windowDays,
    currentStart: currentSlice[0].date,
    currentEnd: currentSlice[currentSlice.length - 1].date,
    previousStart: previousSlice[0].date,
    previousEnd: previousSlice[previousSlice.length - 1].date,
  };
}

export function formatPct(v: number | null, opts: { signed?: boolean } = {}): string {
  if (v == null) return "—";
  const pct = v * 100;
  const sign = opts.signed && pct > 0 ? "+" : "";
  const digits = Math.abs(pct) >= 10 ? 0 : 1;
  return `${sign}${pct.toFixed(digits)}%`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

/** "Jan 2020" — for series indexed by month rather than day. */
export function formatMonth(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

/**
 * "May 5 – Jun 1, 2026" — the year is stated once when both ends share it,
 * which keeps the range inside a dashboard tile without truncating.
 */
export function formatRange(fromIso: string, toIso: string): string {
  const to = formatDate(toIso);
  const from = formatDate(fromIso);
  const sameYear = fromIso.slice(0, 4) === toIso.slice(0, 4);
  return `${sameYear ? from.replace(/, \d{4}$/, "") : from} – ${to}`;
}

export function titleize(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Record-level context for the illustrative sample                     */
/* ------------------------------------------------------------------ */

const REASON_TEXT: Record<string, string> = {
  EMERGING_ISSUE_SIGNAL:
    "Volume for this pattern cleared the emerging-signal thresholds against its own baseline.",
  PUBLISHED_UNTIMELY_RESPONSE:
    "The published record shows the company did not meet the reporting standard for this case.",
  RECENT_PUBLICATION_LAG:
    "This pattern falls inside the recent-publication window, so its status may still change.",
  INCOMPLETE_CONTEXT: "One or more fields needed to interpret this pattern are missing.",
  MULTIPLE_QUALIFIED_TRIGGERS: "Two independent signals qualified on the same pattern.",
  STABLE_PATTERN: "No qualifying signal fired for this pattern.",
};

export function explainReasons(codes: string[]): string {
  const parts = codes.map((c) => REASON_TEXT[c]).filter(Boolean);
  if (parts.length === 0) return "No qualifying signal fired for this pattern.";
  return parts.join(" ");
}

const ACTION_NEXT_STEP: Record<string, string> = {
  ESCALATE_REVIEW: "Escalate now",
  INVESTIGATE_PATTERN: "Investigate this trend",
  REQUIRE_HUMAN_REVIEW: "Needs a person to check",
  STANDARD_HANDLING: "No action needed",
  PRIORITIZE_CASE_REVIEW: "Review sooner than usual",
  UPDATE_AGENT_GUIDANCE: "Update agent guidance",
};

export function nextStepFor(action: string): string {
  return ACTION_NEXT_STEP[action] ?? titleize(action);
}

/**
 * Points for one dimension of a pivoted metric, or the all-dimension total.
 *
 * The Explore workspace now reads the archive at month grain; this is what
 * remains in use for the overview page's 28-day like-for-like comparison.
 */
export function seriesPoints(
  series: MetricSeries | undefined,
  dimension: string | null,
): SeriesPoint[] {
  if (!series) return [];
  const values = dimension ? series.values[dimension] : series.totals;
  if (!values) return [];
  return series.dates.map((date, i) => ({ date, value: values[i] ?? 0 }));
}
