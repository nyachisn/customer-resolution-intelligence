# ADR-004 — Source validation removes response-duration measurement

**Status:** Accepted
**Date:** August 15, 2026
**Owner:** Shem Nyachieo
**Supersedes:** Response-timing assumptions in `Resolution_Intelligence_Product_and_Build_Specification.pdf` v1.0, `03_data_dictionary.md` v1.0, and `04_decisioning_policy.md` v1.0
**Related:** `02_data_source_audit.md`, `06_known_limitations.md`, `08_source_quality_report.md`, `09_supported_vs_unsupported_metrics.md`

---

## 1. Original assumption

The Phase 0 specification assumed the CFPB Consumer Complaint Database supported case-level response timing. Specifically:

- **`03_data_dictionary.md` v1.0 §5** defined a derived field `response_days_calendar` — "Calendar days from received to sent-to-company/response proxy, if available" — sourced from `int_complaint_lifecycle`.
- **`03_data_dictionary.md` v1.0 §4** described `date_sent_to_company` as a "Source lifecycle date" used for "Response timing context."
- **The PDF build specification** listed "Date received / sent to company" under "Lifecycle timing," with the handling note "derive business-day or calendar-day measures only if documented."
- **`03_data_dictionary.md` v1.0 §4** also listed `consumer_disputed` ("Consumer disputed?") as a source field and "Policy trigger candidate," and **§5** defined `consumer_disputed_status`.
- **`04_decisioning_policy.md` v1.0 §6** made `POLICY_DISPUTED_RESPONSE` the project's highest-severity rule, the only route to `CRITICAL` priority.

The underlying assumption was that a complaint record carries enough lifecycle information to characterize how a company handled it, and that a dispute signal is available as a severity trigger.

**Why the assumption was reasonable.** Most secondary documentation, tutorials, and third-party datasets describing the CFPB database still list a `Consumer disputed?` column, and the phrase "date sent to company" reads naturally as a handoff into a measurable response window.

---

## 2. Source discovery

An independent audit of the live source was performed on **August 15, 2026** against the official field reference, the release notes, the OpenAPI specification, the live search API, and the bulk CSV archive. Findings:

### 2.1 There is no company response timestamp

The published record has **exactly 16 fields**, verified against the field reference, all 16 CSV columns in both the bulk archive and the API export, and the OpenAPI `Complaint` schema. It contains two dates:

| Field | What it records |
|---|---|
| `date_received` | The date the CFPB received the complaint |
| `date_sent_to_company` | The date the CFPB **routed** the complaint to the company |

There is no third date. Nothing in the dataset records when a company received, opened, responded to, or resolved a complaint.

### 2.2 The routing date is not a proxy for anything

Observed on live records, the gap between `date_received` and `date_sent_to_company` for modern web-submitted complaints:

| `complaint_id` | Gap |
|---|---|
| 25389301 | 25 seconds |
| 24635023 | 23 seconds |
| 24539255 | 13 minutes |

`response_days_calendar` would have evaluated to approximately **zero for the majority of the dataset**, and would have measured CFPB intake automation — not company behavior.

### 2.3 `Consumer disputed?` does not exist

Per the CFPB release notes: discontinued as a filterable column in **Release 14 (November 2017)**, and **removed from exports entirely in Release 22 (June 2026)** along with `Consumer consent provided`. Confirmed absent from the field reference, from all 16 columns of both retrieval surfaces, and from the OpenAPI schema.

### 2.4 Response status is itself incomplete at the trailing edge

| Window (by `date_received`) | Share still `In progress` |
|---|---:|
| Last 7 days | 88.52% |
| 30–60 days prior | 33.94% |
| Whole database | 3.55% |

Even the categorical response field is unreliable on recent data.

---

## 3. Product impact

| Affected element | Impact |
|---|---|
| `response_days_calendar` | Not implementable; would have been actively misleading |
| `int_complaint_lifecycle` | Loses its stated purpose ("derive lifecycle/timing fields") |
| `POLICY_DISPUTED_RESPONSE` | Not implementable; trigger field does not exist |
| `CRITICAL` priority | Becomes unreachable by any single policy |
| `consumer_disputed_status` | Removed from the data dictionary and from the `agent_case_context` column contract |
| `agent_case_context` / `resolution_action_queue` | Column contracts change |
| Demo "Agent case context" view | Loses its "dispute indicator" component |
| Demo copy and portfolio narrative | Any response-speed framing becomes an unsupported claim |
| Discovery script | The question "Which response-time and resolution metrics are trusted today?" remains valid as *discovery*, but the prototype cannot demonstrate a response-time metric |

**Severity.** Had this been discovered after implementation, the product would have shipped a metric labelled as company responsiveness that in fact measured a government API's routing speed — displayed in a portfolio piece whose entire premise is data governance and defensible claims. The reputational cost of that specific error, in that specific context, would have been substantial.

---

## 4. Decision

**Resolution Intelligence will not measure, derive, store, export, or display any company response duration or resolution duration.**

Specifically:

