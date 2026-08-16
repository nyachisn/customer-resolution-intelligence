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
import type { ComplaintRecordContext, DemoExportMeta, OperationsMetric } from "./types";

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
      reasonCodes: Array.isArray(row.reason_codes) ? (row.reason_codes as string[]) : [],
      policyIds: Array.isArray(row.policy_ids) ? (row.policy_ids as string[]) : [],
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

export async function loadDemoMeta(): Promise<DemoExportMeta> {
  return readJson<DemoExportMeta>("export_meta.json", {
    export_version: "unset",
    generated_at_utc: "unset",
    case_context_window_days: 0,
    case_context_row_count: 0,
    metrics_row_count: 0,
  });
}
