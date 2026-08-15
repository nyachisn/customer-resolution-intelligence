# Resolution Intelligence — Supported vs. Unsupported Metrics

**Status:** Phase 0 — Product contract
**Owner:** Shem Nyachieo
**Version:** 1.0
**Last updated:** August 15, 2026
**Basis:** Verified source audit retrieved August 15, 2026 (`02_data_source_audit.md`, `08_source_quality_report.md`)

> This is the **binding register** of what Resolution Intelligence may and may not measure from the public CFPB dataset.
>
> **Enforcement rule:** no dbt model, curated export, API surface, UI element, README claim, or portfolio narrative may publish a metric marked **No** in this register. FR-013 requires a test asserting the export column set against this table.
>
> A metric may only move from **No** to **Yes** through a dated source verification recorded in an ADR.

---

## 1. Register

| Metric | Supported? | Evidence | MVP Decision | Caveat |
|---|---|---|---|---|
| **Complaint volume** | **Yes** | Directly observed. `complaint_id` present and unique on all 17,119,590 records; `date_received` non-null | **Build.** Core measure. `signal_confidence = HIGH` for the count itself | It is a count of *published complaints*, not of customer issues, incidents, or affected people. Publication criteria exclude referred complaints and small depository institutions |
| **Issue trends** | **Yes, qualified** | `issue` non-null (178 observed values); `date_received` non-null; deterministic windowing | **Build** with `issue_volume_current`, `baseline_volume`, `volume_change_pct`, `observed_share_pct`, `issue_pattern_status`. `signal_confidence = MEDIUM` | Legacy and current issue labels coexist and must be versioned, not merged. A change is a change in reported volume, not in customer experience |
| **Product trends** | **Yes, qualified** | `product` non-null (21 observed values) | **Build**, evaluated *within* product category | ~81% of records are credit-reporting categories. Cross-product trend comparison is dominated by concentration and is not meaningful without it being stated |
| **Channel trends** | **Yes, low information** | `submitted_via` non-null, 6 values | **Build**, low priority | 96.30% `Web`. The distribution is near-degenerate; it will rarely produce an actionable signal |
| **Consumer disputed signal** | **No** | **Field does not exist.** Discontinued as a filter November 2017; removed from CFPB exports entirely in Release 22 (June 2026). Absent from the field reference, from all 16 columns of both retrieval surfaces, and from the OpenAPI schema | **Remove.** `POLICY_DISPUTED_RESPONSE` deleted; `consumer_disputed_status` deleted from the data dictionary and from the `agent_case_context` contract | No proxy or substitute dispute signal may be constructed. This removed the project's only former `CRITICAL` trigger |
| **Published timely response signal** | **Yes, as a published category only** | `timely` non-null; values `Yes` (99.38%) / `No` (0.62%) | **Build** as `timely_response_status`. `signal_confidence = HIGH` as a *published* field | **Not a measured interval.** It is CFPB's own assessment. Must never be rendered as, converted to, or described as a duration. Near-degenerate — fires on 0.62% of records. The `UNKNOWN` domain member is currently unreachable |
| **Actual response duration** | **No** | **No company response timestamp exists.** The dataset has `date_received` and `date_sent_to_company` (the CFPB routing date) and no third date. Observed separation for modern web complaints: 23 seconds, 25 seconds, 13 minutes | **Remove.** `response_days_calendar` deleted. No replacement permitted. See ADR-004 | Any interval between the two available dates measures **CFPB routing latency**. Presenting it as company responsiveness would be a factual misrepresentation |
| **Resolution duration / time-to-resolution** | **No** | Same as above — no response or resolution timestamp of any kind | **Never build** | Prohibited in models, exports, UI, and portfolio narrative |
| **Customer satisfaction** | **No** | No satisfaction, sentiment, rating, or outcome-quality field exists in the dataset in any form | **Never build** | Complaint volume is not a satisfaction measure. Narratives — the only text that could hint at sentiment — are excluded and have ceased publication |
| **Root cause** | **No** | The dataset records consumer-selected categories, not causal analysis. No field establishes why anything occurred | **Never build** | An emerging pattern is a prompt for human investigation, never an explanation. `INVESTIGATE_PATTERN` is the correct output |
| **Customer lifetime value** | **No** | No customer identity, account, tenure, balance, revenue, or transaction data. Rows are not linkable to a person | **Never build** | Also conflicts with the charter: a public CFPB row is a complaint record, not a customer |
| **Individual customer risk** | **No** | No consumer identifier; no outcome label; no permissible basis | **Never build — prohibited** | Explicitly prohibited by `02_data_provenance.md` §11 and charter §8.2. This is a hard product boundary, not a data gap |
| **Market-wide complaint rate** | **No** | **No denominator exists.** The dataset contains no company size, customer count, account count, transaction volume, or market share | **Never build** | Any "rate" would have an invented denominator. Prevalence among all customers cannot be established. Company-to-company comparison is likewise unsupported |
| **Emerging issue detection** | **Yes, heavily qualified** | Deterministic thresholds over observed volume with a documented baseline | **Build** with all seven qualification conditions in `04_decisioning_policy.md` §8. `signal_confidence = MEDIUM`, or `LIMITED` in CFPB-flagged categories | **A percentage increase is never on its own evidence of a market incident.** Requires minimum current volume, minimum baseline volume, within-category evaluation, publication-lag check, and published `observed_share_pct`. Output is a *signal for investigation* |