1. **`response_days_calendar` is removed** from the specification. No replacement duration field is permitted — including a renamed "routing days" metric, which was considered and rejected (see §5).
2. **`date_sent_to_company` is documented everywhere as the CFPB routing/transmission date**, never as a company response date.
3. **The published `timely_response` field is retained** as a source-provided categorical signal (`Yes` / `No`). It is CFPB's own assessment. It must never be rendered as, converted to, or described as a duration.
4. **`POLICY_DISPUTED_RESPONSE` is removed**, along with `consumer_disputed_status` and the `CONSUMER_DISPUTED` reason code. No proxy dispute signal may be constructed.
5. **`POLICY_LATE_RESPONSE` is renamed `POLICY_UNTIMELY_RESPONSE`** and its reason code renamed `PUBLISHED_UNTIMELY_RESPONSE`, so neither can be read as a measured delay.
6. **`int_complaint_lifecycle` is renamed `int_complaint_status_context`** and derives no timing measures.
7. **`recent_publication_lag_flag` is introduced** so that incomplete response status is visible rather than silently aggregated.
8. **`signal_confidence` is introduced** across all derived signals, with `NOT_SUPPORTED` as an explicit, expressible value.
9. **`09_supported_vs_unsupported_metrics.md` becomes a binding register**, enforced by a test (FR-013).

---

## 5. Alternatives rejected

| Alternative | Why rejected |
|---|---|
| **Keep `response_days_calendar`, relabel it `cfpb_routing_days`** | Recommended in the initial audit, then rejected. Even correctly labelled, a duration column sitting in an operations product invites misreading — by a demo audience, by a downstream agent consuming `agent_case_context`, and by a future developer. The measure has no operational value: it describes CFPB automation, not the client organization's process. The cost of carrying it exceeds its worth |
| **Use `company_response = 'Untimely response'` as a duration proxy** | It is a categorical outcome, not an interval. Present on 0.19% of records. Converting a category to a number would fabricate precision |
| **Infer response time from the gap between publication and receipt** | Publication timing reflects CFPB workflow and the 15-day rule, not company behavior. This would encode publication lag as performance — the exact error `recent_publication_lag_flag` exists to prevent |
| **Reconstruct a dispute signal from `company_public_response`** | Different field, different meaning. 96.14% of its non-null values are a "chooses not to provide a public response" placeholder. Any mapping would be invented |
| **Source response timing from a third-party enriched dataset** | Would breach the single-source provenance contract, introduce unverified data into a governance-focused portfolio piece, and contradict `02_data_provenance.md` §2 |
| **Keep the fields and add a disclaimer** | Contradicts charter principle §8.1, "Explainability before sophistication," and §8.4, "No forced certainty." A disclaimer on a wrong number is still a wrong number |
| **Narrow the product to a different dataset with response timing** | Considered and rejected. The CFPB source remains fit for the product's actual purpose — issue intelligence, pattern detection, explainable priority. Response timing was an assumed capability, not a requirement any user story depends on |

---

## 6. Resulting architecture

### Data model

```text
stg_cfpb_complaints
  + null normalization (literal "None", empty string)
  + complaint_id as STRING (not integer)
  + zip_code as VARCHAR, masked values preserved unparsed
  + has_narrative derived (flag only, never narrative text)
  + recent_publication_lag_flag
  - no duration derivation
        │
        ▼
int_complaint_status_context   ← renamed from int_complaint_lifecycle
  published status context only; no timing fields
        │
        ▼
int_issue_trends
  + baseline_volume, observed_share_pct, issue_pattern_status
  + minimum baseline volume qualification
  + within-category evaluation
        │
        ▼
int_priority_policy_application
  - POLICY_DISPUTED_RESPONSE removed
  + POLICY_PUBLICATION_LAG added
  + lowest-confidence propagation
        │
        ▼
agent_case_context / resolution_action_queue
  + signal_confidence, interpretation_limitation, evidence_fields
  - consumer_disputed_status removed
```

### Decisioning

The policy set narrows from five rules to five rules of different composition: one dispute rule removed, one publication-lag rule added, one rule renamed. `CRITICAL` becomes reachable only through a documented multi-trigger seed combination, with a test asserting no `CRITICAL` without a qualified trigger.

### Governance

Three new documents carry the constraint forward: `06_known_limitations.md` (what cannot be claimed), `08_source_quality_report.md` (measured findings and 18 data-quality controls), and `09_supported_vs_unsupported_metrics.md` (the binding metric register).

### Product positioning

Unchanged in ambition, sharpened in claim. The product remains a trusted decision layer for customer-issue operations following **Customer signal → Context → Pattern → Priority → Action**. It was never positioned as a resolution-prediction engine, and this decision removes the one element that could have implied otherwise.

---

## 7. Note on the PDF specification

`Resolution_Intelligence_Product_and_Build_Specification.pdf` v1.0 is a fixed artifact and cannot be edited in place. The following statements in it are **superseded by this ADR** and by the v1.1 Markdown documents:

| PDF location | Superseded statement |
|---|---|
| §4, "Core source fields" | "Date received / sent to company → Lifecycle timing → derive business-day or calendar-day measures only if documented" |
| §4, "Core source fields" | "Company response / timely response / **disputed** → Resolution signals" |
| §6, "Decisioning policy" | Signal row "Disputed response — `consumer_disputed = Yes` — `PRIORITIZE_CASE_REVIEW` — `CONSUMER_DISPUTED`" |
| §6, "Policy configuration" | Seed line `POLICY_DISPUTED,consumer_disputed,0,equals,Yes,CRITICAL` |
| §3, "Interactive demo requirements" | "dispute indicator" as a required Agent case context component |
| §4, "Core source fields" | "Narrative → Optional Phase 2 only" — now an optional future exploration conditional on verified source availability, not a planned phase |

**The Markdown documents under `docs/` are authoritative.** When the PDF is regenerated, these corrections must be incorporated.

---

## 8. Verification

This decision should be re-validated whenever the source audit is re-run. It would be reversed only if the CFPB began publishing a company response timestamp — a change that would appear in the release notes and would require a new ADR, a new field-reference verification, and a revision of `09_supported_vs_unsupported_metrics.md`.
