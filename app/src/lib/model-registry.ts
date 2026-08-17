/**
 * The single description of the dbt transformation layer used by the app.
 *
 * Every field here is transcribed from source material that already exists
 * in the repository — the `-- purpose/grain/outputs/limitations` headers on
 * each model's .sql, and the first-person `description:` blocks in the five
 * schema .yml files. Nothing is inferred, and nothing here claims runtime
 * lineage or current dbt run state: this is a hand-authored mirror of the
 * project's own documentation, not a live catalogue read.
 *
 * `surfaces` is the one thing dbt does not know and cannot: which parts of
 * this interface a model actually feeds. It is maintained here by hand and
 * consumed by both the Data Story page and Explore's Model Lens, so a model
 * is described in exactly one place. Adding a panel means adding its id to
 * the model that powers it — see SURFACE_LABELS for the ids in use.
 */

export type ModelLayer = "Staging" | "Intermediate" | "Mart";

/** Ids used as `data-surface` attributes on the Explore panels. */
export type SurfaceId =
  | "kpis"
  | "metric-chart"
  | "archive-growth"
  | "rules"
  | "sample"
  | "readout";

export const SURFACE_LABELS: Record<SurfaceId, string> = {
  kpis: "Metric summary",
  "metric-chart": "Metric chart (trend, ranked, slope, small multiples)",
  "archive-growth": "Archive growth curve",
  rules: "Rules in this view",
  sample: "Illustrative record context",
  readout: "What this is showing",
};

export interface ModelEntry {
  /** Friendly display name — how a reader should refer to it. */
  displayName: string;
  /** The dbt model name, exactly as it appears in dbt/models. */
  name: string;
  layer: ModelLayer;
  /** One row of this model is… (from the model header's `grain:`). */
  grain: string;
  /** What it does, in plain language. */
  purpose: string;
  /** The main fields or artifacts it produces. */
  outputs: string;
  /** What it cannot be read as saying (from the header's `limitations:`). */
  limitations: string;
  /** Which Explore panels this model's data reaches, if any. */
  surfaces: SurfaceId[];
}

