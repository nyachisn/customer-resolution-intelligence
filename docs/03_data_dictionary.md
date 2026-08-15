# Customer Resolution Intelligence — Data Dictionary and Model Grain

**Status:** Phase 0 — Product contract  
**Owner:** Shem Nyachieo  
**Version:** 1.1  
**Last updated:** August 15, 2026  
**Revision note:** v1.1 replaces the expected source schema with the **verified** schema observed on August 15, 2026. Fields that do not exist have been removed. See `02_data_source_audit.md` and `adr/ADR-004-source-validation-removes-response-duration.md`.

## 1. Why model grain matters

A model’s grain states exactly what one row represents. Grain is a contract: it determines which joins are valid, which aggregations are safe, and what conclusions a model can support.

Before writing SQL, every model must have one declared grain. If a model cannot state its grain in one sentence, it is not ready to implement.

## 2. Canonical model registry

| Layer | Model | One row represents | Primary key / expected uniqueness | Primary purpose |
|---|---|---|---|---|
| Source | `src_cfpb_complaints` | 1 source record in the loaded CFPB extract | Source complaint identifier when available | Declared source relation; no transformation |
| Staging | `stg_cfpb_complaints` | 1 published CFPB complaint | `complaint_id` | Rename, cast, standardize, preserve source lineage |
| Intermediate | `int_complaint_status_context` *(renamed from `int_complaint_lifecycle`)* | 1 published complaint record | `complaint_id` | Assemble published status context and publication-lag flag. **Derives no timing or duration measures.** |
| Intermediate | `int_issue_daily_volume` | 1 calendar date × approved analysis dimensions | Composite grain key | Calculate daily complaint-volume counts |
| Intermediate | `int_issue_trends` | 1 calendar date × approved analysis dimensions × trend policy | Composite grain key + policy ID | Calculate baselines, deltas, and emerging-pattern signal inputs |
| Intermediate | `int_company_issue_patterns` | 1 calendar date × company × product × issue | Composite grain key | Bounded pattern context only. **Every row carries `signal_confidence = LIMITED` and a denominator limitation.** Never a company quality, risk, performance, or misconduct score; never ranked or sorted for comparison |
| Intermediate | `int_resolution_signals` | 1 published complaint | `complaint_id` | Attach case-level source/derived resolution signals |
| Intermediate | `int_priority_policy_application` | 1 published complaint × policy rule evaluated | `complaint_id` + `policy_id` | Preserve each policy evaluation and trigger state |
| Mart | `dim_issue_taxonomy` | 1 distinct product × sub-product × issue × sub-issue combination | Taxonomy surrogate key | Reusable taxonomy reference |
| Mart | `fct_complaints` | 1 canonical published complaint | `complaint_id` | Authoritative case fact model |
| Mart | `fct_issue_daily_metrics` | 1 calendar date × approved analysis dimensions | Composite grain key | Trusted daily operational metric layer |
| Mart | `agent_case_context` | 1 published complaint | `complaint_id` | Agent-safe factual and derived case context |
| Mart | `resolution_action_queue` | 1 published complaint × final recommendation run/version | `recommendation_id` | Action-ready operational queue |
| Mart | `operations_overview_metrics` | 1 metric date × dashboard dimension × metric name | Composite grain key | Curated aggregate display metrics |

## 3. Grain rules

- `fct_complaints` is the canonical one-row-per-complaint model. Downstream case-level marts must preserve this grain unless they explicitly state a different one.
- A policy evaluation is not the same as a final recommendation. A complaint can have multiple evaluated policies but must have one final recommendation per model run/version.
- Trend models are aggregate models. Do not join them to complaints without joining on all grain dimensions and documenting the expected cardinality.
- Company-level aggregates are context signals only. They must never be labeled a company risk, quality, safety, compliance, or misconduct score.
- If source IDs change or duplicate records appear, preserve raw facts and resolve canonical rules in documented staging/intermediate logic.

## 4. Source/staging field dictionary

This schema was **verified against the live source on August 15, 2026**, not assumed. The published record has **exactly 16 fields**. Field names differ between the bulk CSV surface and the API/JSON surface; both are recorded because the project touches both.

