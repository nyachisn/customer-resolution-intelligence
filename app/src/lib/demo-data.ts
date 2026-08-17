/**
 * Loader for the curated demo export.
 *
 * The browser never connects to Snowflake. This module reads the versioned
 * export produced by scripts/export_demo_data.py, which itself was queried
 * through the CRI_APP_READER role — the same access boundary this app would
 * use in a server-backed deployment. See docs/05_architecture.md §7.
 */

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ComplaintRecordContext,
  DemoExportMeta,
  LedgerExhibits,
  MetricBundle,
  MetricSeries,
  OperationsMetric,
  PolicyTriggerRate,
  SampleRecordIndexRow,
} from "./types";
import type { ArchiveExplorer, DimensionCount } from "./types";

const DATA_DIR = path.join(process.cwd(), "src", "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(DATA_DIR, file), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    // The export may not exist yet in a fresh checkout — fail soft so the
    // app still builds and renders an empty/informative state rather than
    // crashing. scripts/export_demo_data.py populates this directory.
    return fallback;
  }
}

/**
 * Snowflake serializes ARRAY columns as a JSON-formatted *string*, not a JSON
 * array, so these arrive as '[\n  "RECENT_PUBLICATION_LAG"\n]'. An
 * Array.isArray() check silently yields [] for every row — which is what had
 * been quietly blanking every reason code and policy id on the record views.
 */
function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

function lower<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = v;
  return out;
}

export async function loadDemoRecords(): Promise<ComplaintRecordContext[]> {
  const raw = await readJson<Record<string, unknown>[]>("agent_case_context.json", []);
  return raw.map((r) => {
    const row = lower(r);
    return {
      complaintId: String(row.complaint_id ?? ""),
      complaintReceivedDate: String(row.complaint_received_date ?? ""),
      product: String(row.product ?? ""),
      subProduct: (row.sub_product as string) ?? null,
      issue: String(row.issue ?? ""),
      subIssue: (row.sub_issue as string) ?? null,
      submittedVia: String(row.submitted_via ?? ""),
      companyResponse: String(row.company_response ?? "Unknown"),
      timelyResponseStatus: (row.timely_response_status as ComplaintRecordContext["timelyResponseStatus"]) ?? "UNKNOWN",
      issueVolumeCurrent: Number(row.issue_volume_current ?? 0),
      baselineVolume: Number(row.baseline_volume ?? 0),
      volumeChangePct: row.volume_change_pct == null ? null : Number(row.volume_change_pct),
      observedSharePct: Number(row.observed_share_pct ?? 0),
      issuePatternStatus: (row.issue_pattern_status as ComplaintRecordContext["issuePatternStatus"]) ?? "NO_SIGNAL",
      recentPublicationLagFlag: Boolean(row.recent_publication_lag_flag),
      dataCompletenessStatus: (row.data_completeness_status as ComplaintRecordContext["dataCompletenessStatus"]) ?? "COMPLETE",
      signalConfidence: (row.signal_confidence as ComplaintRecordContext["signalConfidence"]) ?? "MEDIUM",
      interpretationLimitation: (row.interpretation_limitation as string) ?? null,
      priority: (row.priority as ComplaintRecordContext["priority"]) ?? "LOW",
      recommendedAction: (row.recommended_action as ComplaintRecordContext["recommendedAction"]) ?? "STANDARD_HANDLING",
      reasonCodes: toStringArray(row.reason_codes),
      policyIds: toStringArray(row.policy_ids),
      contextSummary: String(row.context_summary ?? ""),
      generatedAt: String(row.generated_at ?? ""),
    };
  });
}

export async function loadOperationsMetrics(): Promise<OperationsMetric[]> {
  const raw = await readJson<Record<string, unknown>[]>("operations_overview_metrics.json", []);
  return raw.map((r) => {
    const row = lower(r);
    return {
      metricDate: String(row.metric_date ?? ""),
      dashboardDimension: String(row.dashboard_dimension ?? ""),
      metricName: String(row.metric_name ?? ""),
      metricValue: Number(row.metric_value ?? 0),
    };
  });
}

/**
 * Pivot the long-format metric rows into aligned per-dimension series.
 *
 * Runs on the server so the 15,023-row array never reaches the browser. Only
 * metrics spanning more than one date are included: a single-date row is a
 * snapshot of a standing distribution, and putting it on a time axis would
 * imply a movement the data does not contain.
 */
