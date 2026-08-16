/**
 * Shared types for the curated demo export.
 *
 * These mirror the mart contracts in docs/03_data_dictionary.md §6.
 * A field absent from that contract must not appear here.
 *
 * STATUS: Phase 0 scaffold — shapes declared, no data wired.
 */

/** Qualitative interpretation status. NOT a statistical measure. */
export type SignalConfidence = "HIGH" | "MEDIUM" | "LIMITED" | "NOT_SUPPORTED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RecommendedAction =
  | "STANDARD_HANDLING"
  | "PRIORITIZE_CASE_REVIEW"
  | "ESCALATE_REVIEW"
  | "INVESTIGATE_PATTERN"
  | "REQUIRE_HUMAN_REVIEW"
  | "UPDATE_AGENT_GUIDANCE";

export type IssuePatternStatus =
  | "QUALIFIED_SIGNAL"
  | "UNQUALIFIED_SIGNAL"
  | "INSUFFICIENT_BASELINE"
  | "NO_SIGNAL";

export type DataCompletenessStatus = "COMPLETE" | "PARTIAL" | "INSUFFICIENT";

/**
 * One published complaint record.
 *
 * A complaint record is an observation — never a customer, a consumer
 * profile, or an identified person. See docs/adr/ADR-003-no-individual-risk-score.md.
 *
 * There is deliberately no response-duration field: the CFPB source publishes
 * no company response timestamp. See ADR-004.
 */
export interface ComplaintRecordContext {
  complaintId: string;
  complaintReceivedDate: string;
  product: string;
  subProduct: string | null;
  issue: string;
  subIssue: string | null;
  submittedVia: string;

  /** Published CFPB status. "In progress" means unresolved at publication. */
  companyResponse: string;
  /** Published CFPB assessment. NOT a measured interval. */
  timelyResponseStatus: "YES" | "NO" | "UNKNOWN";

  issueVolumeCurrent: number;
  baselineVolume: number;
  volumeChangePct: number | null;
  /** Required alongside volumeChangePct so a change is read against its base. */
  observedSharePct: number;
  issuePatternStatus: IssuePatternStatus;

  /** True when response status may be incomplete. Renders a directional badge. */
  recentPublicationLagFlag: boolean;
  dataCompletenessStatus: DataCompletenessStatus;
  signalConfidence: SignalConfidence;
  interpretationLimitation: string | null;

  priority: Priority;
  recommendedAction: RecommendedAction;
  reasonCodes: string[];
  policyIds: string[];
  contextSummary: string;
  generatedAt: string;
}

/** One curated aggregate metric row, matching operations_overview_metrics. */
export interface OperationsMetric {
  metricDate: string;
  dashboardDimension: string;
  metricName: string;
  metricValue: number;
}

/** Matches the literal keys scripts/export_demo_data.py writes to export_meta.json. */
export interface DemoExportMeta {
  export_version: string;
  generated_at_utc: string;
  case_context_window_days: number;
  case_context_row_count: number;
  metrics_row_count: number;
}
