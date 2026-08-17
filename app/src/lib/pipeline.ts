/**
 * The pipeline, described once.
 *
 * Model dependencies are transcribed from the `ref()` calls in dbt/models —
 * they are the project's real DAG, not an illustration of one. Layer depth
 * is the longest path from the staging model, which is how dbt itself
 * decides execution order, so the diagram's columns are build order.
 *
 * Counts here are measured, not asserted: 13 models, 86 schema tests plus 5
 * singular tests in dbt/tests, and the warehouse footprint read from
 * INFORMATION_SCHEMA. Anything shown on the page that could drift from the
 * warehouse comes from the export instead.
 */

export type Layer = "staging" | "intermediate" | "mart" | "decisioning";

export interface DagNode {
  name: string;
  layer: Layer;
  /** Upstream models, exactly as ref()'d. */
  deps: string[];
  /** Materialization in Snowflake — a view leaves no table behind. */
  materialized: "view" | "table";
  /** Rows in ANALYTICS_PROD, for the models that persist. */
  rows?: number;
  /** One row of this model is… — from the model header's `grain:`. */
  grain: string;
  /** One line on what it does. */
  role: string;
}

export const DAG: DagNode[] = [
  {
    name: "stg_cfpb_complaints",
    grain: "1 published complaint record, as received",
    layer: "staging",
    deps: [],
    materialized: "view",
    role: "Types every field once and drops rows missing anything decision-critical",
  },
  {
    name: "int_complaint_status_context",
    grain: "1 published complaint record",
    layer: "intermediate",
    deps: ["stg_cfpb_complaints"],
    materialized: "view",
    role: "Labels each record's completeness so nothing downstream re-derives it",
  },
  {
    name: "dim_issue_taxonomy",
    grain: "1 product x sub-product x issue x sub-issue combination",
    layer: "mart",
    deps: ["stg_cfpb_complaints"],
    materialized: "table",
    rows: 2642,
    role: "The canonical product and issue label set",
  },
  {
    name: "int_issue_daily_volume",
    grain: "1 calendar date x product x issue",
    layer: "intermediate",
    deps: ["int_complaint_status_context"],
    materialized: "view",
    role: "Counts complaints per day, product and issue — the grain every trend uses",
  },
  {
    name: "int_company_issue_patterns",
    grain: "1 calendar date x company x product x issue",
    layer: "intermediate",
    deps: ["int_complaint_status_context"],
    materialized: "view",
    role: "Bounded company context, constrained so it cannot become a ranking",
  },
  {
    name: "fct_complaints",
    grain: "1 canonical published complaint record",
    layer: "mart",
    deps: ["int_complaint_status_context", "dim_issue_taxonomy"],
    materialized: "table",
    rows: 17119581,
    role: "The canonical fact table every population count is taken from",
  },
  {
    name: "int_issue_trends",
    grain: "1 calendar date x product x issue x trend policy",
    layer: "intermediate",
    deps: ["int_issue_daily_volume"],
    materialized: "view",
    role: "Rolling window, baseline, change and share — decides what qualifies as emerging",
  },
  {
    name: "fct_issue_daily_metrics",
    grain: "1 calendar date x product x issue",
    layer: "mart",
    deps: ["int_issue_trends"],
    materialized: "table",
    rows: 314733,
    role: "The trusted daily metric layer; its count is the only one safe to sum across dates",
  },
  {
    name: "int_resolution_signals",
    grain: "1 published complaint record",
    layer: "intermediate",
    deps: ["int_complaint_status_context", "int_issue_trends"],
    materialized: "view",
    role: "Joins each record to the pattern it belongs to",
  },
  {
    name: "int_priority_policy_application",
    grain: "1 complaint record x policy rule evaluated",
    layer: "decisioning",
    deps: ["int_resolution_signals"],
    materialized: "view",
    role: "Evaluates all six policies against every record and keeps each result",
  },
  {
    name: "resolution_action_queue",
    grain: "1 complaint record x final recommendation run",
    layer: "decisioning",
    deps: ["int_priority_policy_application", "int_resolution_signals"],
    materialized: "table",
    rows: 17119581,
    role: "Applies precedence and lands one action per record with its reason codes",
  },
  {
    name: "operations_overview_metrics",
    grain: "1 metric date x dashboard dimension x metric name",
    layer: "mart",
    deps: ["fct_issue_daily_metrics", "resolution_action_queue"],
    materialized: "table",
    rows: 328994,
    role: "Pre-aggregated display metrics so the app never recomputes at read time",
  },
  {
    name: "agent_case_context",
    grain: "1 published complaint record",
    layer: "mart",
    deps: ["fct_complaints", "int_resolution_signals", "resolution_action_queue"],
    materialized: "table",
    rows: 17119581,
    role: "The agent-safe surface: factual context per record, no narrative text",
  },
];