| Canonical field | CSV header | API JSON key | Type | Definition | Use | Notes |
|---|---|---|---|---|---|---|
| `complaint_id` | `Complaint ID` | `complaint_id` | **string** | Public identifier for a published complaint record | Canonical key | **Not an integer** — see `02_data_provenance.md` §10.1. Not a consumer ID |
| `date_received` | `Date received` | `date_received` | date | Date the CFPB received the complaint | Trend and analysis date | Date-only in bulk archive; timestamped via API. Declare the surface |
| `product` | `Product` | `product` | string | Source product category | Taxonomy and trend dimension | 21 observed values; legacy labels coexist with current ones |
| `sub_product` | `Sub-product` | `sub_product` | string, nullable | Source sub-product category | Taxonomy dimension | ~1.4% null |
| `issue` | `Issue` | `issue` | string | Source issue category | Core issue dimension | 178 observed values |
| `sub_issue` | `Sub-issue` | `sub_issue` | string, nullable | Source sub-issue category | Additional context | ~5.4% null |
| `company` | `Company` | `company` | string | Company named in the published complaint | Bounded pattern dimension only | Never a quality, risk, or performance score input |
| `state` | `State` | `state` | string, nullable | Consumer-reported state | Optional geographic context | 64 values incl. territories and `AA`/`AE`/`AP` |
| `zip_code` | `ZIP code` | `zip_code` | **string, may contain `X`** | Consumer-reported ZIP, CFPB-masked | **Raw layer only; excluded downstream** | ~5.7% masked. Never cast numeric, never geocode |
| `submitted_via` | `Submitted via` | `submitted_via` | string | Complaint intake channel | Channel context | 6 values; 96.3% `Web` |
| `date_sent_to_company` | `Date sent to company` | `date_sent_to_company` | date | **CFPB routing/transmission date — the date the CFPB forwarded the complaint to the company** | Provenance/context only | **NOT a company response date. No duration may be derived from it.** See §4.1 |
| `company_response_to_consumer` | `Company response to consumer` | **`company_response`** | string | Published company response category | Published status context | 8 values; `In progress` means unresolved at publication, not a performance signal |
| `timely_response` | `Timely response?` | **`timely`** | string `Yes`/`No` | **Published** timeliness signal as assessed by CFPB | Policy trigger | Never null. **Not a measured interval.** 99.38% `Yes` |
| `company_public_response` | `Company public response` | `company_public_response` | string, nullable | Company's optional public-facing response category | Published status context | 45.4% null; of non-null values 96.1% are the "chooses not to provide a public response" placeholder |
| `has_narrative` | *(not a CSV column)* | `has_narrative` | boolean | Whether a consumer narrative was published | Completeness flag only | **Never ingest the narrative text itself.** From the bulk archive, derive by testing narrative non-emptiness |
| `tags` | `Tags` | `tags` | string, nullable | `Older American` / `Servicemember` | **Raw layer only; excluded downstream** | **Protected-population attribute.** Governance exclusion — see `02_data_provenance.md` §7 |
| `complaint_what_happened` | `Consumer complaint narrative` | `complaint_what_happened` | string | Consumer narrative text | **EXCLUDED — not loaded beyond raw** | Publication effectively ceased in 2026 |
| `source_system` | Derived constant | — | string | Publisher/source identifier | Lineage | `CFPB_CONSUMER_COMPLAINT_DATABASE` |
| `source_url` | Load metadata | — | string | Exact retrieval URL | Lineage | Required |
| `source_retrieved_at` | Load metadata | — | timestamp | Retrieval timestamp | Lineage | Required |
| `source_file_name` | Load metadata | — | string | Archive/member file name | Lineage | Required |
| `source_snapshot_date` | Load metadata | — | date | Date represented by the extract | Lineage | Required |
| `loaded_at` | Load metadata | — | timestamp | Snowflake load timestamp | Freshness/audit | Required |
| `load_run_id` | Load metadata | — | string | Pipeline execution ID | Audit | Required |

### 4.1 Fields removed from this specification

| Removed field | Former spec role | Reason for removal |
|---|---|---|
| `consumer_disputed` / `Consumer disputed?` | Source field; "Policy trigger candidate" | **The field does not exist.** Discontinued as a filter in November 2017 and removed from CFPB exports entirely in Release 22 (June 2026). Absent from the field reference, from all 16 columns of both the bulk archive and the API export, and from the OpenAPI schema. No substitute may be constructed. |
| `consumer_consent_provided` | Implied by narrative-consent handling | Also removed from exports in Release 22 (June 2026). Consent state is now only indirectly observable via `has_narrative`. |
| *A company response date* | Implied by `response_days_calendar` | **No such field has ever existed** in the public dataset. The only lifecycle dates are `date_received` and the CFPB routing date. |

### 4.2 Date semantics — mandatory reading

`date_sent_to_company` is the **CFPB routing/transmission date**. It records when the CFPB forwarded the complaint to the company. It does not record when the company received it, opened it, responded, or resolved it.

For modern web-submitted complaints, `date_sent_to_company` is separated from `date_received` by **seconds to minutes**. Any interval computed between them measures CFPB routing latency. Presenting that interval as company responsiveness would be a factual misrepresentation.

**No model, column, metric, export, or UI element may derive a duration from these two dates.**

## 5. Derived field dictionary

