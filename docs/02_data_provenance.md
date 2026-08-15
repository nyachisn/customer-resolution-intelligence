# Customer Resolution Intelligence — Data Provenance and Responsible Use

**Status:** Phase 0 — Product contract  
**Owner:** Shem Nyachieo  
**Version:** 1.1  
**Last updated:** August 15, 2026  
**Revision note:** v1.1 incorporates the verified findings of `02_data_source_audit.md` (retrieved August 15, 2026). See `adr/ADR-004-source-validation-removes-response-duration.md`.

## 1. Purpose

This document defines what data may enter Customer Resolution Intelligence, how it is classified, how it may be used, what claims can be made from it, and what must never be inferred or exposed.

## 2. Approved MVP source

### CFPB Consumer Complaint Database

**Publisher:** U.S. Consumer Financial Protection Bureau (CFPB)  
**Primary page:** https://www.consumerfinance.gov/data-research/consumer-complaints/  
**API documentation:** https://cfpb.github.io/api/ccdb/  
**Field reference (schema truth):** https://cfpb.github.io/api/ccdb/fields.html  
**Release notes (schema drift):** https://cfpb.github.io/api/ccdb/release-notes.html  
**Classification:** `REAL_PUBLIC`  
**MVP use:** Structured complaint, issue, published response status, published timeliness signal, date, company, geography, and submission-channel analysis.

The CFPB database is an **observed public complaint dataset**. It is a record of complaints that were submitted to the CFPB, forwarded to a company, and met the publication criteria. It is **not** a statistical sample of consumer experience, a census of consumer harm, or a measure of dissatisfaction.

CFPB states that complaint data it publishes is freely available for people to use, analyze, and build on. CFPB also notes that the database is not a statistical sample and that complaint volume should be interpreted in context, including company size, market share, and geography.

### 2.1 Preferred MVP ingestion method — bulk CSV archive

**The MVP ingests the official CFPB bulk CSV archive**, not the filtered API export.

**Archive URL:** https://files.consumerfinance.gov/ccdb/complaints.csv.zip

Reasons this method was selected:

| Reason | Detail |
|---|---|
| **Reproducibility** | A single dated archive is a stable, citable snapshot. A filtered API query is a moving target whose result depends on query parameters, index state, and pagination behavior. |
| **Larger historical coverage** | The archive carries the full published history (December 2011 onward) in one retrieval. |
| **Avoids filtered-export row limitations** | The API's filtered CSV export is capped at approximately 100,000 rows and fails with an opaque `HTTP 400` above that. At current intake volume this permits roughly a four-day window — it cannot perform a historical load. |
| **Stable archival ingestion** | The archive is refreshed daily at a fixed URL, requires no authentication, and needs no pagination or cursor logic. |

**Do not hard-code assumptions about API response formats.** The API surface has changed materially and with limited notice: two fields were removed from exports in June 2026, and the JSON export option was retired in July 2026. Any API use must be treated as a secondary, verification-only path.

**Permitted secondary use of the API.** The search API may be queried for aggregate reconciliation and freshness checking only — comparing total record count, `last_updated`, and `is_data_stale` from the `_meta` block against the loaded archive. It must not be the primary ingestion path.

### 2.2 Source retrieval record (required for every load)

Every retrieval must be documented with all of the following before the data is loaded:

| Attribute | Requirement | Value at last verified retrieval |
|---|---|---|
| **Publisher** | Named publishing authority | U.S. Consumer Financial Protection Bureau (CFPB) |
| **Source URL** | Exact retrieval URL | `https://files.consumerfinance.gov/ccdb/complaints.csv.zip` |
| **Retrieval date** | Date and time of retrieval, with time zone | August 15, 2026 |
| **File type** | Format and container | ZIP archive containing a single UTF-8 CSV (`complaints.csv`) |
| **Source coverage** | Date range and record count observed | 2011-12-01 through 2026-08-15; 17,119,590 published records |
| **Schema observed** | Field count and names as actually received | 16 columns; see `03_data_dictionary.md` §4 |
| **Known limitations** | Limitations material to interpretation | See `06_known_limitations.md`; at minimum: no company response timestamp, trailing-window publication lag, category concentration, narrative publication ceased |

