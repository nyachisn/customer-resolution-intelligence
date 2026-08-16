# Project Context — Durable Handoff Document

**Purpose:** let a future Claude Code session (or human) understand this project without the original conversation. This is NOT the build plan — see `10_build_plan.md` for the full status board, issue log, and open decisions. This document is generated from direct inspection of the repository on **August 16, 2026** (created, then revised same day after a second validation pass); where older docs disagreed with the actual code, the code won and the discrepancy is called out explicitly below.

---

## CURRENT STATUS (as of the third 2026-08-16 validation pass — FINALIZATION)

**Supersedes the "Streamlit: NOT COMPLETED / NOT validated" lines below.** A Streamlit object (`cri-operations-console`) had been created in the user's personal Snowflake Workspace after the second pass completed; its source was obtained (pasted by the user from Snowsight) and is now committed at `cri-operations-console/streamlit_app.py`. Three defects were found and fixed, each verified live against `CRI_APP_READER`:
1. Issue Investigation empty state — caused by a hardcoded `CURRENT_DATE() - 180 days` window; 958 of 2,642 selectable taxonomy combinations had real history older than that. Fixed by removing the artificial window; verified live (e.g., `Prepaid card` / `Overdraft, savings or rewards features` now correctly returns its real 2017 history instead of "no data").
2. Source Date / Snapshot Date inconsistency — root cause: `resolution_action_queue.sql:177` computes `source_snapshot_date` as `current_date()` (dbt-rebuild-time, drifts), diverging from `fct_complaints.source_snapshot_date` (correctly propagated from staging). Fixed presentation-side: both labels now read the one authoritative `fct_complaints` value. No dbt SQL changed.
3. Total record count — `resolution_action_queue` and `fct_complaints` coincidentally both report 17,119,581 today, but `fct_complaints` is the more correct authoritative source; console now reads it once and reuses the value everywhere.

Full detail, plus a found-but-not-yet-closed gap (the deployed object has never executed under `CRI_APP_READER` — see `docs/13_snowflake_streamlit.md` "Known gap"), and what's still not done (the fix has not been synced back into the live Snowflake Workspace object; no `snow streamlit deploy` was run): `docs/13_snowflake_streamlit.md`.

