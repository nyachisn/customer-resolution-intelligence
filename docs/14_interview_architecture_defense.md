# Interview: Architecture Defense

Concise, technically accurate answers grounded in the actual implementation — not the design as originally envisioned, the system as it was actually built and verified. Cross-references point to where each claim is proven, not just asserted.

## 1. Walk me through the architecture, end to end.

CFPB publishes a public bulk CSV archive (`https://files.consumerfinance.gov/ccdb/complaints.csv.zip`, ~17.1M rows, verified 2026-08-15). `scripts/split_and_stage.py` splits it into row-aligned gzip chunks and stages them into Snowflake's `RAW` schema (`CRI_LOADER` role, write-only into RAW). dbt (`CRI_TRANSFORMER` role) runs a four-layer transformation — `stg_cfpb_complaints` → intermediate models (rolling volumes, policy application, resolution signals) → mart models (`fct_complaints`, `fct_issue_daily_metrics`, `resolution_action_queue`, `operations_overview_metrics`, `agent_case_context`) — landing in `ANALYTICS_PROD`. `CRI_APP_READER` (SELECT-only, zero grants on RAW) is the single governed boundary two consumers read through: `scripts/export_demo_data.py` produces committed JSON that the Next.js app reads at build time and serves as static pages on Vercel, and a Snowflake-native Streamlit console (`cri-operations-console/streamlit_app.py`) reads the same models directly inside Snowflake. Full DAG: `dbt/README.md`.

## 2. Why Snowflake specifically?

Native RBAC with schema-level grant isolation made the RAW/ANALYTICS_PROD/CRI_APP_READER boundary straightforward to build and, more importantly, to *prove* — `snowflake/00_bootstrap/04_verify_access_boundary.sql` is a live negative-access test, not a grant-list read. Warehouse elasticity meant one XS warehouse (`CRI_TRANSFORM_WH`, 60s auto-suspend) handled a 17M-row full-refresh build without any capacity planning. And Snowflake is where dbt, Streamlit, and this kind of governed-analytics pattern are most naturally demonstrated together for a role evaluating exactly this stack.

## 3. Why dbt, not raw SQL scripts or a notebook pipeline?

Version-controlled, testable, self-documenting transformation. Every model has a header stating its grain, inputs, and decision record (`dbt/README.md` "Non-negotiables"); every column has a YAML description; the DAG is derivable by grep (`{{ ref(...) }}`), not by institutional memory. Concretely, this discipline is what caught the rolling-window double-counting bug this project shipped and fixed: `dbt build` includes a singular test (`assert_daily_volume_reconciles.sql`) that proves a metric's sum reconciles against ground truth — a script-based pipeline wouldn't have that test as a first-class, CI-enforceable artifact.

## 4. Why not Dynamic Tables?

Dynamic Tables buy automatic incremental refresh on a target lag, which is a feature you pay for continuously (compute on every refresh cycle) whether or not the underlying source changed. This project's actual cadence is "re-run when the CFPB archive is re-pulled" — irregular, developer-triggered, currently once. A scheduled Dynamic Table refresh would be pure waste against that access pattern. `dbt build --target prod` on demand does the same transformation with compute only when actually invoked. Revisit if the ingestion cadence becomes genuinely continuous (see Q13).

## 5. Why not Streams and Tasks?

Streams track row-level changes for incremental processing; Tasks schedule that processing. Both solve "keep derived tables in sync as source rows change continuously." This project's source is a batch archive pulled manually, not a changing table being written to concurrently — there's no change stream to consume. Introducing Streams/Tasks here would be building infrastructure for an ingestion pattern the project doesn't have, which is exactly the kind of unjustified complexity `docs/05_architecture.md` §13 documents deliberately avoiding.

## 6. Why batch, not real-time or streaming ingestion?

The source itself is batch: CFPB publishes a daily-refreshed bulk archive, not a change-data-capture feed or a webhook. Building streaming ingestion on top of a source that only updates once a day would add operational complexity (a running consumer, exactly-once semantics, backpressure handling) with no corresponding benefit — the data literally isn't more current than daily no matter how fast you ingest it. Batch matches the source's actual update frequency.

## 7. How is data quality handled?