| Field | Model(s) | Type | Definition | Rules / caveats |
|---|---|---|---|---|
| `complaint_received_date` | `stg_cfpb_complaints` | date | Standardized `date_received` | Source date only; no inferred values |
| `cfpb_routing_date` | `stg_cfpb_complaints` | date | Standardized `date_sent_to_company`, explicitly named for what it is | **Context only. No duration may be derived from it.** |
| `issue_volume_current` | `int_issue_trends`, case marts | integer | Observed complaint count in the configured current window for the trend grain | Window boundaries must be documented. An observed count, not a rate |
| `baseline_volume` | `int_issue_trends` | integer/decimal | Reference observed volume used for comparison | Document whether preceding fixed window or rolling baseline |
| `volume_change_pct` | `int_issue_trends` | decimal | Change vs. documented baseline | Safe-divide behavior must be explicit. **A change in reported volume, not a change in customer experience** |
| `observed_share_pct` | `int_issue_trends`, case marts | decimal | This grain's share of all observed complaints in the same window | **Required alongside `volume_change_pct`.** Prevents a large percentage change on a tiny base from reading as significant |
| `emerging_issue_flag` | `int_issue_trends`, case marts | boolean | True if the configured emerging-pattern threshold and qualification conditions are met | Signal for investigation. Never a confirmed incident, cause, or market event |
| `issue_pattern_status` | `int_issue_trends`, case marts | enum | `QUALIFIED_SIGNAL`, `UNQUALIFIED_SIGNAL`, `INSUFFICIENT_BASELINE`, `NO_SIGNAL` | An unqualified signal must not be displayed as an emerging issue |
| `recent_publication_lag_flag` | staging/intermediate, all case and trend marts | boolean | True when `date_received` falls within the **trailing 60 days** of `source_snapshot_date`, or `company_response = 'In progress'` at any age. Window is seed-configured — see `04_decisioning_policy.md` §9.1 | **Any response-status metric aggregating flagged records is directional only.** A high count of flagged records is evidence of publication lag, never of poor company performance |
| `signal_confidence` | all derived signals, case and action marts | enum | `HIGH`, `MEDIUM`, `LIMITED`, `NOT_SUPPORTED` | Qualitative interpretation status. **Not a statistical confidence measure.** See `01_product_requirements.md` §5.1 |
| `interpretation_limitation` | case and action marts, trend marts | string, nullable | Written limitation applying to this signal | Required when `signal_confidence = LIMITED` or `recent_publication_lag_flag` is true |
| `timely_response_status` | staging/intermediate | enum | Normalized `YES`, `NO`, `UNKNOWN` from the **published** timeliness signal | Never coerce unknown to no. **`UNKNOWN` is currently unreachable** — the source has no null or third value. **Not a duration** |
| `priority` | `resolution_action_queue` | enum | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` operational attention level | Determined only by policy rules |
| `recommended_action` | `resolution_action_queue` | enum | Approved operational action | See `04_decisioning_policy.md` |
| `reason_codes` | case/action marts | array/string | Machine-readable reasons for recommendation | At least one required for non-standard action |
| `policy_ids` | case/action marts | array/string | Policies evaluated/triggered | Must reference seed configuration |
| `context_summary` | `agent_case_context` | string | Deterministic template summary of factual/derived fields | No generative text in MVP |
| `data_completeness_status` | case/action marts | enum | `COMPLETE`, `PARTIAL`, `INSUFFICIENT` | Drives human-review handling. `PARTIAL` when `recent_publication_lag_flag` is true |
| `generated_at` | final marts | timestamp | Model generation timestamp | Required for audit |

### 5.1 Derived fields removed in v1.1

| Removed field | Reason |
|---|---|
| `response_days_calendar` | **The source provides no company response timestamp.** The field would have measured CFPB routing latency while being labelled company responsiveness. No replacement duration field is permitted. |
| `consumer_disputed_status` | Its source field does not exist. |
| `issue_volume_7d` / `issue_volume_30d` / `baseline_volume_30d` | Replaced by window-agnostic `issue_volume_current` and `baseline_volume`, so the window is a documented seed parameter rather than a hard-coded field name. |

## 6. Final mart contracts

### `agent_case_context`

**Grain:** 1 row = 1 published complaint record.  
**Purpose:** Provide a compact, agent-safe view of the complaint record’s structured source context, derived pattern signals, policy evaluation outcomes, confidence, and constraints.

Minimum columns:

```text
complaint_id
complaint_received_date
product
sub_product
issue
sub_issue
submitted_via
company_response_to_consumer
timely_response_status
has_narrative
company_public_response
issue_volume_current
baseline_volume
volume_change_pct
observed_share_pct
emerging_issue_flag
issue_pattern_status
recent_publication_lag_flag
data_completeness_status
signal_confidence
interpretation_limitation
priority
recommended_action
reason_codes
policy_ids
context_summary
generated_at
```

**Removed from this contract in v1.1:** `consumer_disputed_status` (source field does not exist).

### `resolution_action_queue`

**Grain:** 1 row = 1 published complaint record × final recommendation run/version.  
**Purpose:** Provide a prioritized, auditable action queue for a hypothetical service operation.

Minimum columns:

```text
recommendation_id
complaint_id
priority
recommended_action
reason_codes
policy_ids
evidence_fields
human_review_required
issue_pattern_status
recent_publication_lag_flag
data_completeness_status
signal_confidence
interpretation_limitation
source_snapshot_date
policy_version
model_version
generated_at
```

## 7. Data dictionary maintenance rules

- Update this document before introducing a new model or a new decision-critical field.
- Add an ADR when a field changes a product boundary, policy, or safety assumption.
- Use dbt YAML descriptions as the executable companion to this document; they must not contradict this document.
- If source schema changes, update the source mapping, tests, and this dictionary in the same pull request.
