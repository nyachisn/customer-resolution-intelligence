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

export type Layer = "staging" | "intermediate" | "mart";

export interface DagNode {
  name: string;
  layer: Layer;
  /** Upstream models, exactly as ref()'d. */
  deps: string[];
  /** Materialization in Snowflake — a view leaves no table behind. */
  materialized: "view" | "table";
  /** Rows in ANALYTICS_PROD, for the models that persist. */
  rows?: number;
  /** One line on what it does. */
  role: string;
}

export const DAG: DagNode[] = [
  {
    name: "stg_cfpb_complaints",
    layer: "staging",
    deps: [],
    materialized: "view",
    role: "Types every field once and drops rows missing anything decision-critical",
  },
  {
    name: "int_complaint_status_context",
    layer: "intermediate",
    deps: ["stg_cfpb_complaints"],
    materialized: "view",
    role: "Labels each record's completeness so nothing downstream re-derives it",
  },
  {
    name: "dim_issue_taxonomy",
    layer: "mart",
    deps: ["stg_cfpb_complaints"],
    materialized: "table",
    rows: 2642,
    role: "The canonical product and issue label set",
  },
  {
    name: "int_issue_daily_volume",
    layer: "intermediate",
    deps: ["int_complaint_status_context"],
    materialized: "view",
    role: "Counts complaints per day, product and issue — the grain every trend uses",
  },
  {
    name: "int_company_issue_patterns",
    layer: "intermediate",
    deps: ["int_complaint_status_context"],
    materialized: "view",
    role: "Bounded company context, constrained so it cannot become a ranking",
  },
  {
    name: "fct_complaints",
    layer: "mart",
    deps: ["int_complaint_status_context", "dim_issue_taxonomy"],
    materialized: "table",
    rows: 17119581,
    role: "The canonical fact table every population count is taken from",
  },
  {
    name: "int_issue_trends",
    layer: "intermediate",
    deps: ["int_issue_daily_volume"],
    materialized: "view",
    role: "Rolling window, baseline, change and share — decides what qualifies as emerging",
  },
  {
    name: "fct_issue_daily_metrics",
    layer: "mart",
    deps: ["int_issue_trends"],
    materialized: "table",
    rows: 314733,
    role: "The trusted daily metric layer; its count is the only one safe to sum across dates",
  },
  {
    name: "int_resolution_signals",
    layer: "intermediate",
    deps: ["int_complaint_status_context", "int_issue_trends"],
    materialized: "view",
    role: "Joins each record to the pattern it belongs to",
  },
  {
    name: "int_priority_policy_application",
    layer: "intermediate",
    deps: ["int_resolution_signals"],
    materialized: "view",
    role: "Evaluates all six policies against every record and keeps each result",
  },
  {
    name: "resolution_action_queue",
    layer: "mart",
    deps: ["int_priority_policy_application", "int_resolution_signals"],
    materialized: "table",
    rows: 17119581,
    role: "Applies precedence and lands one action per record with its reason codes",
  },
  {
    name: "operations_overview_metrics",
    layer: "mart",
    deps: ["fct_issue_daily_metrics", "resolution_action_queue"],
    materialized: "table",
    rows: 328994,
    role: "Pre-aggregated display metrics so the app never recomputes at read time",
  },
  {
    name: "agent_case_context",
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
};

/** The stages data passes through, end to end. */
export interface Stage {
  id: string;
  name: string;
  system: string;
  detail: string;
  /** What physically moves out of this stage. */
  output: string;
}

export const STAGES: Stage[] = [
  {
    id: "source",
    name: "Source",
    system: "CFPB",
    detail: "The public Consumer Complaint Database, downloaded as a bulk extract.",
    output: "CSV",
  },
  {
    id: "raw",
    name: "Raw",
    system: "Snowflake",
    detail: "Landed exactly as received, in its own schema. Nothing is corrected on the way in.",
    output: "RAW schema",
  },
  {
    id: "transform",
    name: "Transform",
    system: "dbt",
    detail: "13 models across staging, intermediate and marts, with 91 tests that fail the build.",
    output: "SQL, versioned in Git",
  },
  {
    id: "analytics",
    name: "Analytics",
    system: "Snowflake",
    detail: "Models materialize back into the warehouse. Marts persist as tables; the layers below stay views.",
    output: "ANALYTICS_PROD",
  },
  {
    id: "export",
    name: "Export",
    system: "Git",
    detail: "A curated aggregate export, read through the app-reader role and committed to the repo.",
    output: "JSON",
  },
  {
    id: "serve",
    name: "Serve",
    system: "Vercel",
    detail: "Next.js builds from that commit. The browser never holds a warehouse credential.",
    output: "Static + server-rendered",
  },
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
  storageGb: 2.53,
  rawRows: 17119590,
  /** One row was dropped by the staging model's required-field filter. */
  modelledRows: 17119581,
};

export interface Decision {
  question: string;
  answer: string;
}

export const DECISIONS: Decision[] = [
  {
    question: "Why Snowflake",
    answer:
      "Because the access boundary had to be a database primitive, not application code. The app reads through a role that can see the curated marts and nothing else, so a mistake in the frontend cannot reach raw data. Separating storage from compute also means a 17M-row rebuild costs a few minutes of warehouse time and nothing when idle.",
  },
  {
    question: "Why dbt",
    answer:
      "Because the transformation logic needed to be reviewable and testable like code. Every model is version-controlled SQL with its own tests, the DAG is derived from the queries themselves rather than maintained by hand, and a test that fails stops the build instead of publishing a wrong number.",
  },
  {
    question: "Why separate the layers",
    answer:
      "So that each layer can be trusted for one thing. Staging guarantees clean types, intermediate holds the business logic, marts are the only surface anything downstream reads. When a number looks wrong there is exactly one place it can have come from.",
  },
  {
    question: "Why a curated export instead of a live connection",
    answer:
      "Because the browser should never hold a warehouse credential. The application reads a versioned aggregate committed to the repo, produced by the same read-only role a server-backed deployment would use. It also means a deploy is reproducible: the data that shipped is in the commit.",
  },
];

export interface TrustControl {
  name: string;
  detail: string;
}

export const TRUST: TrustControl[] = [
  {
    name: "Testing",
    detail:
      "86 schema tests on uniqueness, nullability, accepted values and relationships, plus 5 singular tests asserting things the schema cannot — that daily volume reconciles, that no critical priority exists without a trigger, that no reason code is missing, that dropped rows stay within bounds, and that no response-duration claim can enter the models.",
  },
  {
    name: "Reconciliation",
    detail:
      "Ingestion checks its own row count against the source API's metadata before the load is accepted. One row of 17,119,590 is dropped by the staging filter, and that difference is asserted rather than tolerated silently.",
  },
  {
    name: "Lineage",
    detail:
      "The DAG above is generated from ref() calls, so it cannot drift from the code. Every tile in Explore names the model behind it.",
  },
  {
    name: "Monitoring",
    detail:
      "dbt Cloud runs the project on a schedule and on every pull request. The Streamlit operations console reads freshness, model status and quality checks directly from the warehouse.",
  },
  {
    name: "Access",
    detail:
      "Four roles with separate jobs: a loader that can write raw, a transformer that can build models, an app reader that can only select from curated marts, and an admin that owns the objects. The export script runs as the app reader so it fails the same way the application would.",
  },
];

export interface DecisionStep {
  stage: string;
  detail: string;
  model: string;
}

export const DECISION_CHAIN: DecisionStep[] = [
  {
    stage: "Complaint",
    detail: "One published record, cleaned and typed, with its completeness labelled.",
    model: "stg_cfpb_complaints",
  },
  {
    stage: "Signal",
    detail:
      "Its issue pattern measured against that pattern's own baseline — rolling window, change, observed share.",
    model: "int_issue_trends",
  },
  {
    stage: "Priority",
    detail:
      "Six policies evaluated against the record. Every result is kept, not just the ones that fired.",
    model: "int_priority_policy_application",
  },
  {
    stage: "Action",
    detail:
      "Precedence applied across whatever triggered, landing one recommendation with its reason codes and confidence.",
    model: "resolution_action_queue",
  },
];