At the staging boundary, not scattered through the DAG. `stg_cfpb_complaints.sql` normalizes literal `"None"` and empty strings to null, casts every field including `complaint_id` to string (never integer — the source's own OpenAPI spec says integer, but the live API returns a string; casting would silently corrupt the identifier for large values), and excludes rows missing a required field. Three source columns have `severity: warn` (not `error`) `not_null` tests because live verification found rare, real exceptions in the source itself — RAW asserts fidelity to what CFPB actually published, staging enforces the guarantee the rest of the DAG depends on. See `dbt/README.md` "Non-negotiables" and `docs/08_source_quality_report.md`.

## 8. What happens with malformed records?

30 rows out of 17,119,590 violate RFC4180 — an unescaped comma inside the narrative field shifts every subsequent column left, producing nulls in required fields (3 null `complaint_id`, 6 null `issue`, 21 null `company_response`, no overlap between the groups). These are excluded at staging, and `assert_dropped_row_count_bounded` is a dbt test that fails the build if that exclusion count ever drifts unexpectedly — so "we drop bad rows" is enforced, not just asserted in a doc. Full investigation trail: `docs/10_build_plan.md` entry L-13.

## 9. How is CRI_APP_READER actually protected — not just granted, but verified?

By a live negative-access test, not a `SHOW GRANTS` read. Early in this project, `SHOW GRANTS TO ROLE CRI_APP_READER` showed zero RAW grants, yet a live query as that role successfully read a RAW table — because Snowflake's account-level `DEFAULT_SECONDARY_ROLES = ('ALL')` kept the operating user's `ACCOUNTADMIN` role active alongside `CRI_APP_READER`. The fix, `USE SECONDARY ROLES NONE` before testing, is now codified as `snowflake/00_bootstrap/04_verify_access_boundary.sql` — attempt the forbidden read, expect an error. Re-run live in this session: `SELECT COUNT(*) FROM ...RAW.CFPB_COMPLAINTS_RAW` as `CRI_APP_READER` returns "Schema ... does not exist or not authorized." That incident (`docs/12_project_context.md` §9.1) is why this project treats "verified by grant inspection" and "verified live" as different claims.

## 10. How do the Streamlit console and the Next.js app relate to each other?

Same governed layer, same role, two different consumers with different jobs. Next.js/Vercel is the public-facing product experience, reading a curated, committed JSON export (no runtime Snowflake dependency at all — see `docs/11_vercel_deployment.md`). Streamlit is an internal operational view for someone who already has Snowflake access and wants to query the same marts directly — live queries, no export step, no separate deployment pipeline. Neither recomputes or duplicates the other's logic; both read `priority`, `recommended_action`, `signal_confidence` exactly as dbt computed them. Streamlit doesn't replace Next.js and isn't the primary product surface.

## 11. Why doesn't Next.js query Snowflake directly at request time?

Three reasons, in order of weight. Cost and complexity: a server-side query route needs connection pooling, credential management in a serverless environment, and per-request warehouse spend, none of which this product's actual freshness requirement (data as current as the last manual export) justifies. Simplicity: the current pattern (`export_demo_data.py` → committed JSON → `server-only` fs read → static build) has zero runtime failure modes related to Snowflake availability or latency. Credential surface: a live API route is one more place a Snowflake credential could leak; the export-then-commit pattern means the deployed Vercel artifact never holds one. `docs/05_architecture.md` §13 records this as a documented future option, not a demonstrated need.

## 12. How would this scale to higher volume or more users?

The dbt layer already processed the full 17.1M-row archive end to end (`dbt build`, both `ANALYTICS_DEV` and `ANALYTICS_PROD`, 0 errors) — row-volume headroom isn't the near-term constraint. The nearer constraint is build time on full-refresh materializations; the documented next step (not yet built, since it isn't yet justified — `dbt/README.md`) is incremental models once a real refresh cadence exists. For read-side scaling, the Next.js path is already close to unbounded (static hosting, no per-request Snowflake load); the Streamlit path scales with warehouse size, which is a one-line change (`CRI_TRANSFORM_WH` size, currently XS) if concurrent internal usage grew.

## 13. What would change if ingestion needed to become real-time?

The source would have to actually support it first — CFPB's bulk archive doesn't offer a change feed. If it did (or if a different, streaming-capable source were substituted), the honest list of what changes: Snowpipe or Snowpipe Streaming replaces the manual stage-and-load step; Streams on the RAW table would give dbt something to consume incrementally instead of full-refreshing; Tasks would schedule that consumption; dbt models would need `materialized='incremental'` strategies with defined unique keys; and the Next.js export step would need to move from "manual, on demand" to "scheduled," which is the point where a server-side query path (Q11) would start being worth its added complexity. None of this is built today because none of it is justified by the current source's actual update pattern.

## 14. What would change for multi-tenancy?

Nothing in the current schema carries a tenant identifier — this is a single-source, single-purpose dataset. Multi-tenancy would require: a tenant/account dimension threaded through staging onward, row-level security (Snowflake row access policies) or a schema-per-tenant split enforced at the `CRI_APP_READER`-equivalent boundary, and per-tenant export or query isolation on the read side. `docs/05_architecture.md` §68 already states this explicitly as out of scope — it's not a gap that was missed, it's a boundary that was deliberately not built because this product has exactly one tenant (the portfolio demo itself).

## 15. Where could Cortex (or another LLM feature) fit in the future, if anywhere?

Only somewhere that doesn't touch the decisioning path. Every priority, action, and confidence value in this system is deterministic and traceable to a documented policy rule (`docs/04_decisioning_policy.md`) — an LLM-derived signal would be neither deterministic nor rule-traceable, and would erode the property that makes the current output auditable. A defensible future use is narrower and orthogonal: summarizing the *already-computed, already-governed* evidence fields for a human reader (not deciding anything new), and only if complaint narratives were ever brought in under the constraints `docs/01_product_requirements.md` §181 already lays out — verified source availability, current CFPB publication policy, and a dedicated safety/provenance/evaluation plan, none of which exist yet. `docs/05_architecture.md` §433 records why this wasn't built now: it's not a capability gap, it's the same explainability boundary that shapes the rest of the project.

## 16. If you had another week, what would you build next?

In priority order, each justified by a real, already-identified gap rather than a nice-to-have: (1) sync the now-fixed `cri-operations-console/streamlit_app.py` back to a properly governed deployment under a project role via `snow streamlit deploy`, closing the `CRI_APP_READER`-enforcement gap found this pass (`docs/13_snowflake_streamlit.md`); (2) an automated test suite for the Next.js app — currently zero test files exist, verified by `find`, which is a real gap against a portfolio piece meant to demonstrate engineering rigor; (3) fix the mislabeled `resolution_action_queue.source_snapshot_date` field (`current_date()` instead of the real propagated snapshot date) at the dbt layer itself, now that the Streamlit-side symptom is patched around it; (4) incremental dbt models, once/if the ingestion cadence becomes more frequent than "manual, occasional" (Q12).