---

## 2. Additional determinations

| Metric | Supported? | Evidence | MVP Decision | Caveat |
|---|---|---|---|---|
| Narrative / sentiment analysis | **No** | Narratives are opt-in (22.41% of records; 7.53% trailing twelve months), unverified by CFPB, and carry revocable consent | **Excluded from MVP.** Optional future exploration only, conditional on verified availability | No narrative ingestion, NLP, sentiment, or LLM processing in the MVP under any framing. A narrative-derived measure would describe a self-selected subset, and revocable consent makes any snapshot non-reproducible |
| Company-level pattern context | **Yes, `LIMITED` only** | `company` non-null | **Build only if it carries `signal_confidence = LIMITED`** and a denominator limitation; `int_company_issue_patterns` is under review for removal | Never a quality, risk, safety, compliance, performance, or misconduct score. Without a denominator it invites exactly the comparison the product prohibits |
| Geographic patterns (state) | **Yes, qualified** | `state` non-null on ~99.6% of records | **Build** at state level only | Requires population context. Not a measure of regional harm |
| Geographic patterns (ZIP) | **No** | ~5.7% masked; re-identification surface; no MVP requirement | **Exclude beyond raw layer** | `state` provides sufficient geography |
| Protected-group segmentation (`tags`) | **No** | Field exists but is a protected-population attribute | **Excluded as a governance decision** | Prohibited by `02_data_provenance.md` §11. Populated on only 4.62% of records |
| Response-status distribution, recent windows | **Yes, directional only** | Measured: 88.52% `In progress` in last 7 days | **Build** with mandatory `recent_publication_lag_flag` | A high `In progress` count is evidence of publication timing, **never** of poor company performance |
| Statistical significance / confidence intervals | **No** | No sampling frame, no denominator, no documented statistical methodology | **Never build** | `signal_confidence` is a **qualitative interpretation status**, not a statistical measure. Do not manufacture numerical intervals |

---

## 3. Confidence domain reference

| Value | Meaning | Register examples |
|---|---|---|
| `HIGH` | Directly observed source field | Complaint volume; published `company_response`; published `timely_response` |
| `MEDIUM` | Deterministic derived analytical signal with documented methodology | Issue trends; product trends; emerging-issue signal in an unflagged category |
| `LIMITED` | Affected by source coverage, publication lag, denominator limitations, or other known constraints | Recent response-status distributions; company-level aggregates; signals in CFPB-flagged categories |
| `NOT_SUPPORTED` | A conclusion the public data cannot defensibly establish | Response duration; satisfaction; root cause; CLV; individual risk; market-wide rate |

---

## 4. How to use this register

**Before building a model:** confirm every output column maps to a **Yes** row. A column that cannot be traced to a supported metric does not get built.

**Before exporting to the demo:** validate the export column set against this table (DQ-17, FR-013).

**Before writing UI copy or portfolio narrative:** check the claim against the Caveat column. If the caveat contradicts the sentence, rewrite the sentence.

**When a reviewer asks "why not?":** the Evidence column is the answer. Each **No** is a measured finding, not a matter of caution.

---

## 5. Register maintenance

- Re-validate whenever the source audit is re-run.
- Adding a metric requires evidence and an MVP decision recorded here before implementation.
- Moving a metric from **No** to **Yes** requires a dated source verification and an ADR.
- This register is referenced by `01_product_requirements.md` FR-013, `02_data_provenance.md` §7, `05_architecture.md` §6, and `08_source_quality_report.md` DQ-17.