A load that cannot populate every row of this table must not proceed.

## 3. Source facts and boundaries

### What the source supports

- Analysis of published complaint records and structured categories.
- Analysis of observed complaint volume over documented time windows.
- Analysis of product, sub-product, issue, sub-issue, channel, published company response, and published timeliness fields where present.
- Construction of transparent operational triage and pattern signals.
- Demonstration of a data model and decisioning workflow using public records.

### What the source does not support

- Identification of consumers or contact information.
- Contacting a consumer.
- A claim that public complaint records represent all customer issues or all consumer experiences.
- A claim that a complaint narrative or complaint record has been independently verified as true.
- A claim that a company is responsible for misconduct based only on complaint count or trend.
- Credit, underwriting, fraud, eligibility, legal, or regulatory decision-making.
- A claim that a recommendation was actually used by a financial institution.
- **Any measure of how long a company took to respond.** See §3.1.
- **A consumer dispute signal.** The `Consumer disputed?` field was removed from CFPB exports in June 2026 and does not exist in the current schema.
- Customer satisfaction, sentiment, or experience quality.
- Root cause, causation, or explanation of why complaints occurred.
- Prevalence of a problem among all customers of a company or in a market.
- Company-to-company performance comparison, which would require a denominator (accounts, customers, transactions) the dataset does not contain.

### 3.1 Response-time limitation (validated August 15, 2026)

The published dataset contains **two dates and no company response timestamp**:

| Field | What it actually records | What it does **not** record |
|---|---|---|
| `date_received` | The date the CFPB received the complaint | Not the date an issue occurred |
| `date_sent_to_company` | **The CFPB routing/transmission date** — when the CFPB forwarded the complaint to the company | **Not a company response date.** Not when the company acted, replied, or resolved anything. |

`date_sent_to_company` must be documented and labelled everywhere as the **CFPB routing/transmission date**.

Consequently this project must not calculate, store, export, or display response duration, resolution duration, time-to-resolution, handling time, or any interval derived from `date_received` and `date_sent_to_company`. Empirically these two dates are separated by seconds to minutes for modern web-submitted complaints, so such an interval would measure CFPB routing latency and would be actively misleading if presented as company responsiveness.

The published `timely_response` field is retained as a **source-provided categorical signal** (`Yes` / `No`). It is CFPB's published assessment, not a measured interval, and must never be rendered as, converted to, or described as a duration.

## 4. Data classifications

| Classification | Definition | Allowed in raw layer | Allowed in public demo | Example |
|---|---|---:|---:|---|
| `REAL_PUBLIC` | Officially published public data used within stated source boundaries | Yes | Curated, subject to disclosure | CFPB structured complaint fields |
| `DERIVED` | Metric, flag, classification, or recommendation calculated by this project | Yes | Yes, with methodology | Emerging issue flag, priority, reason codes |
| `REFERENCE_CONFIG` | Project-owned configuration/policy data | Yes | Yes | Action playbook, thresholds, accepted values |
| `SYNTHETIC_DEMO` | Artificial data used only for UI or non-source-supported behavior | Avoid in MVP | Only with a clear label | Generated UI-only display ID, if needed |
| `RESTRICTED` | Data not permitted in MVP or public demo | No | No | Credentials, personal data, customer CRM data, raw unapproved narrative exports |

## 5. MVP data policy

The MVP uses **structured CFPB fields only**. Complaint narratives are excluded, and no narrative ingestion, NLP, sentiment analysis, or LLM processing is built into the MVP.

Narrative analysis is an **optional future exploration**, not planned work. Before any such work could begin, all of the following must hold:

- **Verified source availability at that time**, confirmed against the live source rather than assumed from this document. Narrative coverage is partial and varies over time — approximately 22% of the database carries a published narrative, and monthly coverage in recent periods is materially lower.
- **Current CFPB publication policy permits the intended use**, verified at that time.
- A dedicated decision record.
- Updated source and risk review.
- A content-safety plan.
- A no-re-identification policy.
- A prompt/evaluation/retention plan if using an LLM.
- A human review workflow for public display.

Two structural properties make the MVP exclusion correct rather than merely cautious:

1. **Narratives are opt-in and unverified.** CFPB publishes them in the consumer's own words and does not verify their accuracy. They are not a factual record.
2. **Consent is revocable at any time.** A narrative snapshot is therefore not reproducible by design, which conflicts directly with the project's reproducibility contract.

## 6. Required raw-load metadata

Every raw ingestion run must capture:

| Field | Purpose |
|---|---|
| `source_system` | `CFPB_CONSUMER_COMPLAINT_DATABASE` |
| `source_url` | Exact official download/API URL used |
| `source_retrieved_at` | UTC timestamp when data was retrieved |
| `source_file_name` | Original file name or API extraction identifier |
| `source_snapshot_date` | Date/time represented by the extract, if known |
| `loaded_at` | UTC timestamp when loaded to Snowflake |
| `load_run_id` | Unique ID for the pipeline/load execution |
| `raw_row_hash` | Optional row-integrity/audit helper |

## 7. Public-demo field policy

### Allowed in curated demo exports

- Generated or masked display case ID.
- Date fields at an appropriate granularity.
- Product, sub-product, issue, sub-issue.
- Submitted-via channel.
- Published company response status and published timeliness signal, where relevant.
- Derived trend metrics, priority, action, policy IDs, reason codes, confidence values, limitation text, and methodology fields.
- Aggregated metrics and dashboard summaries, each carrying observed-share context.

### Excluded from MVP demo exports

- Complaint narratives.
- **`tags`** (`Older American`, `Servicemember`). This is a **protected/vulnerable-population attribute**. Including it in any decisioning input or public surface would conflict with §11 of this document and with the charter principle "Complaint records, not people." It is populated on only ~4.6% of records and carries little analytic value. It may be loaded to `RAW` for lineage completeness and must be excluded from every downstream model and export. **This exclusion is a deliberate governance decision, not an oversight.**
- **`zip_code`.** A re-identification surface with no MVP requirement. `state` already provides the geographic context the product needs. Recommend dropping after the raw layer rather than generalizing.
- **Any consumer dispute field.** None exists; no substitute may be constructed.
- Any field judged to create unnecessary re-identification or sensitive-content risk.
- Raw source file paths, credentials, or internal Snowflake metadata.
- Direct consumer identity fields, if ever encountered.
- Any unapproved private/customer-provided data.
- Any metric classified `NOT_SUPPORTED` in `09_supported_vs_unsupported_metrics.md`.

## 8. Source update and retention policy

- Start with a deliberately versioned snapshot or a bounded date window for reproducibility.
- Record the snapshot/retrieval date in the README and app footer.
- Do not overwrite raw data without a new load run ID and source retrieval metadata.
- Do not commit raw downloaded datasets to GitHub.
- Store only scripts and instructions needed to obtain the data from official CFPB sources.
- If a sample/demo extract is committed for UI testing, it must be curated, minimal, documented, and consistent with this policy.

## 9. Required attributions and disclosures

Every public artifact must include or link to:

> This portfolio prototype uses publicly available data from the CFPB Consumer Complaint Database. The prototype is an independent demonstration of data modeling and operational decisioning. It does not identify or contact consumers, make financial decisions, determine complaint outcomes, or represent an integration with CFPB, financial institutions, or Twilio.

Every aggregate trend view must include a context note:

> Published complaint volume is an observed count of complaints that met CFPB publication criteria. It is not a statistical sample of all consumer experiences, and it should be interpreted with relevant context, including company size, market share, geography, and reporting conditions. A change in complaint volume reflects a change in what was reported and published — not a measured change in customer experience, and not evidence of an incident.

Any view built on the dominant complaint categories must additionally include:

> Complaint volume in this dataset is highly concentrated: credit-reporting categories account for roughly 81% of all published records. Volume in these categories is materially affected by third-party submission behavior. In its June 24, 2026 notice on complaint-system integrity, the CFPB stated that it "cannot rely upon the consumer complaint portal data as a reliable reflection of actual market conditions" absent announced corrections, and attributed part of a 3,700% rise in credit-reporting complaints to credit repair organizations and credit clinics misusing the complaint process.

Any view presenting response-status fields over a recent window must include:

> Recently received complaints may be published before the company's response is recorded. Response-status distributions over recent windows are directional only and must not be read as company performance.

## 10. Data-quality and source-drift controls

The implementation must:

- Validate expected source columns before loading or staging, asserting the exact expected column count and names.
- Record unknown/new taxonomy values rather than dropping them silently.
- Test that `complaint_id` is present and unique in the canonical complaint model.
- Surface null rates for critical fields.
- Document transformations from raw source labels to normalized domains.
- Treat missing, delayed, or changing source fields as a modeled condition rather than a hidden error.
- Check the CFPB release-notes page on a recurring basis for schema drift. The source removed two fields with roughly two months' notice in 2026.

### 10.1 Required type and null-handling rules

These rules correct assumptions that the source itself contradicts. Each is mandatory.

| Rule | Requirement | Why |
|---|---|---|
| **`complaint_id` typing** | Treat `complaint_id` according to the **actual observed source schema**, as a **string**. Do not assume or cast to integer. | The source's own OpenAPI specification declares `integer($int64)` while the live API returns a JSON string. It is a stable public record identifier, not an arithmetic quantity. |
| **Masked ZIP values** | Values containing the character `X` (for example `XXXXX`, `064XX`) are **CFPB privacy masks, not ZIP codes**. They must never be parsed, cast, joined, geocoded, or displayed as real postal codes. `zip_code` must be stored as a variable-length string. | Approximately 5.7% of observed records carry a masked ZIP. A numeric cast would fail or silently null these rows. |
| **Literal `"None"` values** | Where a CSV export encodes missing values as the literal four-character string `None`, it must be converted to a true null at staging. It must never be permitted to become a legitimate taxonomy category, accepted value, or dimension member. | The API's CSV export writes `None` into `Company public response` and `Tags` for absent values. Loaded naively it becomes a plausible-looking category and corrupts taxonomy models and accepted-value tests. The bulk archive uses empty strings instead — both must be handled. |
| **Empty-string nulls** | Empty strings in the bulk archive must be normalized to true nulls at staging for all nullable fields. | Consistency between retrieval surfaces. |
| **Date grain** | The retrieval surface determines the date grain: the bulk archive publishes date-only values; the API publishes timestamps. The chosen surface must be declared, and grains must not be mixed. No CFPB documentation states the source time zone of API timestamps, so day-boundary logic must not assume UTC correctness. | Mixing surfaces produces inconsistent date semantics in trend models. |
| **Unknown values stay unknown** | A missing or unknown value must never be defaulted to a favorable or unfavorable state. | Charter principle §8.4, "No forced certainty." |

## 11. Prohibited use

The project must not be used to:

- Re-identify or contact a consumer.
- Create a consumer profile, credit score, fraud score, eligibility score, or behavioral prediction.
- Make a legal, regulatory, compensation, account, or adverse-action determination.
- Train a model to target or disadvantage protected or vulnerable populations, or use the `tags` field as a decisioning input.
- Publicly accuse a company of wrongdoing based solely on dataset patterns.
- Present public complaint data as private, exclusive, customer-authorized, or proprietary data.
- Present a derived interval as a company response time or resolution time.
- Describe a public complaint record as a customer, a consumer profile, or an identified person.

## 12. Future private-data onboarding principle

If a future pilot uses a company’s internal data, that data must be separately authorized and governed. It must not be mixed into the public demo environment. The future onboarding design requires a signed data-processing agreement, secure transfer method, data minimization, retention plan, access controls, and a separate data dictionary.
