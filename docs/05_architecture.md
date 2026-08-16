# Customer Resolution Intelligence — Architecture

**Status:** Phase 0 — Product contract  
**Owner:** Shem Nyachieo  
**Version:** 1.1  
**Last updated:** August 15, 2026  
**Revision note:** v1.1 fixes the ingestion path to the bulk CSV archive and revises the DAG to remove duration derivation. See `adr/ADR-004-source-validation-removes-response-duration.md`.

## 1. Architecture objective

Build a clean, reproducible, portfolio-grade analytical product that separates source ingestion, transformations, policy configuration, curated product outputs, and web presentation.

The architecture must make it easy to answer:

- Where did this data come from?
- What does this table/model represent?
- Which policy created this recommendation?
- What is real public data versus derived data?
- What can the Vercel application access?
- How can a future developer reproduce the build safely?

## 2. High-level architecture

```text
Official CFPB bulk CSV archive (primary)
  complaints.csv.zip
          │   (search API used only for
          │    aggregate reconciliation)
          ▼
Ingestion script + schema validation
          │
          ▼
Snowflake RAW schema
          │
          ▼
dbt staging → intermediate → marts
          │
          ├── Governance seeds / policy configuration
          │
          ▼
Curated demo export or protected server-side API
          │
          ▼
Next.js / Vercel portfolio application
          │
          ▼
Operations overview · issue investigation · agent context · methodology
```

## 3. System boundaries

### In the MVP

- CFPB public structured data.
- Snowflake storage and SQL execution.
- dbt transformation, testing, documentation, and lineage.
- Version-controlled policy seeds.
- Curated demo data for a Vercel application.
- GitHub source control and CI.

### Outside the MVP boundary

- Bank/fintech CRM data.
- Consumer identifiers, contact points, accounts, and transaction data.
- Production ticketing, contact-center, CDP, or Twilio integration.
- Customer communications.
- Complaint narratives, narrative ingestion, NLP, sentiment analysis, and LLM processing.
- Multi-tenant authentication or a production SaaS tenant model.
- **Any response-duration or resolution-duration measure.** The source publishes no company response timestamp.
- The `tags` and `zip_code` fields beyond the raw layer.

## 4. Snowflake architecture

### Database and schemas

```text
CUSTOMER_RESOLUTION_INTELLIGENCE
├── RAW
│   └── Immutable source-aligned public CFPB loads + load metadata
├── ANALYTICS_DEV
│   └── dbt development target
├── ANALYTICS_PROD
│   └── dbt production-style final models and curated outputs
└── GOVERNANCE
    └── Optional policy/reference tables, run metadata, and data-quality logs
```

### Warehouse

```text
CRI_TRANSFORM_WH
```

Requirements:

- Smallest practical initial size.
- Auto-suspend enabled.
- Auto-resume enabled only if needed for development convenience.
- Resource monitor or documented cost-control approach.
- Query tags for raw load, dbt transformation, and demo export where feasible.

### Roles

| Role | Responsibilities | Restrictions |
|---|---|---|
| `CRI_ADMIN` | Bootstrap and grant administration | Not used for routine transformations |
| `CRI_LOADER` | Stage/load approved public source data into `RAW` | No write access to final marts unless needed for metadata |
| `CRI_TRANSFORMER` | Run dbt transformations in dev/prod schemas | No account-level admin grants |
| `CRI_APP_READER` | Read curated demo surface only | No access to raw tables or credentials in client app |

### Required metadata/tags

Apply where practical:

```text
owner = shem_nyachieo
project = customer_resolution_intelligence
environment = dev | prod
data_classification = real_public | derived | reference_config
source_system = cfpb
```

## 5. dbt architecture

### Project layout

```text
dbt/
├── dbt_project.yml
├── packages.yml
├── profiles.example.yml
├── macros/
├── models/
│   ├── staging/cfpb/
│   ├── intermediate/
│   └── marts/
│       ├── core/
│       ├── operations/
│       └── agent_context/
├── seeds/
├── tests/
├── analyses/
└── README.md
```

