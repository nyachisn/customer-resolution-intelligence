# Snowflake Streamlit Operations Console

**Status: APPROVED DESIGN — NOT YET IMPLEMENTED.**

This document was created on 2026-08-16, during a validation pass that was instructed to inspect this file and `cri-operations-console/` as though they already existed. Direct inspection found neither:

- No `cri-operations-console/` directory anywhere in the repository (`find . -iname "cri-operations-console"` — no results).
- No `docs/13_snowflake_streamlit.md` prior to this file being created.
- `SHOW STREAMLITS IN ACCOUNT` returns exactly one object, created 2026-08-14 (a day before this project's Snowflake bootstrap), titled *"Preview of workspace:.../uncle-yers-root-depth-entry-form"*, owned by the account user directly, running on `COMPUTE_WH` (not `CRI_TRANSFORM_WH`), in schema `USER$NYACHISN.PUBLIC` (a personal workspace, not `CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD`). Its name and metadata (`createActionSource: "skill-streamlit-in-workspaces_1.0.0"`) indicate it is an unrelated Snowflake Workspaces artifact, not connected to this project in any way.

**Conclusion: the Streamlit operations console has not been built.** This document records the approved design so a future session can build it without re-deriving the constraints, and so no session mistakes "approved" for "implemented" again.

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
