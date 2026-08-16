# Snowflake Streamlit Operations Console

**Status: SOURCE NOW IN REPO (`cri-operations-console/streamlit_app.py`), THREE DEFECTS FIXED AND VERIFIED LIVE. NOT YET REDEPLOYED to the Snowflake Workspace object — see "What is not yet done" below.**

## 2026-08-16, second update — source obtained, defects fixed, verified live

The user pasted the actual `streamlit_app.py` contents (copied from the Snowflake Workspace UI, per the access path identified below). It is now committed at `cri-operations-console/streamlit_app.py`. Three defects were found and fixed, each verified against live data via `CRI_APP_READER`:

1. **Issue Investigation empty state.** The query hardcoded `AND METRIC_DATE >= DATEADD(DAY, -180, CURRENT_DATE())`. `DIM_ISSUE_TAXONOMY` lists 2,642 product/issue combinations; only 346 ever produce a row in `FCT_ISSUE_DAILY_METRICS` (the rest never clear the volume threshold — correct, policy-driven, not a bug); and of those 346, **958 taxonomy-joined rows** had their most recent qualifying date more than 180 days before `CURRENT_DATE()`. Example verified live: `Prepaid card` / `Overdraft, savings or rewards features` has real data through 2017-04-06 that the fixed window silently discarded. Fix: removed the trailing-window filter so the query returns full available history for the selected issue; the "no data" message now only fires for issues that truly never cleared the volume threshold, which is correct behavior, not a bug. No dbt logic touched.
2. **Source Date / Retrieved / Snapshot Date inconsistency.** Root cause found in `dbt/models/marts/operations/resolution_action_queue.sql:177`: `current_date() as source_snapshot_date` — this computes "whatever date dbt last rebuilt," not the actual CFPB source date, and drifts independently of `fct_complaints.source_snapshot_date` (which correctly propagates the real, fixed ingestion-time value from staging). Live values confirmed the exact reported symptom: `RESOLUTION_ACTION_QUEUE.SOURCE_SNAPSHOT_DATE = 2026-08-15`, `FCT_COMPLAINTS.SOURCE_SNAPSHOT_DATE = 2026-08-16`. Fix: the console now reads `SOURCE_SNAPSHOT_DATE` from `FCT_COMPLAINTS` in both places it's displayed, instead of two different tables' differently-computed columns. Presentation-only change — no dbt SQL modified, no date hardcoded. (The mislabeled dbt field itself is a legitimate, separate follow-up — see "Known gap" below.)
3. **Total record count sourcing.** `RESOLUTION_ACTION_QUEUE` and `FCT_COMPLAINTS` happen to both report 17,119,581 rows today (confirmed live — `resolution_action_queue`'s grain really is 1:1 with the complaint population), so this was not numerically wrong today. But `FCT_COMPLAINTS` is the more correct authoritative source for "how many complaint records exist" — it's a fact about the complaint population, not the priority queue — and the console already queries it in the governance section. Fix: both the summary metric and the governance section now read from one query against `FCT_COMPLAINTS`, run once, instead of two separate tables that could diverge if the queue's grain ever changes.

All three fixes were verified by running the corrected SQL directly against Snowflake as `CRI_APP_READER` (not assumed from reading the code) — see the record count, matching source dates, and the previously-empty Prepaid card case returning real rows.

## Known gap — CRI_APP_READER is a design intent, not (yet) an enforced boundary for this object

`SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY` for the last 30 hours shows **zero queries executed under `CRI_APP_READER`** against these tables — only `CRI_TRANSFORMER` (dbt) and `ACCOUNTADMIN` (manual verification). The deployed object is owned directly by the user (`owner_role_type: USER`) in their personal Workspace, not deployed under a project service role — so when it actually runs, it executes under whatever role is active in that Snowsight session, which is not necessarily `CRI_APP_READER`. The code's own docstring and the governance caption at the bottom of the page both state the `CRI_APP_READER` boundary, and the SQL text itself never references `RAW` — but nothing at the infrastructure level currently *enforces* that boundary the way it's enforced for the Next.js export path (verified there by a live negative-access test, `snowflake/00_bootstrap/04_verify_access_boundary.sql`). Closing this gap requires deploying the console under a project role via `snow streamlit deploy` — new-infrastructure territory that was not done without confirmation, per this round's explicit "do not create additional Snowflake infrastructure" / "do not create another Streamlit app" constraints.

## What is not yet done

- The fixed source in the repo has **not been pushed back** into the live Snowflake Workspace object — that object still runs the original, unfixed code until someone copies this file's contents back into Snowsight, or the console is redeployed properly (see gap above).
- No `snow streamlit deploy` was run. No new Streamlit object, schema, or grant was created.

---

## First update (superseded by the above) — source location discovered, not yet readable

## 2026-08-16 update — a second Streamlit object now exists

A fresh `SHOW STREAMLITS IN ACCOUNT` on 2026-08-16 returns **two** objects, not one:

1. The unrelated one already documented below (`uncle-yers-root-depth-entry-form`, `COMPUTE_WH`, created 2026-08-14).
2. **New:** `ST76F86CBA5EBE114EF1C1C061C51A8B3E38896B4A`, titled *"Preview of workspace:/USER%2524.PUBLIC.DEFAULT%2524/cri-operations-console"*, created **2026-08-15T18:59:45-07:00**, `query_warehouse: CRI_TRANSFORM_WH`. This one is plausibly this project's console.

What was verified about object #2, and what that verification means:

| Check | Result |
|---|---|
| Registered in `CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD` | **No** — `SHOW STREAMLITS IN SCHEMA ...ANALYTICS_PROD` (run as `CRI_APP_READER`) returns no data |
| Present in this Git repository | **No** — exhaustive `find`/`grep` across the repo finds no `cri-operations-console/` directory and no `streamlit_app.py` anywhere |
| Owner | `NYACHISN` directly (`owner_role_type: USER`) — not `CRI_ADMIN` or any project service role |
| `source_location` | `snow://workspace/"USER$".PUBLIC."DEFAULT$"/versions/head/cri-operations-console` — a personal Snowflake Workspace, not a stage or Git-integrated deployment |
| Python source readable via `GET_DDL('STREAMLIT', ...)` | **No** — returns only the `CREATE STREAMLIT` statement (main_file, query_warehouse, comment, title), not file contents |
| Python source readable via `snow` CLI | **No** — the installed `snow` CLI (3.24.1) has no `workspace` subcommand |

**Conclusion:** this object is real, was created after this project's Snowflake bootstrap, and uses this project's warehouse — but it exists as a personal Workspace preview, not a governed, source-controlled deployment. Its actual Python source is not accessible through any tool available in this session, so it cannot be audited, validated, or fixed sight-unseen. Treating "an object with a matching name exists" as equivalent to "the console has been built and verified" would be a mistake in the other direction from the original one.

Two ways to close this gap, requiring a decision this document doesn't make on its own:
1. Export the Workspace file's contents into this repo (via Snowsight's UI) so it becomes readable, reviewable, and auditable like every other artifact in this project.
2. Build it fresh per the design below, deployed via `snow streamlit deploy` into a project-owned location under a project role, replacing the personal-workspace artifact.