/**
 * Longest-path depth per node. dbt runs a model only once every upstream
 * model has run, so this is the build order, and laying the diagram out on
 * it means every arrow points forward.
 */
export function dagDepths(nodes: DagNode[] = DAG): Map<string, number> {
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const depth = new Map<string, number>();

  function resolve(name: string, seen: Set<string>): number {
    const cached = depth.get(name);
    if (cached != null) return cached;
    // Guards against a cycle rather than trusting the DAG to be acyclic —
    // a cycle would hang the layout instead of failing visibly.
    if (seen.has(name)) return 0;
    const node = byName.get(name);
    if (!node || node.deps.length === 0) {
      depth.set(name, 0);
      return 0;
    }
    seen.add(name);
    const d = 1 + Math.max(...node.deps.map((p) => resolve(p, seen)));
    seen.delete(name);
    depth.set(name, d);
    return d;
  }

  for (const n of nodes) resolve(n.name, new Set());
  return depth;
}

export const LAYER_LABEL: Record<Layer, string> = {
  staging: "Staging",
  intermediate: "Intermediate",
  mart: "Marts",
  decisioning: "Decisioning",
};

/**
 * What each layer is for, in one line.
 *
 * Decisioning is a responsibility rather than a dbt directory: the two
 * models below sit in intermediate/ and marts/ on disk, and are grouped here
 * by what they do, which is what the catalog is answering.
 */
export const LAYER_PURPOSE: Record<Layer, string> = {
  staging: "Cleans and standardizes the source fields once, so nothing downstream repeats it.",
  intermediate: "Joins records, calculates metrics and derives the analytical context.",
  mart: "Publishes the reusable datasets everything else reads.",
  decisioning: "Evaluates the policies and turns analytical signals into one action per record.",
};

/** One stage of the pipeline, as drawn on the How it's built page. */
export interface Stage {
  id: string;
  name: string;
  system: string;
  summary: string;
  /** Accent used to separate stages; not a data encoding. */
  tone: "source" | "ingest" | "transform" | "warehouse" | "serve" | "users";
  items: string[];
  /** Sub-blocks, used by the transform stage to show its four layers. */
  blocks?: { name: string; detail: string; models?: string[] }[];
}