export function buildMetricBundle(metrics: OperationsMetric[]): MetricBundle {
  const byMetric = new Map<string, OperationsMetric[]>();
  for (const m of metrics) {
    const list = byMetric.get(m.metricName);
    if (list) list.push(m);
    else byMetric.set(m.metricName, [m]);
  }

  const bundle: MetricBundle = {};
  for (const [metricName, rows] of byMetric) {
    const dates = [...new Set(rows.map((r) => r.metricDate))].sort();
    if (dates.length < 2) continue;

    const dateIndex = new Map(dates.map((d, i) => [d, i]));
    const values: Record<string, number[]> = {};
    const totals = new Array<number>(dates.length).fill(0);
    const dimensionTotals = new Map<string, number>();

    for (const r of rows) {
      const i = dateIndex.get(r.metricDate);
      if (i == null) continue;
      const series = (values[r.dashboardDimension] ??= new Array<number>(dates.length).fill(0));
      series[i] += r.metricValue;
      totals[i] += r.metricValue;
      dimensionTotals.set(
        r.dashboardDimension,
        (dimensionTotals.get(r.dashboardDimension) ?? 0) + r.metricValue,
      );
    }

    const dimensions = [...dimensionTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([d]) => d);

    const series: MetricSeries = { metricName, dates, dimensions, values, totals };
    bundle[metricName] = series;
  }

  return bundle;
}

export async function loadMetricBundle(): Promise<MetricBundle> {
  return buildMetricBundle(await loadOperationsMetrics());
}

/**
 * The list projection of the illustrative record sample.
 *
 * This is a stratified 300-row demonstration sample, not a population ranking
 * — see docs/15_explore_workspace.md §3. Nothing derived from it may be
 * presented as a population count, priority mix, or ranking.
 */
export async function loadSampleRecordIndex(): Promise<SampleRecordIndexRow[]> {
  const records = await loadDemoRecords();
  return records.map((r) => ({
    id: r.complaintId,
    product: r.product,
    issue: r.issue,
    priority: r.priority,
    recommendedAction: r.recommendedAction,
    signalConfidence: r.signalConfidence,
    policyIds: r.policyIds,
  }));
}

/**
 * One full record, read server-side when the `item` URL parameter names it.
 *
 * The file read is cheap and the whole point is that the other 299 records
 * never cross the wire.
 */
export async function loadSampleRecord(id: string): Promise<ComplaintRecordContext | null> {
  const records = await loadDemoRecords();
  return records.find((r) => r.complaintId === id) ?? null;
}