### Layer responsibilities

| Layer | Responsibility | Allowed logic |
|---|---|---|
| Source | Declare raw tables and freshness | No transformation |
| Staging | Rename, cast, clean whitespace, normalize source values, add source/load metadata | One-to-one source shaping; no complex business rules |
| Intermediate | Reusable joins, lifecycle calculations, rolling volumes, policy-evaluation inputs | Explicit multi-step business logic with documented grain |
| Mart | Consumer-facing, trusted business products | Final metrics, context, action queue, application outputs |
| Seed | Version-controlled configuration | Policies, thresholds, action playbooks, accepted-value mappings |

### Initial DAG

```text
src_cfpb_complaints
        │
        ▼
stg_cfpb_complaints
        │  (null normalization, type fixes,
        │   recent_publication_lag_flag)
        ├────────────────────────────┐
        ▼                            ▼
int_complaint_status_context   dim_issue_taxonomy
        │
        ├──────────────┐
        ▼              ▼
int_issue_daily_volume  int_resolution_signals
        │              │
        ▼              │
int_issue_trends        │
        │              │
        └──────┬───────┘
               ▼
int_priority_policy_application
               │
       ┌───────┼───────────────┐
       ▼       ▼               ▼
fct_complaints agent_case_context resolution_action_queue
       │                                │
       ▼                                ▼
fct_issue_daily_metrics         operations_overview_metrics
```

### DAG changes required by source validation

These are documented here for implementation later. **No SQL is to be written yet.**

| Model | Change | Reason |
|---|---|---|
| `int_complaint_lifecycle` | **Rename** to `int_complaint_status_context`; remove all timing/duration derivation | "Lifecycle" implied durations the source cannot support |
| `stg_cfpb_complaints` | **Revise** — add null normalization (`None`, empty string), string `complaint_id`, masked-ZIP handling, `recent_publication_lag_flag`, `has_narrative` | Verified source behavior |
| `int_issue_trends` | **Revise** — add `observed_share_pct`, `baseline_volume`, `issue_pattern_status`, minimum baseline volume, within-category evaluation | Concentration and baseline qualification |
| `int_resolution_signals` | **Revise** — remove any duration input; carry `signal_confidence` | Response-time limitation |
| `int_priority_policy_application` | **Revise** — remove dispute policy evaluation; add publication-lag policy; implement lowest-confidence propagation | Policy changes |
| `agent_case_context` | **Revise** — column contract updated per `03_data_dictionary.md` §6 | Field removals and additions |
| `resolution_action_queue` | **Revise** — add `evidence_fields`, `signal_confidence`, `interpretation_limitation`, `recent_publication_lag_flag`, `policy_version` | Recommendation contract |
| `int_company_issue_patterns` | **Retained, constrained.** Must hard-code `signal_confidence = LIMITED` and a non-null denominator limitation on every row; must never rank, sort by, or compare companies | Revisit after the first build — remove if it cannot earn its place under these constraints |
| *(any duration model)* | **Must not be created** | No company response timestamp exists |

## 6. Data flow and controls

### Ingestion flow

1. Retrieve the **official CFPB bulk CSV archive** (`complaints.csv.zip`). Do not use the filtered API export as the primary path — it is capped at roughly 100,000 rows and fails opaquely above that.
2. Complete the **source retrieval record** in `02_data_provenance.md` §2.2: publisher, source URL, retrieval date, file type, source coverage, schema observed, known limitations. A load that cannot populate every field must not proceed.
3. Validate the expected schema before loading, asserting the exact expected column count and names. Treat any change as source drift requiring documentation review, not a transient error.
4. Load source-aligned fields into `RAW` without business transformations.
5. Reconcile against the search API `_meta` block — total record count, `last_updated`, `is_data_stale` — as an independent freshness check.
6. Run dbt source freshness/schema checks.
7. Build staging through final marts.
8. Run dbt tests and generate docs.
9. Export only approved curated fields for the product demo, validated against `09_supported_vs_unsupported_metrics.md`.