---

## Original finding (2026-08-16, earlier pass) — retained for the record

This document was created on 2026-08-16, during a validation pass that was instructed to inspect this file and `cri-operations-console/` as though they already existed. Direct inspection found neither:

- No `cri-operations-console/` directory anywhere in the repository (`find . -iname "cri-operations-console"` — no results).
- No `docs/13_snowflake_streamlit.md` prior to this file being created.
- `SHOW STREAMLITS IN ACCOUNT` returned exactly one object at that time, created 2026-08-14 (a day before this project's Snowflake bootstrap), titled *"Preview of workspace:.../uncle-yers-root-depth-entry-form"*, owned by the account user directly, running on `COMPUTE_WH` (not `CRI_TRANSFORM_WH`), in schema `USER$NYACHISN.PUBLIC` (a personal workspace, not `CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD`). Its name and metadata (`createActionSource: "skill-streamlit-in-workspaces_1.0.0"`) indicate it is an unrelated Snowflake Workspaces artifact, not connected to this project.

At the time this was written, that conclusion was accurate — the `cri-operations-console` workspace object had not yet been created (it was created three hours later, 18:59 vs. this document's 2026-08-16 creation reflecting a same-day-prior-evening check). It is retained here rather than deleted so the record of what was verified, and when, stays honest.

---

## Purpose

An internal, Snowflake-native operational view onto the same governed data the Next.js application reads — for someone who already has Snowflake access and wants to query/filter the operational marts directly, without needing the curated export or a deployed web app. It **complements** Next.js; it does not replace it, and Next.js/Vercel remains the primary product experience.

## Intended architecture (unbuilt)

```text
CFPB → Snowflake RAW → dbt → ANALYTICS_PROD → CRI_APP_READER → Streamlit console
```

The same governed layer and the same read-only role the Next.js export already uses — no new grants, no new warehouse, no new schema.

| Constraint | Requirement |
|---|---|
| Data source | `ANALYTICS_PROD` only — `RESOLUTION_ACTION_QUEUE`, `FCT_ISSUE_DAILY_METRICS`, `DIM_ISSUE_TAXONOMY`, `FCT_COMPLAINTS`, `OPERATIONS_OVERVIEW_METRICS` |
| Role | `CRI_APP_READER` — the same boundary verified in `snowflake/00_bootstrap/04_verify_access_boundary.sql`. No new role, no elevated grant. |
| Warehouse | `CRI_TRANSFORM_WH` — no second warehouse (see `docs/05_architecture.md` §13) |
| RAW access | **Never.** No exception. |
| Narrative exposure | **Never.** Narrative text never reaches `ANALYTICS_PROD` in the first place (excluded at the dbt staging layer), so this is structurally enforced, not a console-level filter to remember. |
| Decisioning logic | **None.** The console must display `priority`, `recommended_action`, `signal_confidence`, and `reason_codes` exactly as dbt computed them — never recompute, re-derive, or approximate any of these client-side. dbt remains the sole place a recommendation is decided. |
| Metric semantics | Must consume `fct_issue_daily_metrics.daily_complaint_count` for any "volume over a window" display — not `issue_volume_current`, which is a trailing rolling-window sum and will double-count if summed across dates. See the 2026-08-16 fix documented in `docs/09_supported_vs_unsupported_metrics.md` §4.1 and the header comments in `dbt/models/intermediate/int_issue_trends.sql`. This is the same constraint the Next.js Operations Overview page follows, for the same reason. |
| Priority vs. confidence | Must display these as two distinct fields, never conflated into one badge or one score — matching the distinction already enforced throughout the dbt layer and the Next.js app. |

## What building it would require

1. `cri-operations-console/streamlit_app.py` (or `.py` module set), `snowflake.yml`, `pyproject.toml`, `.streamlit/config.toml` — none exist yet.
2. A read-only Snowflake connection as `CRI_APP_READER` — the existing `~/.snowflake/cri_key.p8` key-pair credential, same as every other tool in this project.
3. Deployment via `snow streamlit deploy` (Snowflake CLI, already installed and configured for this project) into `ANALYTICS_PROD` or a dedicated read surface — **no new schema has been created for this**, and none should be created without a demonstrated reason.
4. Explicit reuse of the corrected `daily_complaint_count` field for any volume aggregation, from day one — not a retrofit.

## Why this wasn't built during this validation pass

The instructions for this pass explicitly scoped it as "final integration / validation," with an explicit constraint not to introduce new architecture without demonstrated need, and Phase 10 explicitly prohibits creating new Snowflake infrastructure without stopping to report first. Building a net-new Streamlit application is new work, not validation of existing work — so it was not started. This document, not a built console, is the deliverable for this item this round.