export const MODEL_REGISTRY: ModelEntry[] = [
  {
    displayName: "Cleaned complaint source",
    name: "stg_cfpb_complaints",
    layer: "Staging",
    grain: "1 row per published complaint, as received from the CFPB archive",
    purpose:
      "Renames and types every field once, normalizes the string \"None\" to a real null, and drops rows missing anything decision-critical. Everything downstream can then assume clean required fields.",
    outputs: "Typed complaint columns: identifiers, dates, product/issue taxonomy, company response, timeliness flag.",
    limitations:
      "A published record, not a customer. The archive publishes no company response timestamp, so no duration can be derived at any layer above this one.",
    surfaces: [],
  },
  {
    displayName: "Record completeness context",
    name: "int_complaint_status_context",
    layer: "Intermediate",
    grain: "1 published complaint record",
    purpose:
      "Assigns one data-completeness label per record, so a later model never has to re-derive whether a row is safe to interpret.",
    outputs: "data_completeness_status, published status context.",
    limitations:
      "The source publishes no lifecycle timestamps, so completeness describes the record's fields, not a case's progress.",
    surfaces: [],
  },
  {
    displayName: "Daily issue volume",
    name: "int_issue_daily_volume",
    layer: "Intermediate",
    grain: "1 calendar date × product × issue",
    purpose:
      "Counts complaints per day per product and issue. This is the grain every trend on this dashboard is computed from.",
    outputs: "daily_complaint_count.",
    limitations:
      "An observed count of published complaints, not a rate and not a market-share measure.",
    surfaces: ["metric-chart", "kpis"],
  },
  {
    displayName: "Emerging-pattern trends",
    name: "int_issue_trends",
    layer: "Intermediate",
    grain: "1 calendar date × product × issue × trend policy",
    purpose:
      "Computes the rolling window, the baseline, the percentage change and the observed share — then decides whether a pattern qualifies as emerging.",
    outputs:
      "issue_volume_current, baseline_volume, volume_change_pct, observed_share_pct, issue_pattern_status.",
    limitations:
      "Counts are not normalized for company size or market share. A change is only meaningful against that pattern's own baseline.",
    surfaces: ["metric-chart", "kpis", "readout"],
  },
  {
    displayName: "Record signal context",
    name: "int_resolution_signals",
    layer: "Intermediate",
    grain: "1 published complaint record",
    purpose:
      "Joins each complaint to the trend context for its own date, product and issue, so a record carries the pattern it belongs to.",
    outputs: "Record-level published and derived resolution signals.",
    limitations:
      "No duration inputs. timely_response_status is a published assessment, never a measured interval.",
    surfaces: ["sample"],
  },
  {
    displayName: "Policy evaluation",
    name: "int_priority_policy_application",
    layer: "Intermediate",
    grain: "1 published complaint record × policy rule evaluated",
    purpose:
      "Evaluates all six policy rules against every record and keeps each trigger state — not just the ones that fired — so the full evaluation stays auditable.",
    outputs: "policy_id, triggered, reason_code, evidence fields, signal_confidence.",
    limitations:
      "A triggered policy is a prompt to investigate, never a confirmed cause or a judgment about a company.",
    surfaces: ["rules", "sample"],
  },
  {
    displayName: "Company pattern context",
    name: "int_company_issue_patterns",
    layer: "Intermediate",
    grain: "1 calendar date × company × product × issue",
    purpose:
      "Bounded company-level pattern context, deliberately constrained so it cannot be read as a company ranking.",
    outputs: "complaint_count per company pattern, with a confidence label attached to every row.",
    limitations:
      "Constrained model. Complaint counts track company size and customer base as much as conduct, so no company comparison is supported.",
    surfaces: [],
  },
  {
    displayName: "Issue taxonomy",
    name: "dim_issue_taxonomy",
    layer: "Mart",
    grain: "1 distinct product × sub_product × issue × sub_issue combination",
    purpose: "Reusable product and issue taxonomy reference for every other model.",
    outputs: "The canonical label set used for grouping and display.",
    limitations:
      "Legacy and current CFPB labels coexist in the archive and must be versioned rather than merged.",
    surfaces: [],
  },
  {
    displayName: "Complaint fact table",
    name: "fct_complaints",
    layer: "Mart",
    grain: "1 canonical published complaint record",
    purpose:
      "The canonical fact table: one row per published complaint, carrying its provenance and completeness.",
    outputs: "The 17.1M-record spine every population aggregate is counted from.",
    limitations:
      "One row is a complaint record, never a customer, a consumer profile, or an identified person.",
    surfaces: ["archive-growth"],
  },
  {
    displayName: "Daily metric layer",
    name: "fct_issue_daily_metrics",
    layer: "Mart",
    grain: "1 calendar date × product × issue",
    purpose:
      "The trusted daily metric layer. Its daily_complaint_count is the only field safe to sum across dates.",
    outputs: "daily_complaint_count, issue_pattern_status, observed_share_pct.",
    limitations:
      "Observed counts only. Every row carries observed_share_pct so a count is never read without its denominator.",
    surfaces: ["metric-chart", "kpis", "archive-growth"],
  },
  {
    displayName: "Decision queue",
    name: "resolution_action_queue",
    layer: "Mart",
    grain: "1 complaint record × final recommendation run",
    purpose:
      "Applies precedence across triggered policies and lands one recommended action per record, with reason codes and confidence attached.",
    outputs: "priority, recommended_action, triggered_policy_ids, reason_codes, signal_confidence.",
    limitations:
      "Every non-standard action requires a policy id, a reason code, evidence fields and a confidence label. The app currently reaches this model only through a 300-row illustrative sample.",
    surfaces: ["sample"],
  },
  {
    displayName: "Agent-safe case context",
    name: "agent_case_context",
    layer: "Mart",
    grain: "1 published complaint record",
    purpose:
      "The agent-safe surface: factual and derived context per record with no narrative text and no consumer identifiers. context_summary is a deterministic template, not generated text.",
    outputs: "The record fields shown in the evidence drawer.",
    limitations:
      "The mart holds the full population; the committed export samples 300 rows for demonstration. Nothing in this interface counts, ranks or prioritizes from that sample.",
    surfaces: ["sample"],
  },
  {
    displayName: "Curated dashboard metrics",
    name: "operations_overview_metrics",
    layer: "Mart",
    grain: "1 metric date × dashboard dimension × metric name",
    purpose:
      "The curated, pre-aggregated surface built so the app never recomputes distributions at read time. Every metric on this dashboard's six-month views comes from here.",
    outputs: "complaint_volume and emerging_issue_count by date × product; action_count as a single-date snapshot.",
    limitations:
      "complaint_volume is sourced from daily_complaint_count, the true per-date count — it is the only measure here that is safe to sum across dates. action_count is a snapshot, not a series.",
    surfaces: ["kpis", "metric-chart", "readout"],
  },
];

export const MODELS_BY_LAYER: { layer: ModelLayer; models: ModelEntry[] }[] = (
  ["Staging", "Intermediate", "Mart"] as ModelLayer[]
).map((layer) => ({ layer, models: MODEL_REGISTRY.filter((m) => m.layer === layer) }));

export function findModel(name: string | null): ModelEntry | null {
  if (!name) return null;
  return MODEL_REGISTRY.find((m) => m.name === name) ?? null;
}