**Do not hard-code assumptions about API response formats.** The API surface has changed materially and with limited notice — two fields removed in June 2026, JSON export retired in July 2026.

### No raw data in Git

GitHub contains:

- Ingestion scripts.
- Data contracts and schema expectations.
- DDL and dbt code.
- Curated tiny UI fixtures only if reviewed and documented.

GitHub does not contain:

- Full source downloads. **Note:** a 1.4 GB `complaints.csv.zip` currently sits in the project working directory. It must be covered by `.gitignore` before the repository is initialized.
- Credentials, private keys, profiles, `.env` values, or Snowflake account details.
- Complaint narratives.

## 7. Application architecture

### Recommended application stack

- Next.js with TypeScript.
- Vercel for preview and production deployment.
- Accessible UI components and lightweight charts.
- Static curated demo JSON/CSV for MVP, or a server-side protected API route.

### Secondary roles will defeat the access boundary

Snowflake defaults users to `DEFAULT_SECONDARY_ROLES = ('ALL')`. With that set, **every role granted to the user stays active alongside the primary role**, and the session's privileges are the union of all of them. `USE ROLE CRI_APP_READER` does not drop `ACCOUNTADMIN` if the user holds it — the primary role becomes decorative.

This was observed during the initial bootstrap on August 15, 2026: `CRI_APP_READER` successfully read a table in `RAW` while holding **no grant of any kind** on `RAW`. The grants were correct. The session was the problem.

Consequences for this project:

| Context | Requirement |
|---|---|
| Verifying the boundary | Always `USE SECONDARY ROLES NONE` first. `snowflake/00_bootstrap/04_verify_access_boundary.sql` does this — the line is load-bearing, not decoration |
| Any future application service user | Create it with `DEFAULT_SECONDARY_ROLES = ()`, and grant it **only** `CRI_APP_READER`. Never grant it a role that also carries broader access |
| Reading a grant list | A `SHOW GRANTS` output is necessary but **not sufficient** evidence that a boundary holds. Test the boundary by attempting the access |

The general lesson is worth stating plainly, because it generalizes past Snowflake: a privilege boundary that has only been verified by reading configuration has not been verified.

### Data-access rule

The browser must never connect directly to Snowflake. The application may consume:

1. A versioned, curated demo export placed in the application’s safe data directory; or
2. A server-only API route using a least-privilege read path.

The app must not expose:

- Snowflake account details.
- Private keys or passwords.
- Raw table names/paths that invite direct browsing.
- Source records beyond the reviewed demo contract.

## 8. GitHub and delivery architecture

### Repository

```text
customer-resolution-intelligence/
├── docs/
├── snowflake/
├── dbt/
├── scripts/
├── app/
├── data/README.md
└── .github/workflows/
```

### Branch strategy

- `main`: protected, deployable portfolio state.
- `feature/<short-description>`: focused work branch.
- Pull request required for all substantive changes.
- One concern per pull request: docs, Snowflake, a dbt model group, policy change, export, or UI feature.

### CI requirements

| Workflow | Trigger | Minimum checks |
|---|---|---|
| `dbt-ci.yml` | Pull request affecting `dbt/` or `docs/` | `dbt deps`, parse, selected build/tests, schema/YAML validation |
| `app-ci.yml` | Pull request affecting `app/` | Type check, lint, test/build, Vercel preview where configured |
| Documentation check | Pull request affecting models/policies | Model header/YAML/docs update expected; manual review gate |

## 9. SQL and code conventions

### SQL file header

Every material dbt model and standalone Snowflake script must begin with:

```sql
-- model/script: <file name>
-- purpose: <why this exists>
-- grain: <what one row represents>
-- inputs: <sources/refs/seeds>
-- outputs: <downstream consumers>
-- owner: Shem Nyachieo
-- data classification: REAL_PUBLIC | DERIVED | REFERENCE_CONFIG
-- limitations: <known analytical limits>
-- decision record: <link to relevant ADR, if any>
```

### Naming conventions