Also completed this pass: security re-verification (no new grants/roles since bootstrap; live RAW negative-access test re-passed), full Next.js re-validation (`tsc`/`eslint`/`next build` all clean, 7 static routes), a repo-wide claim-integrity grep (no unsupported claims found — every "AI"/"prediction"/"risk score"/"autonomous"/"live" hit is an intentional disclaimer or accurate methodology note), `docs/11_vercel_deployment.md` (prepared, not deployed — actual deployment needs the user's own Vercel authentication), and `docs/14_interview_architecture_defense.md`.

---

## CURRENT STATUS (as of the second 2026-08-16 validation pass)

**COMPLETED**
- Snowflake architecture: database, 4 schemas, 4 roles, warehouse, resource monitor — bootstrapped, live-tested (not just grant-list-read).
- Ingestion: full 17,119,590-row CFPB archive downloaded, schema-validated, profiled, loaded into `RAW.CFPB_COMPLAINTS` with 0 load errors.
- dbt: all 13 models, 55 tests (53 + 2 added this pass: `assert_daily_volume_reconciles` and a `not_null` test on the new `daily_complaint_count` column), full build clean on both `ANALYTICS_DEV` and `ANALYTICS_PROD`.
- Decisioning: 6 policies, full precedence/confidence-propagation logic, verified against real data.
- Governance: `CRI_APP_READER` boundary verified by live negative test, not just grant inspection.
- Application export: real, curated, windowed JSON committed to the repo, generated through the actual `CRI_APP_READER` role.
- Next.js application: 6 routes, `tsc`/`eslint`/`next build` all clean, verified serving real Snowflake-sourced data.
- **Snowflake-native Streamlit operations console: NOT COMPLETED — see below.**

**FIXED (this pass, 2026-08-16)**
- **Metric correctness defect** in Operations Overview's "Complaint volume by product": was summing `issue_volume_current` (a trailing 7-day rolling-window sum) across every date in the export window, inflating displayed volume by up to ~8x (measured: "Credit reporting" showed 26,794,984 against a true 3,331,441). Root cause and fix: `int_issue_trends.sql` already computed the true, non-overlapping per-date count internally but never exposed it; added `daily_complaint_count` to its output, propagated through `fct_issue_daily_metrics` and into `operations_overview_metrics`'s `complaint_volume` metric. No change was needed in the Next.js app — its existing summation logic was already correct; only the dbt-layer input was wrong. New test `assert_daily_volume_reconciles.sql` proves the corrected field sums to the true complaint count. Verified against live data post-fix: exact match across every product checked.
- Landing page's hardcoded `"17.1M"` — now reads `source_total_records` from `export_meta.json`, itself populated from the ingestion pipeline's own retrieval-reconciliation record. No new Snowflake query introduced.
- `dbt/README.md`'s stale "not yet implemented" status line and its DAG diagram, which omitted two real edges (`int_resolution_signals` → `int_issue_trends`; `agent_case_context` → `fct_complaints` and `resolution_action_queue` directly).
- Two confirmed-dead macro stub files (`dbt/macros/normalize_boolean.sql`, `generate_surrogate_key.sql`) — verified zero call sites anywhere in the project, then removed.
- Investigation page's product×issue deduplication mechanism — now documented inline (most-recent-complaint-per-pair, depends on export sort order), not redesigned.

**VALIDATED**
- dbt: targeted `dbt build --select "int_issue_trends+" "assert_daily_volume_reconciles"` — 35/35 pass on both `dev` and `prod`, including the new reconciliation test. Priority, confidence, reason-code, and CRITICAL-combination logic all re-verified unchanged (identical row counts and test results to the pre-fix build, since only a new column was added — no existing decisioning column was touched).
- Application lineage: every page's data source traced to a Snowflake object and dbt model; no hardcoded metric, narrative exposure, or unsupported claim found beyond the two items fixed above.
- Next.js production build: `tsc --noEmit` clean, `eslint .` clean, `next build` succeeds, production server verified rendering the corrected figures (landing page dynamic stat, Operations Overview showing the true 3,331,441 rather than the old 26,794,984).
- **Streamlit console: NOT validated — confirmed not to exist.** See `docs/13_snowflake_streamlit.md`, created this pass, which records the approved design and exactly what would be required to build it. `SHOW STREAMLITS IN ACCOUNT` was queried directly; the one object present is an unrelated personal Snowflake Workspaces artifact, not part of this project.

**REMAINING (as understood at the end of this second pass — see the third-pass section above for what changed since)**
- Build the Streamlit console (approved design exists; zero implementation exists) — a genuinely new-work item, not validation.
- Visual/UX design pass — functional, accessible HTML exists; no design system applied.
- Vercel deployment — not deployed; `docs/11_vercel_deployment.md` does not exist yet.
- Decision needed: enable Snowflake credentials as GitHub Actions secrets (to turn on the currently-disabled dbt CI `build` job) — deferred pending explicit approval, not attempted.
- PR #3 remains open, unmerged, by explicit instruction.

---

## 1. Product

**Name:** Customer Resolution Intelligence
**One sentence:** Converts the public CFPB Consumer Complaint Database into governed issue context, emerging-pattern signals, explainable priority, and recommended action — a portfolio prototype, not a live product.
**Positioning:** *"A trusted decision layer for customer-issue operations."*
**Core flow:** `Customer signal → Context → Pattern → Priority → Action` (verbatim from `docs/00_project_charter.md` §1 and used consistently everywhere in the repo — do not shorten to "Signal → ..." without updating every doc and the app).

**Intended users** (from `docs/00_project_charter.md` §4): support operations leader, complaint-resolution manager, human support agent, AI-agent/orchestration team, product/CX leader.

**What it does:** ingests CFPB complaint records → applies 6 deterministic policies → produces a priority + action + reason codes + confidence + evidence for every complaint record, plus aggregate operational metrics, surfaced through a Next.js demo app.

**What it explicitly does NOT do** (repeated consistently across charter, requirements, provenance, and app copy):
- Not complaint-management software, not a complaint-resolution *prediction* engine, not a credit/underwriting/fraud/eligibility/regulatory decision system.
- Not a consumer scoring system, not a company ranking.
- Does not measure or imply response/resolution duration (the source has no company response timestamp — this is the single most load-bearing constraint in the whole project).
- Does not use complaint narratives (excluded structurally, not just as an MVP choice — see §9 discovery notes and ADR-002).
- Does not claim a live Twilio, CFPB, or financial-institution integration.
- Does not identify, profile, or contact individual consumers.

---

## 2. Current status

**Branch:** `feature/full-pipeline-and-app` (confirmed via `git branch --show-current`, Aug 16, 2026). **This is NOT `main`.**
**`main`:** clean, but does **not** contain the pipeline/app work — all of it lives on this feature branch.
**PR #3** (`feature/full-pipeline-and-app` → `main`): **OPEN, not merged.** CI green (parse, governance, disclosure, type/lint/build). **Do not merge without explicit approval** — standing instruction as of this document's creation.
**Working tree:** clean, nothing uncommitted (verified same session).

**Complete and verified against real data:**
- Full CFPB archive (17,119,590 rows) downloaded, profiled, loaded into Snowflake `RAW.CFPB_COMPLAINTS`.
- All 13 dbt models built successfully against both `ANALYTICS_DEV` and `ANALYTICS_PROD`: `dbt build` → 66 PASS, 3 expected WARN (documented source anomalies), 0 ERROR.
- Demo export generated through the real `CRI_APP_READER` role boundary (not simulated).
- Next.js app: `tsc --noEmit` clean, `eslint .` clean, `next build` succeeds (6 static routes), verified serving real complaint IDs from the real export.

**In progress / not started:**
- Visual/UX design pass (functional HTML exists; no design system applied yet).
- Vercel deployment (not deployed; `docs/11_vercel_deployment.md` does not exist yet).
- README still describes the project as "Phase 0 — documentation only" — **this is stale and factually wrong**, see §10.

**Full phase-by-phase status:** `docs/10_build_plan.md`.

---

## 3. Architecture (as actually implemented)

```text
CFPB bulk CSV archive (files.consumerfinance.gov/ccdb/complaints.csv.zip)
        │  scripts/download_cfpb_data.py, validate_source_schema.py, profile_source_data.py
        ▼
scripts/split_and_stage.py  →  18 row-aligned gzip chunks  →  @CFPB_STAGE/chunks/
        │  scripts/load_to_snowflake.py renders snowflake/02_load/load_cfpb_data.sql
        ▼
Snowflake  CUSTOMER_RESOLUTION_INTELLIGENCE.RAW.CFPB_COMPLAINTS   (17,119,590 rows, all VARCHAR)
        │  dbt (staging → intermediate → marts, 13 models)
        ▼
Snowflake  CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD  (6 mart tables)
        │  scripts/export_demo_data.py, queried AS role CRI_APP_READER
        ▼
app/src/data/*.json  (committed, curated, windowed — NOT the full 17M rows)
        │  server-only fs read (app/src/lib/demo-data.ts)
        ▼
Next.js 16 app (app/)  →  (not yet deployed)  →  Vercel
```

**The browser never touches Snowflake.** The app reads static JSON committed to the repo. There is no server-side query-on-demand path implemented — the export is a build-time/pre-deploy step, not a runtime API route. (A future server-side Snowflake-query architecture is a documented *option*, not implemented — see `docs/05_architecture.md` §7 and this document §12.)

---

## 4. Snowflake (confirmed by reading `snowflake/*.sql` directly)

| Object | Name | Notes |
|---|---|---|
| Database | `CUSTOMER_RESOLUTION_INTELLIGENCE` | |
| Schemas | `RAW`, `ANALYTICS_DEV`, `ANALYTICS_PROD`, `GOVERNANCE` | `PUBLIC` dropped at bootstrap |
| Warehouse | `CRI_TRANSFORM_WH` | X-Small, `AUTO_SUSPEND=60`, `INITIALLY_SUSPENDED=TRUE` |
| Resource monitor | `CRI_MONITOR` | 25 credits/month, suspends at 100% |
| Roles | `CRI_ADMIN`, `CRI_LOADER`, `CRI_TRANSFORMER`, `CRI_APP_READER` | Roll up to `SYSADMIN` |
| Raw table | `RAW.CFPB_COMPLAINTS` | 16 source cols (VARCHAR) + 7 load-metadata cols |
| File format | `RAW.CFPB_CSV_FORMAT` | `NULL_IF=('')`, `EMPTY_FIELD_AS_NULL=TRUE`, does **not** normalize literal `"None"` — that's staging's job |
| Stage | `RAW.CFPB_STAGE` | Internal, SSE-encrypted; holds chunk files under `/chunks/` |

**`CRI_APP_READER` grants:** `USAGE` on database, `USAGE` on `ANALYTICS_PROD`, `SELECT` on all current + future tables/views in `ANALYTICS_PROD` only. **No grant of any kind on `RAW`** — this is the enforced app-read boundary. See §9.1 for why a grant list alone doesn't prove this.

**Known Snowflake-specific discoveries:** secondary-role privilege behavior (§9.1) and large-file COPY behavior (§9.2) — both below.

---

## 5. dbt (confirmed by reading every model file directly, Aug 16 2026)

**Project name:** `customer_resolution_intelligence`, profile `customer_resolution_intelligence`, dbt `>=1.8,<2.0`, `dbt_utils >=1.3,<2.0`.

**Layering — verified by extracting every actual `ref()` call from every model file, not by trusting the ASCII diagram in `dbt/README.md`:**

```text
stg_cfpb_complaints (view)
  ├── dim_issue_taxonomy (table)
  └── int_complaint_status_context (view)
        ├── int_issue_daily_volume → int_issue_trends
        ├── int_company_issue_patterns
        └── int_resolution_signals ◄── also reads int_issue_trends directly
              └── int_priority_policy_application
                    ├── fct_complaints (table) ◄── also reads dim_issue_taxonomy
                    │     └── fct_issue_daily_metrics (table) ◄── actually reads int_issue_trends, not fct_complaints
                    ├── resolution_action_queue (table) ◄── also reads int_resolution_signals
                    │     └── operations_overview_metrics (table) ◄── also reads fct_issue_daily_metrics
                    └── agent_case_context (table) ◄── ALSO reads fct_complaints AND resolution_action_queue directly
```

**Discrepancy from `dbt/README.md`'s own diagram:** that file's simplified tree omits two real edges — `int_resolution_signals` depends on `int_issue_trends` (not only `int_complaint_status_context`), and `agent_case_context` depends directly on `fct_complaints` and `resolution_action_queue` (not only transitively through `int_priority_policy_application`, as the tree-shaped drawing implies). The set of models and the overall staging→intermediate→marts layering are correct in both diagrams; only these two edges are missing from the simplified version. Confirmed by grepping every `{{ ref(...) }}` call in `dbt/models/` on 2026-08-16 — see the edge list above.

**Materialization:** staging + intermediate = views; all marts = tables. No incremental models (not justified by volume yet, per `dbt_project.yml` comment).

**Tests:** 55 total (53 + 2 added 2026-08-16 with the metric-correctness fix). Source-level `not_null`/`unique` on `RAW`; 3 source columns intentionally `severity: warn` (documented measured exceptions, not oversights — see §9.3). Mart-level `unique`/`not_null`/`accepted_values`/`relationships`, including a new `not_null` on `fct_issue_daily_metrics.daily_complaint_count`. Five custom singular tests, all genuinely policy- or correctness-specific (not filler): `assert_no_critical_without_trigger`, `assert_reason_code_required`, `assert_no_response_duration_claim` (schema-shape check against `INFORMATION_SCHEMA`), `assert_dropped_row_count_bounded`, and `assert_daily_volume_reconciles` (proves `daily_complaint_count` sums to the true complaint count per product×issue — see §9.6).

**Seeds:** `priority_policy_thresholds.csv` (6 policy rows), `resolution_action_playbook.csv` (action-domain reference), `accepted_values.csv` (domain values for every enum-like field, including the note that `timely_response_status = UNKNOWN` is currently unreachable).

**Macros:** `safe_divide.sql` is real and used (division-by-null/zero guard in `int_issue_trends.sql`). `normalize_boolean.sql` and `generate_surrogate_key.sql` were empty, never-called stub files — confirmed zero call sites anywhere in the project (surrogate keys are actually generated via the `dbt_utils.generate_surrogate_key` package macro), then **removed 2026-08-16**.

**Final models feeding the application** (only these two are read by `export_demo_data.py`): `agent_case_context`, `operations_overview_metrics`.

---

## 6. Application

**Framework:** Next.js 16 (bumped from 15 — the pinned 15.x chain carried 3 high-severity CVEs in `postcss`/`sharp`; `npm audit` now reports 0). React 19. No UI framework/component library — hand-rolled CSS in `app/src/app/globals.css`.

**Routes (all confirmed present and building):**

| Route | File |
|---|---|
| `/` | `app/src/app/page.tsx` |
| `/demo/operations` | `app/src/app/demo/operations/page.tsx` |
| `/demo/investigation` | `app/src/app/demo/investigation/page.tsx` |
| `/demo/context` | `app/src/app/demo/context/page.tsx` |
| `/methodology` | `app/src/app/methodology/page.tsx` |
| `/assessment` | `app/src/app/assessment/page.tsx` + `AssessmentForm.tsx` (client component) |

**Components:** `components/common/StatusBadge.tsx` (`PriorityBadge`, `ConfidenceBadge`), `components/common/ContextNote.tsx` (4 disclosure/context-note components, text matches `docs/02_data_provenance.md` §9 verbatim). `components/{investigation,operations,agent-context}/` directories exist but are currently empty placeholders (`.gitkeep` only) — the pages above render everything inline rather than via extracted components.

**Data files (committed):** `app/src/data/agent_case_context.json` (~580KB, 300 rows), `operations_overview_metrics.json` (~3.4MB, ~16K rows), `export_meta.json` (generation metadata). All produced by `scripts/export_demo_data.py`, windowed to the trailing 180 days.

**Application data contract:** `app/src/lib/types.ts` — `ComplaintRecordContext`, `OperationsMetric`, `DemoExportMeta`. Loader: `app/src/lib/demo-data.ts`, uses `import "server-only"` + `node:fs/promises` — cannot run in the browser bundle.

**Intentionally excluded from the app data contract:** narrative text, `tags`, `zip_code`, any `consumer_disputed*` field, any response-duration figure — enforced in `export_demo_data.py` by an explicit allowlist plus a separate forbidden-substring check (`FORBIDDEN_SUBSTRINGS`), independent of whatever the SQL query happens to return.

**Current visual/design state:** functional, accessible (skip link, `:focus-visible`, semantic tables with `<caption>`/`scope`, badges never color-only), unstyled beyond base tokens. No chart library — tables only. No client-side filtering. No dedicated loading/error state components (server components; the loader fails soft to an empty array on missing files, which pages render as a plain "no records" message).

**Known UX gaps (not yet addressed):** no data visualization beyond tables; nav has no current-page indicator; mobile responsiveness is CSS-only, not device-tested; `ConfidenceBadge` reuses the priority badge's `badge-low/medium/high` CSS classes with inverted semantic meaning (works, but is a footgun for future edits); investigation page hardcodes `confidence="MEDIUM"` as a literal rather than reading it from data (currently correct by coincidence — `POLICY_EMERGING_ISSUE` is always `MEDIUM` — but fragile).

---

## 7. Data lineage — application page to source

| App page | Reads (file) | Snowflake object (`ANALYTICS_PROD`) | dbt model | Immediate upstream | Ultimate source |
|---|---|---|---|---|---|
| Landing (`/`) | `export_meta.json` | — | — | `export_demo_data.py` metadata, itself reading `data/source_retrieval_record.json` | CFPB API `_meta` reconciliation block (see `docs/02_data_provenance.md` §2.2) |
| Landing — "Records loaded" | `export_meta.json.source_total_records` — **fixed 2026-08-16, was hardcoded** | — | — | — | Same as above |
| Operations overview — action counts | `operations_overview_metrics.json`, `metric_name='action_count'` | `OPERATIONS_OVERVIEW_METRICS` | `operations_overview_metrics.sql` (`action_count_metric` CTE) | `resolution_action_queue` | `RAW.CFPB_COMPLAINTS` |
| Operations overview — emerging-signal count | same file, `metric_name='emerging_issue_count'` | same | (`emerging_metric` CTE) | `fct_issue_daily_metrics` ← `int_issue_trends` | same |
| Operations overview — **"Complaint volume by product" table** | same file, `metric_name='complaint_volume'` | same | (`volume_metric` CTE) | `fct_issue_daily_metrics.daily_complaint_count` ← `int_issue_trends` — **fixed 2026-08-16, was `issue_volume_current`** | same, now traces cleanly and reconciles exactly to the true complaint count (`assert_daily_volume_reconciles`) |
| Issue investigation | `agent_case_context.json`, deduplicated client-side to one (most-recent) record per product×issue | `AGENT_CASE_CONTEXT` | `agent_case_context.sql` | `fct_complaints`, `int_resolution_signals`, `resolution_action_queue` | `RAW.CFPB_COMPLAINTS` |
| Complaint record context | `agent_case_context.json`, first 20 rows as-exported (already sorted by `complaint_received_date DESC`) | same | same | same | same |
| Methodology | Static text only — no data file | — | — | — | n/a |
| Assessment/CTA | No data file — client-side form state only, submits nowhere | — | — | — | n/a |

**Metrics that trace cleanly:** action counts, emerging-signal count.
**Metric that does NOT trace cleanly to its displayed meaning:** "Complaint volume by product" — see §11.

---

## 8. Governance and safety

- **Access boundary:** `CRI_APP_READER` has zero grants on `RAW`, verified by a **live negative test** (`snowflake/00_bootstrap/04_verify_access_boundary.sql`), not just by reading the grant list. This distinction mattered in practice — see §9.1.
- **Role separation:** `CRI_LOADER` (writes `RAW` only) / `CRI_TRANSFORMER` (dbt, reads `RAW`, writes `ANALYTICS_*`) / `CRI_APP_READER` (reads `ANALYTICS_PROD` only) / `CRI_ADMIN` (bootstrap/grants).
- **Secrets handling:** Snowflake key-pair auth (`~/.snowflake/cri_key.p8`, outside the repo). `.env.example` at repo root correctly separates server-only vars (`SNOWFLAKE_*`) from client-safe `NEXT_PUBLIC_*` vars. No `app/.env.example` exists — only the root one. No GitHub Actions secrets configured yet (dbt CI `build` job is `if: false`, gated pending explicit approval to add them).
- **Raw-data exclusion:** confirmed via `.gitignore` (`data/*` ignored except `data/README.md`) and via `git check-ignore` on the actual downloaded archive, profile output, and retrieval record — all three ignored. No raw CFPB file is reachable from `app/`.
- **Narrative exclusion:** `consumer_complaint_narrative` never leaves `RAW`; only a derived `has_narrative` boolean propagates downstream (confirmed in `stg_cfpb_complaints.sql`).
- **Unsupported-claim restrictions:** enforced in three independent places — dbt test (`assert_no_response_duration_claim`, schema-shape check), CI grep (`dbt-ci.yml` "No duration-shaped column names" / "No dispute field references"), and app CI grep (`app-ci.yml` "No prohibited claims in UI copy", with an explicit, documented exclusion for the methodology page since its entire purpose is naming these terms in order to disclaim them).
- **CI:** `dbt-ci.yml` (parse + governance always run; `build` gated), `app-ci.yml` (type/lint/build + disclosure checks, all currently green).

---

## 9. Engineering discoveries (verified in the repository, framed as lessons)

### 9.1 Snowflake secondary-role privilege behavior

**What happened:** a live test showed `CRI_APP_READER` successfully reading a table in `RAW` despite holding no grant on `RAW` whatsoever.
**Why it mattered:** this is the project's central access-control claim — if wrong, every governance statement in this document is unverified.
**How diagnosed:** `SHOW GRANTS` confirmed no `RAW` grant existed; `CURRENT_ROLE()` confirmed the session really was `CRI_APP_READER`; the read still succeeded.
**Root cause:** Snowflake's `DEFAULT_SECONDARY_ROLES = ('ALL')` (the account default) keeps every role a user holds active alongside their primary role. The operating user also holds `ACCOUNTADMIN`, so `ACCOUNTADMIN` stayed live through `USE ROLE CRI_APP_READER`.
**Resolution:** `USE SECONDARY ROLES NONE` before testing; codified as `snowflake/00_bootstrap/04_verify_access_boundary.sql`, which is a live negative test (attempt the forbidden read, expect an error), not a grant-list read.
**Lesson:** a privilege boundary verified only by reading configuration has not been verified. Test the access, not the grant list.

### 9.2 Large-file Snowflake loading

**What happened:** COPY of the 9GB uncompressed CSV as one staged file failed partway through with a delimiter-parse error, even though the file is valid CSV.
**Diagnosed by:** a full Python `csv`-module parse (clean, all 17.1M rows) and a 50,000-row extract loaded into Snowflake (clean) — isolating the fault to Snowflake's internal parallel byte-range scan of one very large file landing inside a quoted multi-line field.
**Resolution:** `scripts/split_and_stage.py` pre-splits into 18 row-aligned gzip chunks (using Python's own `csv` module so no chunk boundary can fall inside a quoted field) before staging.
**Lesson:** a platform's documented best practice (many moderate files, not one huge file) exists for a reason discoverable only by hitting the failure mode it prevents.

### 9.3 30 malformed RFC4180 source records

**What happened:** a full-population Python profile reported zero nulls in every field. Loading the same bytes into Snowflake produced 30 rows with nulls Python never saw, split across three symptom columns (3× `complaint_id`, 6× `issue`, 21× `company_response_to_consumer`, no overlap).
**Root cause:** an unescaped literal comma inside the narrative field in those 30 rows — a genuine RFC4180 violation in CFPB's own published file. Two correct, careful parsers recovered from the same ambiguous input differently.
**Resolution:** `stg_cfpb_complaints.sql` excludes any row missing `complaint_id`, `product`, `issue`, or `complaint_received_date`; `RAW` retains all 30 rows unmodified for fidelity; `assert_dropped_row_count_bounded` fails the build if the excluded count ever exceeds 100 (measured: 30).
**Lesson:** profiling one parser's behavior on a file is not proof of what the parser that will actually load the data will do with the same bytes.

### 9.4 SQL three-valued logic bug

**What happened:** `recent_publication_lag_flag` — a boolean nothing downstream may leave unresolved — came out `NULL` for 21 rows.
**Root cause:** `false OR NULL` evaluates to `NULL` in SQL, not `false`. Those 21 rows are exactly the ones with a null `company_response` from §9.3.
**Resolution:** `coalesce(company_response = 'In progress', false)` in `stg_cfpb_complaints.sql`; `data_completeness_status` also extended to mark these rows `PARTIAL` rather than silently `COMPLETE`.
**Lesson:** derived booleans need to be checked against real null-bearing data, not just the happy path — a concrete, reproducible example of why.

### 9.5 Historical-backtest interpretation issue

**What happened:** the first unfiltered demo export was 68MB/8.6MB — `fct_issue_daily_metrics` computes trend status for *every* historical date since 2011, so an unwindowed export was the full 15-year archive, not a demo of "now."
**Why it mattered beyond file size:** presenting it unfiltered would have shown 15.5% of all complaints ever recorded as `HIGH`/`INVESTIGATE_PATTERN` and implied that described *today's* queue, when it describes a 15-year backtest.
**Resolution:** both exports windowed to the same trailing 180 days; documented explicitly in `docs/09_supported_vs_unsupported_metrics.md` §4.1 as a labeled distinction, not just a size fix.
**Lesson:** a metric can be numerically correct and still misrepresent what question it answers if its time scope isn't stated.

### 9.6 Rolling-window metric double-counted one layer above where it was computed

**What happened:** the Operations Overview page's "Complaint volume by product" table summed `fct_issue_daily_metrics.issue_volume_current` — itself already a trailing 7-day rolling-window count at each `(date, product, issue)` row — across every date and issue in the 180-day export, with no adjustment for the overlap. The caption read "Complaint volume by product, last N days," implying a simple count; the number actually displayed was a sum of many overlapping 7-day windows.
**How found:** tracing the metric from UI back through the dbt DAG during an audit, not caught earlier because the inflated number still looked plausible on screen.
**Measured severity:** for "Credit reporting or other personal consumer reports," the buggy figure was 26,794,984 against a true 180-day count of 3,331,441 — roughly 8x inflation, consistent with a ~7-day rolling window summed across ~180 overlapping daily rows.
**Root cause:** `int_issue_trends.sql` already computed the correct, non-overlapping per-date count internally (in its `windowed` CTE, as `complaint_count`) — it just never carried that column through to the model's final output, so nothing downstream could reach it.
**Resolution (2026-08-16):** added `daily_complaint_count` to `int_issue_trends.sql`'s output, propagated it through `fct_issue_daily_metrics` into `operations_overview_metrics`, and repointed the `complaint_volume` metric to it. `issue_volume_current` and every rolling-window field are untouched and remain correct for their actual purpose (trend baseline/qualification, used by the Investigation page and `agent_case_context`). New test `assert_daily_volume_reconciles.sql` proves `SUM(daily_complaint_count)` per product×issue equals the true complaint count. No Next.js code changed — the app's existing summation was already the right operation, applied to the wrong input.
**Lesson:** a metric that traces cleanly through correct, tested dbt models can still be misused one layer higher, at the point an already-aggregated value gets aggregated again. The fix belongs at the layer that knows the semantic difference (dbt), not at the layer that was merely summing what it was given (the app) — moving the fix into React would have hidden the same bug behind a differently-shaped mistake.

---

## 10. Known limitations

**Technical:** no incremental dbt models yet (full-refresh only; not yet justified by volume). No server-side query API — the app reads a static, pre-generated export, so "live" numbers require re-running `export_demo_data.py` manually. Snowflake-native Streamlit console is an approved design with zero implementation — see `docs/13_snowflake_streamlit.md`.

**Source-data (CFPB):** no company response timestamp exists (structural, not a gap — see `docs/06_known_limitations.md` §2). No dispute field (removed from CFPB exports June 2026). No denominator for company-level rates. ~81% category concentration in credit-reporting. Recent records (last ~60 days) are structurally incomplete (`recent_publication_lag_flag`). 30 rows with parser-shift corruption (§9.3).

**Analytical:** `signal_confidence` is qualitative, not a statistical measure — no p-values or intervals are computed anywhere. Emerging-issue detection is a 15-year backtest unless explicitly windowed (§9.5) — the app now windows it, but any new dbt-level consumer of `fct_issue_daily_metrics` must do the same.

**Product:** no individual consumer risk scoring, no company ranking, no narrative use, no autonomous messaging, no financial decisioning — all structural exclusions, not roadmap gaps to eventually fill (see §11).

**Deployment:** not deployed to Vercel. `docs/11_vercel_deployment.md` does not exist yet. dbt CI `build` job disabled pending a decision on Snowflake GitHub Actions secrets. Contact form has no backend (`CONTACT_FORM_ENDPOINT` unset by design — submission is client-side-only and says so).

**Future roadmap (deferred, not started, require their own approval to begin):** narrative analysis (conditional on re-verified source availability), organization-authorized private data connectors, Twilio/CRM/ticketing integration, closed-loop action-outcome measurement, multi-tenant RBAC.

---

## 11. Non-negotiable constraints

Future sessions (and this one) **must not**, without explicit owner approval:

- Merge PR #3, or any PR, without being asked.
- Deploy to Vercel.
- Modify Snowflake credentials, production secrets, or GitHub Actions secrets.
- Introduce raw CFPB data into Git (the `.gitignore` rules exist for this — do not weaken them).
- Add complaint narratives to the MVP in any form (ingestion, NLP, sentiment, LLM processing).
- Reintroduce any response-duration, resolution-duration, or "days to respond" measure — the source has no company response timestamp; this is structural, not a missing feature.
- Claim resolution prediction, or reintroduce a dispute signal (the field doesn't exist).
- Build a real contact-form backend without being asked — the current honest, client-side-only form is a deliberate choice, not an oversight.
- Claim a live Twilio integration.
- Build individual customer risk scoring, autonomous messaging, or financial decisioning.
- Replace the curated-export architecture with direct browser-to-Snowflake access.
- Introduce Tailwind or another CSS framework without a compelling architectural reason — extend the existing hand-rolled CSS in `app/src/app/globals.css`.
- Rebuild, replace, or unnecessarily refactor the existing Snowflake/dbt/ingestion/decisioning architecture. It is substantially complete and verified; changes should be surgical and justified.

---

## 12. Current next steps (recommended sequence, not yet started)

1. Complete the read-only lineage/data-contract/governance audit (this document plus the accompanying audit report).
2. Get explicit approval on audit findings, ranked MUST/SHOULD/DEFER/DO NOT DO — including the §9.6/§7 "Complaint volume by product" metric issue.
3. Only after approval: visual/product polish (extend existing CSS, no framework swap), Vercel-readiness verification and `docs/11_vercel_deployment.md`, README rewrite, final verification pass.
4. Vercel deployment itself remains a separate, explicitly-approved step at the end — not implied by any of the above.

---

## 13. How future sessions should use this file

Before continuing work: **read this file and `docs/10_build_plan.md` first.** Then inspect the actual code/configuration relevant to the requested change — this document is a map, not a substitute for reading the territory.

**Treat the repository and current implementation as authoritative over stale assumptions**, including assumptions in older docs (`dbt/README.md` currently still says "Status: not yet implemented," which is wrong — the code is the truth, not that line).

**If context is missing, do not reconstruct the architecture from memory.** Read this document first, then verify against the repository — file contents change; the discipline of checking doesn't.

**This document goes stale.** It reflects the repository as of August 16, 2026, on branch `feature/full-pipeline-and-app`. Re-verify branch, PR, and build status before trusting §2 of this document specifically — everything else changes more slowly.