function titleCase(raw: string, stripPrefix?: string): string {
  const s = stripPrefix && raw.startsWith(stripPrefix) ? raw.slice(stripPrefix.length) : raw;
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toCounts(
  rows: Record<string, unknown>[],
  labelKey: string,
  countKey: string,
  prefix?: string,
): { label: string; count: number }[] {
  return rows.map((r) => {
    const row = lower(r);
    const rawLabel = String(row[labelKey.toLowerCase()] ?? "");
    return { label: titleCase(rawLabel, prefix), count: Number(row[countKey.toLowerCase()] ?? 0) };
  });
}

export async function loadLedgerExhibits(): Promise<LedgerExhibits | null> {
  const raw = await readJson<Record<string, unknown> | null>("ledger_exhibits.json", null);
  if (!raw) return null;

  const totals = (raw.totals ?? {}) as Record<string, unknown>;
  const monthlyVolume = ((raw.monthly_volume as Record<string, unknown>[]) ?? []).map((r) => {
    const row = lower(r);
    return { month: String(row.month ?? "").slice(0, 7), total: Number(row.total ?? 0) };
  });
  const emergingSignals = ((raw.emerging_signals as Record<string, unknown>[]) ?? []).map((r) => {
    const row = lower(r);
    return {
      product: String(row.product ?? ""),
      issue: String(row.issue ?? ""),
      metricDate: String(row.metric_date ?? ""),
      volumeChangePct: Number(row.volume_change_pct ?? 0),
      issueVolumeCurrent: Number(row.issue_volume_current ?? 0),
    };
  });

  const policyTriggerRates: PolicyTriggerRate[] = (
    (raw.policy_triggers as Record<string, unknown>[]) ?? []
  ).map((r) => {
    const row = lower(r);
    const triggeredCount = Number(row.triggered_cnt ?? 0);
    const evaluatedCount = Number(row.evaluated_cnt ?? 0);
    return {
      policyId: String(row.policy_id ?? ""),
      triggeredCount,
      evaluatedCount,
      triggerRate: evaluatedCount > 0 ? triggeredCount / evaluatedCount : null,
    };
  });

  return {
    generatedAtUtc: String(raw.generated_at_utc ?? ""),
    policyTriggerRates,
    totalRecords: Number(totals.total ?? totals.TOTAL ?? 0),
    minDate: String(totals.min_date ?? totals.MIN_DATE ?? ""),
    maxDate: String(totals.max_date ?? totals.MAX_DATE ?? ""),
    distinctProducts: Number(totals.distinct_products ?? totals.DISTINCT_PRODUCTS ?? 0),
    monthlyVolume,
    products: toCounts((raw.products as Record<string, unknown>[]) ?? [], "product", "cnt"),
    priority: toCounts((raw.priority as Record<string, unknown>[]) ?? [], "priority", "cnt"),
    confidence: toCounts((raw.confidence as Record<string, unknown>[]) ?? [], "signal_confidence", "cnt"),
    action: toCounts((raw.action as Record<string, unknown>[]) ?? [], "recommended_action", "cnt"),
    policyTriggers: toCounts(
      (raw.policy_triggers as Record<string, unknown>[]) ?? [],
      "policy_id",
      "triggered_cnt",
      "POLICY_",
    ),
    completeness: toCounts((raw.completeness as Record<string, unknown>[]) ?? [], "data_completeness_status", "cnt"),
    timely: toCounts((raw.timely as Record<string, unknown>[]) ?? [], "timely_response_status", "cnt"),
    emergingSignals,
    companies: toCounts((raw.companies as Record<string, unknown>[]) ?? [], "company", "total"),
  };
}

export async function loadDemoMeta(): Promise<DemoExportMeta> {
  return readJson<DemoExportMeta>("export_meta.json", {
    export_version: "unset",
    generated_at_utc: "unset",
    publication_lag_window_days: 60,
    case_context_window_days: 0,
    case_context_row_count: 0,
    metrics_row_count: 0,
    source_total_records: null,
    source_retrieval_date: null,
  });
}

/**
 * The full published history at month grain, with product and issue intact.
 *
 * Aggregate-only by construction: every row is a GROUP BY over the
 * population. See docs/15_explore_workspace.md.
 */
export async function loadArchiveExplorer(): Promise<ArchiveExplorer | null> {
  const raw = await readJson<Record<string, unknown> | null>("archive_explorer.json", null);
  if (!raw) return null;

  const rows = (key: string) => ((raw[key] as Record<string, unknown>[]) ?? []).map(lower);

  return {
    generatedAtUtc: String(raw.generated_at_utc ?? ""),
    monthlyProductVolume: rows("monthly_product_volume").map((r) => ({
      month: String(r.month ?? "").slice(0, 7),
      product: String(r.product ?? ""),
      total: Number(r.total ?? 0),
    })),
    productIssueMovement: rows("product_issue_movement").map((r) => ({
      product: String(r.product ?? ""),
      issue: String(r.issue ?? ""),
      current12m: Number(r.current_12m ?? 0),
      prior12m: Number(r.prior_12m ?? 0),
    })),
    policyByProduct: rows("policy_by_product").map((r) => ({
      product: String(r.product ?? ""),
      policyId: String(r.policy_id ?? ""),
      triggeredCount: Number(r.triggered_count ?? 0),
      evaluatedCount: Number(r.evaluated_count ?? 0),
    })),
    policyCombinations: rows("policy_combinations").map((r) => ({
      product: String(r.product ?? ""),
      policies: String(r.combo ?? "")
        .split("|")
        .filter((p) => p && p !== "POLICY_STABLE_PATTERN"),
      count: Number(r.cnt ?? 0),
    })),
    weekdayRhythm: rows("weekday_rhythm").map((r) => ({
      dayName: String(r.day_name ?? ""),
      average: Number(r.avg_total ?? 0),
    })),
    stateByProduct: dimensionRows(rows("state_by_product"), "state"),
    responseByProduct: dimensionRows(rows("response_by_product"), "company_response"),
    channelByProduct: dimensionRows(rows("channel_by_product"), "submitted_via"),
  };
}

function dimensionRows(rows: Record<string, unknown>[], key: string): DimensionCount[] {
  return rows.map((r) => ({
    product: String(r.product ?? ""),
    value: String(r[key] ?? ""),
    count: Number(r.cnt ?? 0),
  }));
}