| Object | Convention | Example |
|---|---|---|
| Source | `src_<system>_<entity>` | `src_cfpb_complaints` |
| Staging model | `stg_<system>_<entity>` | `stg_cfpb_complaints` |
| Intermediate model | `int_<concept>` | `int_issue_trends` |
| Dimension | `dim_<entity>` | `dim_issue_taxonomy` |
| Fact | `fct_<event/entity>` | `fct_complaints` |
| Final product mart | clear noun phrase | `agent_case_context` |
| Seed | lower snake case | `priority_policy_thresholds.csv` |
| Test | `test_<assertion>` | `test_nonstandard_action_has_reason` |

## 10. Observability and auditability

At a minimum, record:

- Source retrieval/load timestamps.
- Load run ID.
- dbt run/artifact metadata.
- Source schema-validation results.
- Model generation timestamp.
- Policy version/configuration reference.
- Curated export version.

A reviewer should be able to trace a final recommendation back to:

```text
recommendation → policy IDs/reason codes → derived signals → canonical complaint → raw source/load metadata
```

## 11. Architecture decisions requiring ADRs

Create an ADR for any change to:

- Source datasets or source usage terms.
- Narrative/LLM use.
- Model grain of a final mart.
- Action or priority domain.
- Policy threshold/precedence with material product impact.
- Private-data onboarding.
- Public demo field exposure.
- Direct application-to-warehouse connectivity.
- Ingestion mechanism (bulk archive versus API).
- The supported/unsupported metric register.

### Existing decision records

| ADR | Subject |
|---|---|
| `ADR-001-use-cfpb-public-data.md` | CFPB public data as the sole MVP source |
| `ADR-002-exclude-narratives-from-mvp.md` | Narrative exclusion — opt-in, unverified, revocable consent |
| `ADR-003-no-individual-risk-score.md` | No consumer scoring or consumer-level inference |
| `ADR-004-source-validation-removes-response-duration.md` | Removal of response-duration measurement following source validation |
| `ADR-005-bulk-csv-as-primary-ingestion.md` | Bulk CSV archive over the row-capped API export |

## 12. Phase 0 architecture acceptance checklist

Before implementation, confirm:

- [ ] Raw, derived, reference, synthetic, and restricted data classifications are understood.
- [ ] All final marts have declared grain.
- [ ] The browser will not access Snowflake directly.
- [ ] Raw downloads will not be committed to Git, and `complaints.csv.zip` is in `.gitignore`.
- [ ] Policy seeds are version-controlled and documented.
- [ ] dbt model layering is agreed.
- [ ] Source and recommendation lineage are explicit.
- [ ] The app’s public disclosure and methodology pages are part of the MVP.
- [ ] No model, column, metric, or UI element derives a duration from `date_received` and `date_sent_to_company`.
- [ ] `date_sent_to_company` is labelled as the CFPB routing/transmission date everywhere it appears.
- [ ] The source retrieval record is complete for the loaded snapshot.
- [ ] Null normalization covers literal `None`, empty strings, and masked ZIP values.
- [ ] `recent_publication_lag_flag` and `signal_confidence` are implemented before any trend surface is published.
- [ ] Every export column is checked against `09_supported_vs_unsupported_metrics.md`.

## 13. Architectural judgment — what was deliberately not built, and why

**Status of this section:** written 2026-08-16, after the pipeline was fully built and verified against the real 17.1M-row archive. The engineering foundation is substantially complete; this section exists to make the *reasoning* behind the architecture's boundaries as visible as the architecture itself — a governed data product should be able to explain its restraint, not only its capability.

**Two governed paths out of the same analytical layer:**

```text
                              CFPB source
                                   │
                                   ▼
                            Snowflake RAW
                                   │  dbt (sole transformation engine)
                                   ▼
                            ANALYTICS_PROD
                                   │  CRI_APP_READER (read-only, no RAW access)
                        ┌──────────┴──────────┐
                        ▼                     ▼
              Curated application       Snowflake-native
              export (JSON, windowed,    Streamlit console
              committed to Git)         (approved design,
                        │                NOT YET BUILT —
                        ▼                see docs/13)
                Next.js → Vercel
              (primary product experience)
```

