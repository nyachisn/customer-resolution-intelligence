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

/**
 * One metric reshaped into aligned series, one array per dimension.
 *
 * operations_overview_metrics is 15,023 long-format rows, and every one of
 * them repeats its metric name and its (up to 52-character) product string.
 * Handing that array to a client component serializes all of it into the RSC
 * payload — about 1.8 MB of mostly repeated keys. Pivoting to shared axes
 * with numeric arrays carries the same numbers in roughly 50 KB.
 *
 * `dates` is this metric's own date axis: complaint_volume and
 * emerging_issue_count do not cover identical ranges, so they must not share
 * one. Missing days are zero-filled against that axis, which is correct here
 * because a day with no published complaints for a product genuinely
 * contributed nothing to the total.
 */
export interface MetricSeries {
  metricName: string;
  dates: string[];
  /** Dimensions ordered by total volume descending. */
  dimensions: string[];
  /** dimension -> one value per entry in `dates`. */
  values: Record<string, number[]>;
  /** Sum across every dimension, per entry in `dates`. */
  totals: number[];
}

/**
 * Every metric that forms a real time series, keyed by metric name.
 *
 * action_count is deliberately absent: it is a single-date snapshot of the
 * standing action distribution, not a series, and presenting it on a time
 * axis would imply a trend that the row does not contain.
 */
export type MetricBundle = Record<string, MetricSeries>;

/** One policy's population-level trigger rate, over the whole archive. */
export interface PolicyTriggerRate {
  policyId: string;
  triggeredCount: number;
  evaluatedCount: number;
  /** triggeredCount / evaluatedCount, or null when nothing was evaluated. */
  triggerRate: number | null;
}

/**
 * The minimum needed to list and filter the illustrative record sample.
 *
 * Deliberately excludes context_summary, sub_issue, company_response and the
 * received date: those are only needed once a single record is opened, and
 * keeping them out drops the default client payload for this file from about
 * 520 KB to about 35 KB. The full record is loaded server-side, one at a
 * time, by the `item` URL parameter.
 */
export interface SampleRecordIndexRow {
  id: string;
  product: string;
  issue: string;
  priority: Priority;
  recommendedAction: RecommendedAction;
  signalConfidence: SignalConfidence;
  policyIds: string[];
}

/** One aggregate row: a category label paired with its count. */
export interface LedgerCount {
  label: string;
  count: number;
}

/** One month's total complaint volume. */
export interface LedgerMonth {
  month: string;
  total: number;
}

/** One recently-qualified emerging-pattern signal. */
export interface LedgerSignal {
  product: string;
  issue: string;
  metricDate: string;
  volumeChangePct: number;
  issueVolumeCurrent: number;
}

/**
 * Matches ledger_exhibits.json, produced by scripts/export_demo_data.py.
 * Every row is a GROUP BY aggregate over the full population — never a
 * complaint-level record — so there is no consumer or company-ranking
 * risk in this shape by construction.
 */
export interface LedgerExhibits {
  generatedAtUtc: string;
  totalRecords: number;
  minDate: string;
  maxDate: string;
  distinctProducts: number;
  monthlyVolume: LedgerMonth[];
  products: LedgerCount[];
  priority: LedgerCount[];
  confidence: LedgerCount[];
  action: LedgerCount[];
  policyTriggers: LedgerCount[];
  /**
   * The same policy rows carrying their denominator. `policyTriggers` keeps
   * only the triggered count for the ledger's count-vs-count exhibits; a
   * trigger *rate* needs evaluated_count, which the export already writes.
   */
  policyTriggerRates: PolicyTriggerRate[];
  completeness: LedgerCount[];
  timely: LedgerCount[];
  emergingSignals: LedgerSignal[];
  companies: LedgerCount[];
}

/** Matches the literal keys scripts/export_demo_data.py writes to export_meta.json. */
export interface DemoExportMeta {
  export_version: string;
  generated_at_utc: string;
  /**
   * Trailing days excluded from period-over-period comparisons. Recently
   * received complaints publish before their record is complete, so the
   * tail of any volume series tapers as an artifact of publication rather
   * than a real decline. Mirrors dbt var publication_lag_window_days.
   */
  publication_lag_window_days: number;
  case_context_window_days: number;
  case_context_row_count: number;
  metrics_row_count: number;
  /**
   * Total published records in the source archive at ingestion time —
   * read from the pipeline's own retrieval record, not a hardcoded string.
   * Null in a checkout that has never run the ingestion scripts (data/ is
   * git-ignored) rather than a stale or fabricated number.
   */
  source_total_records: number | null;
  source_retrieval_date: string | null;
}

/* ------------------------------------------------------------------ */
/* Archive explorer — the full published history at month grain         */
/* ------------------------------------------------------------------ */

/** One month's volume for one published product label. */
export interface ArchiveMonthProduct {
  month: string;
  product: string;
  total: number;
}

/** Trailing 12 complete months against the 12 before, per product x issue. */
export interface IssueMovement {
  product: string;
  issue: string;
  current12m: number;
  prior12m: number;
}

/** One policy's trigger rate within one published product label. */
export interface ProductPolicyRate {
  product: string;
  policyId: string;
  triggeredCount: number;
  evaluatedCount: number;
}

/**
 * Matches archive_explorer.json. Every row is a GROUP BY aggregate over the
 * published population — no complaint_id, no per-record field.
 */
/**
 * One exact policy-set membership count.
 *
 * policy_ids partitions the population — the distinct combinations sum to
 * 17,119,581 — so the number of records tripping any of a chosen set of
 * rules is a sum over the combinations that intersect it. Summing
 * per-policy totals instead inflates the answer by every record that trips
 * two rules, which is what made the old rules panel read as nonsense.
 */
export interface PolicyCombination {
  product: string;
  /** Sorted policy ids, or the empty set for records that trip nothing. */
  policies: string[];
  count: number;
}

/** Average published volume for one weekday. */
export interface WeekdayRhythm {
  dayName: string;
  average: number;
}

export interface ArchiveExplorer {
  generatedAtUtc: string;
  monthlyProductVolume: ArchiveMonthProduct[];
  productIssueMovement: IssueMovement[];
  policyByProduct: ProductPolicyRate[];
  policyCombinations: PolicyCombination[];
  weekdayRhythm: WeekdayRhythm[];
  stateByProduct: DimensionCount[];
  responseByProduct: DimensionCount[];
  channelByProduct: DimensionCount[];
  companyByProduct: CompanyHandling[];
}

/**
 * Who received the complaints in a product, with their published outcome
 * split. Ordered by volume, which tracks company size and customer base as
 * much as conduct — this is "who handled these", never a quality ranking,
 * and no cross-company rate is derived from it.
 */
export interface CompanyHandling {
  product: string;
  company: string;
  count: number;
  explanationCount: number;
  monetaryCount: number;
  nonMonetaryCount: number;
  untimelyCount: number;
}

/** One issue's contribution to a single focused month. */
export interface MonthIssueSlice {
  issue: string;
  total: number;
  /** The same issue in the month before, for a like-for-like read. */
  previous: number;
}

/** What a focused month contains, reduced server-side from the full grid. */
export interface FocusedMonth {
  month: string;
  total: number;
  previousTotal: number;
  issues: MonthIssueSlice[];
}

/** A published product paired with one value of another dimension. */
export interface DimensionCount {
  product: string;
  value: string;
  count: number;
}