export const STAGES: Stage[] = [
  {
    id: "source",
    name: "Source",
    system: "CFPB",
    summary: "Structured public complaint data",
    tone: "source",
    items: [
      "Consumer Complaint Database",
      "Bulk CSV extract",
      "Published complaint records",
      "Product, issue, response, date and state fields",
    ],
  },
  {
    id: "ingest",
    name: "Ingest",
    system: "Batch ingestion",
    summary: "Source-preserving load into Snowflake RAW",
    tone: "ingest",
    items: [
      "Chunked loading of the bulk extract",
      "Record count validated against source metadata",
      "Landed unchanged in the RAW schema",
    ],
  },
  {
    id: "transform",
    name: "Transform",
    system: "dbt",
    summary: "A dependency-driven model DAG, executed inside Snowflake",
    tone: "transform",
    items: [],
    blocks: [
      {
        name: "Staging",
        detail: "Clean and standardize source fields",
        models: ["stg_cfpb_complaints"],
      },
      {
        name: "Intermediate",
        detail: "Join records, calculate metrics, derive analytical context, evaluate business logic",
        models: [
          "int_complaint_status_context",
          "int_issue_daily_volume",
          "int_issue_trends",
          "int_resolution_signals",
          "int_company_issue_patterns",
        ],
      },
      {
        name: "Marts",
        detail: "Publish reusable analytical datasets",
        models: [
          "dim_issue_taxonomy",
          "fct_complaints",
          "fct_issue_daily_metrics",
          "operations_overview_metrics",
          "agent_case_context",
        ],
      },
      {
        name: "Decisioning",
        detail: "Apply policy precedence; produce priorities, reason codes and confidence",
        models: ["int_priority_policy_application", "resolution_action_queue"],
      },
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    system: "Snowflake",
    summary: "Where dbt models are materialized and served",
    tone: "warehouse",
    items: [
      "Analytics schema",
      "Materialized mart tables",
      "Analytical views",
      "Decisioning surfaces",
      "Curated metrics",
    ],
  },
  {
    id: "export",
    name: "Application data",
    system: "Curated export",
    summary: "The analytical fields the product needs, and nothing else",
    tone: "serve",
    items: [
      "Read-only analytical access",
      "Explicit column allowlist",
      "Reviewed aggregate output",
      "Versioned JSON, tracked in Git",
    ],
  },
  {
    id: "experience",
    name: "Experience",
    system: "Next.js on Vercel",
    summary: "Two consumption surfaces on one analytical platform",
    tone: "users",
    items: ["Overview", "Insights", "Exploration", "Decision support"],
    blocks: [
      {
        name: "Streamlit operations console",
        detail: "Pipeline health, data freshness, model status, quality checks",
      },
    ],
  },
];

/** Which tool owns which job — the distinction the page has to make. */
export const STACK_ROLES = [
  { tool: "Snowflake", job: "Data platform and warehouse" },
  { tool: "dbt", job: "Transformation and analytical modeling" },
  { tool: "dbt Cloud", job: "Orchestration, scheduling, CI and job execution" },
  { tool: "Next.js", job: "Application experience" },
  { tool: "Vercel", job: "Application deployment and hosting" },
];

/**
 * Warehouse facts measured from INFORMATION_SCHEMA rather than asserted.
 *
 * Storage is the production path only — ANALYTICS_PROD at 1.51 GB plus the
 * RAW landing schema at 1.02 GB. The development schema holds a second copy
 * and is deliberately not counted here, because it is not part of what the
 * application reads.
 */
export const WAREHOUSE = {
  models: 13,
  layers: 3,
  seeds: 3,
  schemaTests: 86,
  singularTests: 5,
  get tests() {
    return this.schemaTests + this.singularTests;
  },
  martTables: 6,
  /** Measured from INFORMATION_SCHEMA: ANALYTICS_PROD 1.51 GB + RAW 1.02 GB. */
  storageGb: 2.53,
  /** Rows landed in RAW, reconciled against the source API's own metadata. */
  loadedRows: 17119590,
  /** Rows surviving the staging model's required-field filter. */
  modelledRows: 17119581,
  get droppedRows() {
    return this.loadedRows - this.modelledRows;
  },
  /**
   * Rows inside complete calendar months, which is what the analytical
   * experience reads. Lower than modelledRows because the in-progress month
   * is excluded — the two must not be collapsed into one figure.
   */
  completeMonthRows: 16896978,
  publishedProducts: 21,
  productCategories: 11,
  issueAreas: 178,
  schemaTestBreakdown: [
    { kind: "not_null", count: 55 },
    { kind: "accepted_values", count: 17 },
    { kind: "unique", count: 8 },
    { kind: "unique_combination_of_columns", count: 4 },
    { kind: "relationships", count: 2 },
  ],
  roles: [
    { name: "CRI_LOADER", does: "Loads source data into RAW." },
    { name: "CRI_TRANSFORMER", does: "Builds the analytical models." },
    { name: "CRI_APP_READER", does: "Reads curated analytical outputs." },
    { name: "CRI_ADMIN", does: "Owns Snowflake objects and grants." },
  ],
};

export interface Decision {
  title: string;
  subtitle: string;
  answer: string;
}

export const DECISIONS: Decision[] = [
  {
    title: "Snowflake",
    subtitle: "Centralized analytical storage",
    answer:
      "Raw source data and transformed analytical models live in Snowflake, so storage, transformation and access control are managed independently of the application. Compute is separate from storage, so a full rebuild of 17.1M rows costs warehouse time only while it runs.",
  },
  {
    title: "dbt",
    subtitle: "Transformation as code",
    answer:
      "Business logic is version-controlled SQL with explicit dependencies and automated tests. The DAG is derived from ref() relationships rather than maintained separately, so model relationships stay visible and reproducible.",
  },
  {
    title: "Layered modeling",
    subtitle: "Separate responsibilities",
    answer:
      "Staging handles source cleanup. Intermediate models calculate reusable analytical logic. Mart models publish business-ready datasets. Decisioning models apply policy and produce actions. A wrong number can be traced to the layer that owns it.",
  },
  {
    title: "Curated application data",
    subtitle: "Isolate the product layer",
    answer:
      "The application receives only the analytical fields the product needs, produced through an explicit column allowlist and read with CRI_APP_READER. The export is versioned alongside the code, so a deploy and the data it shipped with stay together.",
  },
];

export interface DecisionStep {
  stage: string;
  detail: string;
  model: string;
}

export const DECISION_CHAIN: DecisionStep[] = [
  { stage: "Complaint", detail: "A published CFPB complaint enters the pipeline.", model: "" },
  {
    stage: "Cleaned record",
    detail: "Types and required fields are standardized.",
    model: "stg_cfpb_complaints",
  },
  {
    stage: "Issue context",
    detail: "The complaint's product and issue contribute to daily volume.",
    model: "int_issue_daily_volume",
  },
  {
    stage: "Trend signal",
    detail: "The issue is compared against its own historical baseline.",
    model: "int_issue_trends",
  },
  {
    stage: "Policy evaluation",
    detail: "The defined priority rules are evaluated against the record.",
    model: "int_priority_policy_application",
  },
  {
    stage: "Recommended action",
    detail:
      "Policy precedence produces one recommendation with supporting reason codes and confidence.",
    model: "resolution_action_queue",
  },
];

export interface TrustControl {
  name: string;
  detail: string;
  points?: string[];
}

export const TRUST: TrustControl[] = [
  {
    name: "Automated tests",
    detail:
      "91 dbt tests run across the project — 86 declared in the schema files and 5 singular tests written as SQL that must return no rows.",
    points: [
      "55 not_null",
      "17 accepted_values",
      "8 unique",
      "4 unique_combination_of_columns",
      "2 relationships",
      "5 singular business-rule tests",
    ],
  },
  {
    name: "Reconciliation",
    detail:
      "Ingestion compares the loaded record count against the source metadata before the load is accepted. 17,119,590 records landed in RAW; 17,119,581 survive the staging model's required-field filter, a difference of 9 rows that a singular test holds within bounds.",
  },
  {
    name: "Lineage",
    detail:
      "The model dependency graph is generated from dbt ref() relationships, so downstream dependencies are derived from the SQL rather than maintained as a separate diagram.",
  },
  {
    name: "Orchestration and monitoring",
    detail:
      "dbt Cloud runs the production transformation job and reports job, test and model status. It also runs on pull requests in this repository. The Streamlit operations console exposes freshness, model status, quality checks and pipeline health.",
  },
  {
    name: "Access",
    detail: "Four Snowflake roles, each with one job.",
    points: [
      "CRI_LOADER — loads source data into RAW",
      "CRI_TRANSFORMER — builds analytical models",
      "CRI_APP_READER — reads curated analytical outputs",
      "CRI_ADMIN — manages Snowflake objects and permissions",
    ],
  },
];