Both paths read the same governed `ANALYTICS_PROD` tables through the same `CRI_APP_READER` role. Neither path reads `RAW`, and neither reimplements decisioning logic — `dbt` is the only place a priority, an action, or a confidence value is computed. A Streamlit console would be an *internal operational view* onto the same governed data, not a second product and not a second source of truth.

**Why RAW is never exposed to any application surface.** `RAW.CFPB_COMPLAINTS` holds unmodified source columns, including the narrative text and the `tags` protected-attribute field, retained there only for lineage fidelity (`docs/02_data_provenance.md` §7, §10). `CRI_APP_READER` holds no grant of any kind on `RAW` — confirmed by a live negative-test query, not just by reading the grant list (`snowflake/00_bootstrap/04_verify_access_boundary.sql`; see `docs/12_project_context.md` §9.1 for why that distinction mattered in practice).

**Why credentials never reach the browser.** The application reads a static, curated JSON export committed to the repository (`app/src/data/*.json`), generated by a script that runs server-side/pre-deploy and authenticates as `CRI_APP_READER`. There is no runtime Snowflake connection anywhere in `app/` — confirmed by grep, not assumed (`app-ci.yml`'s "No credentials in client-side code" check).

**Why no second warehouse.** `CRI_TRANSFORM_WH` (X-Small, `AUTO_SUSPEND=60`, one cluster, `CRI_MONITOR` capping spend at 25 credits/month) handles the entire batch — ingestion COPY, dbt build, and the export query — comfortably within its capacity. A second warehouse would separate workloads that don't compete for capacity in the first place; it would add cost-monitoring surface area without solving a measured problem.

**Why no Streams, Tasks, or Dynamic Tables.** These exist to react incrementally to continuously arriving data. The source is CFPB's own daily batch file — there is no continuous arrival to react to, and dbt's full-refresh batch model already matches the source's own update cadence exactly. Adding incremental-processing infrastructure here would demonstrate the *feature*, not solve a *problem the source has*; the honest architectural call is to not add it until measured volume or a genuinely streaming source justifies it (this is already the stated policy in `dbt_project.yml`'s materialization comment).

**Why no Cortex or other AI/LLM feature.** The product's central discipline is that every priority, action, and confidence value is deterministic and traceable to a documented policy rule (`docs/04_decisioning_policy.md`) — an LLM-derived signal would be neither. It would also create pressure toward using complaint narratives, which are structurally excluded from this project on grounds independent of any feature decision (opt-in, unverified by CFPB, revocable consent — `docs/06_known_limitations.md` §6, ADR-002). Deferring Cortex isn't a capability gap; it's the same explainability boundary that shapes the rest of the project.

**Why no masking policies or row-access policies for this MVP.** Snowflake's masking/row-access features exist to restrict *which* authenticated principals see *which* rows of otherwise-shared data — a real need once multiple tenants or sensitivity tiers share one table. This project's actual boundary is coarser and already fully enforced by role/schema separation: `CRI_APP_READER` cannot reach `RAW` at all, and every application-facing mart has already had narratives, `tags`, and `zip_code` excluded at the dbt layer before the data ever reaches a queryable table. Adding masking policies on top of that would be securing a door that's already welded shut — appropriate for a future multi-tenant design (`docs/02_data_provenance.md` §12), not for the current single-surface boundary.

**Why the curated-export pattern, not a live server-side Snowflake query.** The current architecture (`export_demo_data.py` → committed JSON → Next.js reads via `server-only` fs access) is simpler, has zero runtime Snowflake dependency, and costs nothing per page view. A server-side API route that queries Snowflake on demand is a **documented future option**, not a demonstrated need: it would only be justified once the product requires data fresher than a manual/scheduled export cadence provides. Implementing it now would replace a working, simpler pattern with a more operationally complex one to solve a problem that hasn't materialized.
