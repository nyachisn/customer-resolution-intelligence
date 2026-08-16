/**
 * Derived analytics over the curated export.
 *
 * Everything here is computed from data that already exists in
 * operations_overview_metrics / agent_case_context / ledger_exhibits.
 * Nothing is fabricated: if the underlying series is too short or too
 * sparse to support a comparison, the function returns null and the UI
 * shows nothing rather than a guess.
 */

import type { ComplaintRecordContext, OperationsMetric } from "./types";

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

export interface Mover {
  dimension: string;
  current: number;
  previous: number;
  changePct: number | null;
  share: number;
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

/** Daily totals for a metric, optionally restricted to one dimension. */
export function dailySeries(
  metrics: OperationsMetric[],
  metricName: string,
  dimension?: string | null,
): SeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const m of metrics) {
    if (m.metricName !== metricName) continue;
    if (dimension && m.dashboardDimension !== dimension) continue;
    byDate.set(m.metricDate, (byDate.get(m.metricDate) ?? 0) + m.metricValue);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({ date, value }));
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

/** Per-dimension period-over-period movement, ranked by absolute change. */
export function topMovers(
  metrics: OperationsMetric[],
  metricName: string,
  windowDays: number,
  opts: { minCurrent?: number; limit?: number } = {},
): Mover[] {
  const { minCurrent = 0, limit = 5 } = opts;
  const dims = dimensionsFor(metrics, metricName);
  const grandTotal = dailySeries(metrics, metricName)
    .slice(-windowDays)
    .reduce((s, p) => s + p.value, 0);

  const movers: Mover[] = [];
  for (const dim of dims) {
    const cmp = comparePeriods(dailySeries(metrics, metricName, dim), windowDays);
    if (!cmp) continue;
    if (cmp.current < minCurrent) continue;
    movers.push({
      dimension: dim,
      current: cmp.current,
      previous: cmp.previous,
      changePct: cmp.changePct,
      share: grandTotal > 0 ? cmp.current / grandTotal : 0,
    });
  }
  return movers
    .filter((m) => m.changePct != null)
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    .slice(0, limit);
}

/** Totals per dimension over the trailing window. */
export function totalsByDimension(
  metrics: OperationsMetric[],
  metricName: string,
  windowDays?: number,
): { dimension: string; value: number }[] {
  const cutoff = windowDays ? datesFor(metrics, metricName).slice(-windowDays)[0] : null;
  const totals = new Map<string, number>();
  for (const m of metrics) {
    if (m.metricName !== metricName) continue;
    if (cutoff && m.metricDate < cutoff) continue;
    totals.set(m.dashboardDimension, (totals.get(m.dashboardDimension) ?? 0) + m.metricValue);
  }
  return [...totals.entries()]
    .map(([dimension, value]) => ({ dimension, value }))
    .sort((a, b) => b.value - a.value);
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

export function titleize(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Record-level rollups for the Decisions surface                      */
/* ------------------------------------------------------------------ */

export interface AttentionItem {
  key: string;
  product: string;
  issue: string;
  priority: ComplaintRecordContext["priority"];
  recommendedAction: ComplaintRecordContext["recommendedAction"];
  confidence: ComplaintRecordContext["signalConfidence"];
  patternStatus: ComplaintRecordContext["issuePatternStatus"];
  volumeChangePct: number | null;
  observedSharePct: number;
  recordCount: number;
  reasonCodes: string[];
  limitation: string | null;
}

const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Group records to product x issue and keep the highest-priority
 * representative of each group. The queue is what needs attention at the
 * pattern level, not a list of individual published rows.
 */
export function buildAttentionQueue(records: ComplaintRecordContext[]): AttentionItem[] {
  const groups = new Map<string, ComplaintRecordContext[]>();
  for (const r of records) {
    const key = `${r.product}::${r.issue}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const items: AttentionItem[] = [];
  for (const [key, group] of groups) {
    const lead = [...group].sort((a, b) => {
      const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (p !== 0) return p;
      return (b.volumeChangePct ?? 0) - (a.volumeChangePct ?? 0);
    })[0];

    items.push({
      key,
      product: lead.product,
      issue: lead.issue,
      priority: lead.priority,
      recommendedAction: lead.recommendedAction,
      confidence: lead.signalConfidence,
      patternStatus: lead.issuePatternStatus,
      volumeChangePct: lead.volumeChangePct,
      observedSharePct: lead.observedSharePct,
      recordCount: group.length,
      reasonCodes: lead.reasonCodes,
      limitation: lead.interpretationLimitation,
    });
  }

  return items.sort((a, b) => {
    const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (p !== 0) return p;
    return (b.volumeChangePct ?? 0) - (a.volumeChangePct ?? 0);
  });
}

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
  ESCALATE_REVIEW: "Escalate for review",
  INVESTIGATE_PATTERN: "Investigate the underlying trend",
  REQUIRE_HUMAN_REVIEW: "Route to a human reviewer",
  STANDARD_HANDLING: "No action needed",
  PRIORITIZE_CASE_REVIEW: "Prioritize case review",
  UPDATE_AGENT_GUIDANCE: "Update agent guidance",
};

export function nextStepFor(action: string): string {
  return ACTION_NEXT_STEP[action] ?? titleize(action);
}
