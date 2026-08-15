# Customer Resolution Intelligence — Data Source Audit (CFPB Consumer Complaint Database)

**Status:** Phase 0 — Independent source verification
**Owner:** Shem Nyachieo
**Auditor role:** Data engineering research assistant
**Version:** 1.0
**Retrieval date:** August 15, 2026
**Source snapshot metadata at retrieval:** `last_updated` / `last_indexed` = `2026-08-15T12:00:00-05:00`; `total_record_count` = **17,119,590**; `is_data_stale` = `false`; `has_data_issue` = `false`; `license` = `CC0`

> **Purpose.** This document records what the CFPB Consumer Complaint Database *actually* publishes as of the retrieval date, verified independently against live official endpoints and current official documentation. It does **not** assume the schema described in `03_data_dictionary.md` is correct. Where the specification and the source disagree, the source wins and the discrepancy is recorded here.
>
> **Scope limits observed.** No SQL was written. No dbt models were created. No product architecture was modified. No existing project file was modified.

---

## 1. Method

Findings were established three ways, and each finding below states which:

| Method | What it means |
|---|---|
| **[DOC]** | Read from current official CFPB documentation |
| **[API]** | Observed directly from live official API responses on 2026-08-15 |
| **[FILE]** | Observed directly from the official bulk download file on 2026-08-15 |

Live verification included: the search API root and aggregations, `sort=created_date_asc` / `created_date_desc` boundary probes, monthly narrative-share aggregations, filtered CSV export probes at several window sizes, and a ranged read of the header and first ~193,000 rows of the official bulk CSV archive.

---

## 2. Official source links

| Resource | URL | Status at retrieval |
|---|---|---|
| Primary landing page | https://www.consumerfinance.gov/data-research/consumer-complaints/ | Live |
| Search UI | https://www.consumerfinance.gov/data-research/consumer-complaints/search/ | Live |
| API overview | https://cfpb.github.io/api/ccdb/ | Live |
| **Field reference (authoritative field list)** | https://cfpb.github.io/api/ccdb/fields.html | Live |
| **Release notes (authoritative change log)** | https://cfpb.github.io/api/ccdb/release-notes.html | Live |
| OpenAPI 3.0 spec (Swagger UI) | https://cfpb.github.io/ccdb5-api/documentation/ | Live; upstream repo notes docs "are not being updated at this time" |
| API base URL | `https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/` | Live |
| **Bulk CSV archive** | https://files.consumerfinance.gov/ccdb/complaints.csv.zip | Live; `Last-Modified: 2026-08-15`, 1,415,011,387 bytes |
| Bulk JSON archive | https://files.consumerfinance.gov/ccdb/complaints.json.zip | Live but **stale**: `Last-Modified: 2026-08-13` |
| Data-use / privacy policy | https://www.consumerfinance.gov/complaint/data-use/ | Live |
| June 2026 complaint-system reform notice | https://www.consumerfinance.gov/about-us/newsroom/the-cfpb-is-correcting-flaws-to-restore-integrity-and-utility-to-the-consumer-complaint-system/ | Live; dated 2026-06-24 |

**Correction to `02_data_provenance.md` §2:** the documented API URL `https://cfpb.github.io/api/ccdb/` is correct and current. No change needed. The *field reference* and *release notes* sub-pages should be added, because they are where schema truth and schema drift are actually published.

---

## 3. Retrieval mechanism (audit question 1)

Three official mechanisms exist. They are **not equivalent**, and the differences matter for ingestion design.

### 3.1 Bulk CSV archive — recommended primary

- `https://files.consumerfinance.gov/ccdb/complaints.csv.zip` **[FILE]**
- Full database, single member file `complaints.csv`, deflate-compressed, ~1.41 GB compressed.
- Refreshed daily (observed `Last-Modified` same day as retrieval).
- No authentication, no API key, no observed rate limit.
- **Rows are not ordered by date.** The first data rows observed were `2023-04-21`, `2023-07-13`, `2023-06-27`; row ~192,820 was `2026-06-16`. Do not assume file order carries any date semantics.

### 3.2 Filtered CSV export via API — usable only for small windows

- `.../api/v1/?format=csv&date_received_min=…&date_received_max=…` **[API]**
- **Hard row cap confirmed.** Release 23 (July 2026) limits filtered exports to 100,000 complaints **[DOC]**. Verified empirically:

| Window requested | Approx. matching rows | Result |
|---|---:|---|
| 2026-08-10 → 2026-08-16 | 61,744 | **HTTP 200**, 18.2 MB CSV |
| 2026-08-01 → 2026-08-16 | ~222,600 | **HTTP 400**, body literally `size` |

- At the current intake rate (~21,000 complaints/day), this mechanism supports windows of roughly **four days or fewer**. It cannot perform a full historical load.
- **JSON export was retired** in Release 23 (July 2026) **[DOC]**. The `format=json` export path should not be designed against.

### 3.3 Search API (JSON) — recommended for aggregates and reconciliation

- `GET .../api/v1/` — search; `GET .../api/v1/{complaintId}`; `GET .../api/v1/trends`; `GET .../api/v1/geo/states`; typeahead `_suggest*` endpoints **[DOC]**
- Returns an OpenSearch-shaped envelope: `hits.hits[]._source`, `aggregations`, `_meta`.
- Deep pagination requires `search_after` seeded from `_meta.break_points`, not simple offsets **[DOC]**.
- No authentication and no documented rate limit observed. Treat rate limits as undocumented rather than absent.

**Recommendation:** ingest the **bulk CSV archive** as the reproducible snapshot; use the **search API `_meta` block and aggregations** as an independent reconciliation and freshness check (row count, `last_updated`, `is_data_stale`, `has_data_issue`). This satisfies `02_data_provenance.md` §6 and §10 without depending on the capped export path.

---

## 4. Verified current schema (audit questions 2 and 3)

**The published record has exactly 16 fields.** Field names differ between the bulk/CSV surface and the API/JSON surface. Both are given, because the project will touch both.

| # | CSV header **[FILE]** | API JSON key **[API]** | Documented type **[DOC]** | Observed type **[API/FILE]** | Notes |
|---:|---|---|---|---|---|
| 1 | `Date received` | `date_received` | date & time | **CSV: `YYYY-MM-DD`. API: ISO-8601 with `Z`** | Grain differs by mechanism — see §7.1 |
| 2 | `Product` | `product` | plain text | string | 21 distinct values observed |
| 3 | `Sub-product` | `sub_product` | plain text | string, nullable | |
| 4 | `Issue` | `issue` | plain text | string | 178 distinct values observed |
| 5 | `Sub-issue` | `sub_issue` | plain text | string, nullable | |
| 6 | `Consumer complaint narrative` | `complaint_what_happened` | plain text | string, usually empty | See §6 |
| 7 | `Company public response` | `company_public_response` | plain text | string, nullable | Omitted from our spec — see §8.2 |
| 8 | `Company` | `company` | plain text | string | |
| 9 | `State` | `state` | plain text | string, nullable | 64 values incl. territories, `AA`/`AE`/`AP` |
| 10 | `ZIP code` | `zip_code` | plain text | **string containing `X` characters** | Never numeric — see §7.4 |
| 11 | `Tags` | `tags` | plain text | string, mostly null | Sensitive — see §8.3 |
| 12 | `Submitted via` | `submitted_via` | plain text | string | 6 distinct values |
| 13 | `Date sent to company` | `date_sent_to_company` | date & time | same split as field 1 | See §7.1, §7.5 |
| 14 | `Company response to consumer` | **`company_response`** | plain text | string | **Name differs by surface** |
| 15 | `Timely response?` | **`timely`** | yes/no | string `Yes`/`No` | **Name differs by surface** |
| 16 | `Complaint ID` | `complaint_id` | number | **CSV: digits. API: JSON string** | See §7.3 |

Additional key present **only** in the API JSON payload, not in the CSV:

| API JSON key | Type | Notes |
|---|---|---|
| `has_narrative` | boolean **[API]** | Not a CSV column. Strongly recommended addition — see §8.1 |

**There is no seventeenth field.** No consumer identifier, no company response date, no dispute field, no consent field.

---

## 5. Date coverage (audit question 4)

- **Earliest published complaint [API]:** `date_received` = `2011-12-01`, `complaint_id` = `2046` (Credit card, Bank of America). Confirms the documented December 2011 start.
- **Latest published complaint [API]:** `date_received` = `2026-08-15` (same-day), `complaint_id` = `25389301`.
- **Total published records [API]:** 17,119,590.
- **Coverage is continuous** from December 2011 to the retrieval date, with categories phased in over time (mortgages Dec 2011; credit reporting Oct 2012; debt collection Jul 2013; payday Nov 2013; virtual currency Aug 2014; federal student loans Feb 2016) **[DOC]**.

**Trailing-edge warning.** The most recent weeks are structurally incomplete, not merely sparse. See §7.5.

---

## 6. Narrative availability (audit question 5) — **material change**

Narratives exist as a field and are populated historically, but **publication has effectively stopped during 2026.**

Verified narrative share by month of `date_received` **[API]**:

| Month | Published complaints | With narrative | Share |
|---|---:|---:|---:|
| 2026-01 | 547,505 | 22,242 | 4.06% |
| 2026-02 | 504,034 | 12,506 | 2.48% |
| 2026-03 | 640,608 | 22,492 | 3.51% |
| 2026-04 | 642,980 | 21,413 | 3.33% |
| 2026-05 | 642,091 | 17,940 | 2.79% |
| 2026-06 | 648,544 | 10,567 | 1.63% |
| 2026-07 | 712,025 | 2,793 | 0.39% |
| **2026-08 (to 08-15)** | **222,603** | **0** | **0.00%** |

- Whole-database narrative share **[API]**: 3,837,184 of 17,119,590 = **22.41%**.
- Trailing twelve months: 508,488 of 6,754,522 = **7.53%**.
- Narratives remain present in the bulk CSV for historical records, redacted in the documented style (`XX/XX/2023`, `{$14000.00}`, `XXXX`) **[FILE]**.
- Press reporting (American Banker / Asset Securitization Report) states the CFPB will stop publishing narratives, citing one-sidedness. **I could not confirm this in a primary CFPB source**; the June 24, 2026 reform notice does not state it. **The observed zero-narrative month is direct evidence consistent with that reporting, and should be treated as the operative planning assumption pending owner confirmation.**

**Implication for the project:** the MVP decision in `00_project_charter.md` §6 and `02_data_provenance.md` §5 to **exclude narratives is independently validated and is now the only defensible choice.** The Phase 2 roadmap item in `01_product_requirements.md` §10 ("Consumer narrative analysis with an LLM/NLP workflow") is at material risk of having no forward-looking data to operate on and should be re-scoped or explicitly marked as historical-only.

---

## 7. Update cadence and data quality (audit questions 6 and 7)

### 7.1 Update frequency — daily, with two caveats

- "The database generally updates daily" **[DOC]**. Confirmed: bulk CSV `Last-Modified` was the retrieval date, `_meta.last_updated` was the retrieval date, `is_data_stale` was `false`, and same-day complaints were present **[API/FILE]**.
- **Caveat A:** the bulk **JSON** archive was two days stale (2026-08-13) while the CSV was current. Prefer CSV.
- **Caveat B — date grain differs by mechanism.** The bulk CSV publishes `Date received` and `Date sent to company` as **date-only** (`2023-04-21`); the API and its CSV export publish **full timestamps** (`2026-08-14T01:17:06.000Z`) **[FILE/API]**. Verified across all 192,820 sampled bulk rows: 100% date-only. Any pipeline that mixes the two surfaces will produce inconsistent date semantics. **Pick one surface and document the choice**, per `03_data_dictionary.md` §4 note on "parsing/time-zone behavior". No CFPB documentation states the source time zone of the API timestamps; do not assume UTC-correctness for day-boundary logic.

### 7.2 Null encoding differs by mechanism — ingestion hazard

| Surface | Null representation |
|---|---|
| Bulk CSV **[FILE]** | Empty string |
| API filtered CSV export **[API]** | **Literal string `None`** |
| API JSON **[API]** | JSON `null` |

The API CSV export writes `None` into `Company public response` and `Tags` for absent values. Loaded naively, `None` becomes a legitimate-looking category value and will silently corrupt `dim_issue_taxonomy` and any accepted-values test. This must be handled explicitly at staging.

### 7.3 `complaint_id` typing is inconsistent with its own spec

- OpenAPI declares `complaint_id` as `integer($int64)` **[DOC]**.
- The live API returns it as a **JSON string** (`"25389301"`) **[API]**.
- The CSV emits bare digits **[FILE]**; all 192,820 sampled values were digit-only.

**Treat `complaint_id` as a string key.** Do not cast to integer. It is a stable public record identifier, not an arithmetic quantity, and the source's own contract disagrees with the source's own behavior.

### 7.4 `zip_code` is not numeric and is partially masked

- 5.66% of sampled bulk rows carried a masked ZIP containing `X` (10,917 of 192,820); 0.09% were empty **[FILE]**.
- Masked forms confirmed live: `XXXXX` (138,718 records), and 3-digit-prefix forms such as `064XX` (2,226) and `100XX` (1,655) **[API]**.
- Documented rule: full five digits when a narrative is published; three digits otherwise; omitted entirely for populations under 20,000 or non-U.S. addresses **[DOC]**.

**Must be `VARCHAR`.** Any numeric cast will fail or silently null out roughly one row in eighteen. Given §6, as narrative publication ceases the masked share will rise.

### 7.5 Response fields are severely incomplete at the trailing edge — **the most operationally significant finding**

`company_response` distribution by recency of `date_received` **[API]**:

| Window | Total | `In progress` | Share `In progress` |
|---|---:|---:|---:|
| Last 7 days | 77,532 | 68,630 | **88.52%** |
| 30–60 days prior | 666,519 | 226,214 | **33.94%** |
| ~12 months prior (Aug 2025) | 510,378 | 0 | 0.00% |
| Whole database | 17,119,590 | 607,157 | 3.55% |

The documented "published after company response or 15 days, whichever is first" rule means recent records are published **with the response outcome still unresolved**. One third of complaints are still `In progress` a full **month to two months** after receipt — considerably longer than the 15-day framing implies.

**Consequence for the product:** any policy in `04_decisioning_policy.md` that triggers on `company_response_to_consumer` will, on recent data, be reading an artifact of publication lag rather than an operational signal. `int_issue_trends` and `resolution_action_queue` must either exclude a trailing window or explicitly model `In progress` as `data_completeness_status = PARTIAL`. This aligns with the existing principle in `00_project_charter.md` §8.4 ("No forced certainty") and should be made an explicit, tested rule rather than an emergent behavior.

### 7.6 Distinct values and null behavior for intended fields

All counts **[API]**, whole database, retrieval date.

**`company_response` — 8 values, effectively non-null (21 records unaccounted, <0.001%)**

| Value | Count | Share |
|---|---:|---:|
| Closed with explanation | 10,497,408 | 61.32% |
| Closed with non-monetary relief | 5,727,071 | 33.45% |
| In progress | 607,157 | 3.55% |
| Closed with monetary relief | 215,474 | 1.26% |
| Untimely response | 31,677 | 0.19% |
| Closed without relief | 17,867 | 0.10% |
| Closed | 17,611 | 0.10% |
| Closed with relief | 5,304 | 0.03% |

Note the legacy/current split: `Closed without relief` / `Closed with relief` / `Closed` are historical labels. Normalize without collapsing source meaning, per `03_data_dictionary.md` §4.

**`timely` — 2 values, no nulls**

| Value | Count | Share |
|---|---:|---:|
| Yes | 17,013,482 | 99.38% |
| No | 106,108 | 0.62% |

The spec's `timely_response_status` domain of `YES` / `NO` / `UNKNOWN` is safe to keep, but **`UNKNOWN` will be empty** — no null or third value was observed anywhere in the database or in the 192,820-row bulk sample. A test asserting `UNKNOWN` is reachable will fail. Note also that timeliness is near-degenerate at 99.38% `Yes`; as a standalone policy trigger it will fire on 0.62% of records.

**`submitted_via` — 6 values, no nulls**

| Value | Count | Share |
|---|---:|---:|
| Web | 16,486,487 | 96.30% |
| Referral | 277,558 | 1.62% |
| Phone | 219,502 | 1.28% |
| Postal mail | 109,976 | 0.64% |
| Fax | 25,644 | 0.15% |
| Email | 423 | 0.002% |

Channel analysis is viable but heavily concentrated; "intake-channel signals" in `00_project_charter.md` §2 will be low-information in practice.

**`product` — 21 values; concentration is extreme**

| Value | Count | Share |
|---|---:|---:|
| Credit reporting or other personal consumer reports | 11,610,341 | 67.82% |
| Credit reporting, credit repair services, or other personal consumer reports *(legacy label)* | 2,163,770 | 12.64% |
| Debt collection | 1,170,675 | 6.84% |
| Mortgage | 457,181 | 2.67% |
| Checking or savings account | 387,536 | 2.26% |
| Credit card | 334,726 | 1.96% |
| Credit card or prepaid card | 206,356 | 1.21% |
| Money transfer, virtual currency, or money service | 187,589 | 1.10% |
| Credit reporting *(legacy label)* | 140,426 | 0.82% |
| Student loan | 131,915 | 0.77% |
| *(11 further values)* | — | <1% each |

Credit-reporting variants together account for roughly **81%** of the database. Several product labels are legacy versions of a current label. Taxonomy normalization is genuinely required, and `dim_issue_taxonomy` must version labels rather than merge them.

**Nullability of taxonomy and geography** (bulk sample of 192,820 rows, and whole-database aggregation where noted)

| Field | Empty in sample | Sample rate | Whole-DB signal |
|---|---:|---:|---|
| `Consumer complaint narrative` | 188,940 | 97.99% | 77.59% empty DB-wide; ~100% for 2026 |
| `Tags` | 187,580 | 97.28% | 95.38% null DB-wide |
| `Company public response` | 127,275 | 66.01% | 45.41% null DB-wide |
| `Sub-issue` | 2,635 | 1.37% | ~5.4% DB-wide (older records worse) |
| `State` | 220 | 0.11% | ~0.36% DB-wide |
| `ZIP code` | 178 | 0.09% | plus 5.66% masked |
| `Sub-product` | 1 | 0.0005% | ~1.4% DB-wide |
| `Product`, `Issue`, `Company`, `Submitted via`, `Timely response?`, `Complaint ID` | 0 | 0.00% | effectively non-null |

Whole-database null rates are derived from aggregation bucket sums against total; aggregation buckets are top-N truncated, so these are **upper-bound estimates** and should be re-measured after load rather than treated as exact.

**`company_public_response` — present but rarely informative.** Of 9,345,595 non-null values, 8,984,505 (96.14%) are the placeholder "Company has responded to the consumer and the CFPB and chooses not to provide a public response." Substantive public responses exist on only ~361,090 records — **2.11% of the database**.

---

## 8. Discrepancies against our specification

Assessed against `03_data_dictionary.md` §4/§5/§6 and `02_data_provenance.md` §2.

### 8.1 Fields in our specification that do not exist (audit question 8)

| Spec'd field | Spec location | Finding | Severity |
|---|---|---|---|
| **`consumer_disputed` / "Consumer disputed?"** | `03` §4 (source field, "Policy trigger candidate"); `03` §5 (`consumer_disputed_status`); `03` §6 (`agent_case_context` minimum columns); `02` §7 (allowed in demo exports); `00` §6 / `01` implied dispute analysis | **DOES NOT EXIST.** Absent from the field reference **[DOC]**, absent from all 16 CSV columns in both the bulk archive and the API export **[FILE/API]**, absent from the OpenAPI `Complaint` schema and from live JSON payloads **[API]**. Discontinued as a filter in Release 14 (Nov 2017) and **removed from exports entirely in Release 22 (June 2026)** **[DOC]**. | **BLOCKING** |
| **`consumer_consent_provided`** | not spec'd, but implied by narrative-consent handling in `02` §5 | Also removed from exports in Release 22 (June 2026) **[DOC]**. Consent state is now only indirectly observable via `has_narrative`. | Medium |
| **A company response *date*** | `03` §5 `response_days_calendar` ("received to sent-to-company/response proxy") | **No such field exists.** The only lifecycle dates are `date_received` and `date_sent_to_company`. There is no date on which the company responded. | **High** |

The `consumer_disputed` removal is the single largest correction required. It appears in the agent context contract, the action-queue reasoning, the demo field allowlist, and at least one intended policy trigger. Every one of those must be revised before implementation.

### 8.2 Fields that exist but whose spec'd handling is wrong

| Spec'd handling | Finding | Required change |
|---|---|---|
| `complaint_id` typed "string/integer" | OpenAPI says integer; live API returns string; CSV returns digits | Fix to **string**, explicitly. Do not cast. |
| `zip_code` typed "string" but treated as a plain postal code | Contains literal `X` masking on 5.66% of rows | Keep `VARCHAR`; add an `is_masked` derivation if used at all; see §10 |
| `timely_response` typed "string/boolean" | Only `Yes`/`No`, never null | Normalize to boolean plus explicit status enum; document that `UNKNOWN` is unreachable |
| `date_received` / `date_sent_to_company` typed "date" | Date-only in bulk CSV, timestamped in API | Declare the chosen surface; do not silently mix |
| `company_response_to_consumer` | API key is `company_response` | Map both surface names to the one canonical name |
| `timely_response` | API key is `timely` | Same |
| `response_days_calendar` derived field | For modern web complaints, `date_sent_to_company` is **seconds to minutes** after `date_received` (observed: 23s, 25s, 13m). It measures **CFPB routing latency**, not company responsiveness. | **Redefine or drop.** As specified it will produce a near-constant 0 and invite a false "fast resolution" reading — which would violate `00` §8.4 and `01` §9. |

### 8.3 Important fields we omitted (audit question 9)

| Field | Recommendation | Rationale |
|---|---|---|
| **`has_narrative`** (API only, boolean) | **ADD to MVP** | Gives narrative-consent state *without ingesting narrative text*, so it stays inside the `02` §5 structured-only boundary. Useful as a `data_completeness_status` input and as the only remaining proxy for the removed consent field. Note it is not a CSV column — deriving it from bulk CSV requires testing narrative non-emptiness. |
| **`company_public_response`** | **ADD to MVP, with a caveat** | A published, company-authored response category directly relevant to `int_resolution_signals`. But 96.14% of non-null values are the "chooses not to provide a public response" placeholder — substantive on only 2.11% of records. Model it; do not build a headline metric on it. |
| **`tags`** (`Older American`, `Servicemember`) | **EXCLUDE from decisioning and from public demo** | This is a **protected/vulnerable-population attribute**. Using it as a priority or action input would conflict directly with `02_data_provenance.md` §11 ("Train a model to target or disadvantage protected or vulnerable populations") and with `00` §8.2 ("Cases and patterns, not people"). Populated on only 4.62% of records, so it also carries little analytic value. Recommend loading to raw for lineage completeness and **excluding from every downstream model and export**, with the exclusion documented as a deliberate governance decision rather than an oversight. |
| `complaint_what_happened` (narrative) | **Correctly excluded** — keep excluded | Validated by §6. |

---

## 9. Recommended MVP field set

**Ingest to raw (all 16 published fields + API-only flag), model forward only the following.**

### 9.1 Include in staging and marts

| Canonical field | Source (CSV / API) | Type | Role |
|---|---|---|---|
| `complaint_id` | `Complaint ID` / `complaint_id` | **string** | Canonical key |
| `date_received` | `Date received` / `date_received` | date | Trend and lifecycle date |
| `product` | `Product` / `product` | string | Taxonomy, trend dimension |
| `sub_product` | `Sub-product` / `sub_product` | string, nullable | Taxonomy |
| `issue` | `Issue` / `issue` | string | Core issue dimension |
| `sub_issue` | `Sub-issue` / `sub_issue` | string, nullable | Taxonomy |
| `company` | `Company` / `company` | string | Bounded pattern context only |
| `state` | `State` / `state` | string, nullable | Optional geography |
| `submitted_via` | `Submitted via` / `submitted_via` | string | Channel context |
| `date_sent_to_company` | `Date sent to company` / `date_sent_to_company` | date | **CFPB routing date only** — relabel accordingly |
| `company_response_to_consumer` | `Company response to consumer` / `company_response` | string | Resolution status; `In progress` = incomplete |
| `timely_response` | `Timely response?` / `timely` | boolean + enum | Policy trigger (low base rate) |
| `company_public_response` | `Company public response` / `company_public_response` | string, nullable | Resolution signal, caveated |
| `has_narrative` | — / `has_narrative` | boolean | Completeness / consent proxy |
| `source_system`, `source_url`, `source_retrieved_at`, `source_file_name`, `source_snapshot_date`, `loaded_at`, `load_run_id`, `raw_row_hash` | derived | — | Lineage per `02` §6 |

### 9.2 Exclude from modeling and from public demo

| Field | Reason |
|---|---|
| `complaint_what_happened` (narrative) | `02` §5 policy; and publication has ceased (§6) |
| `tags` | Protected-population attribute; `02` §11 conflict (§8.3) |
| `zip_code` | Re-identification surface with no MVP requirement; already flagged "assess before use" in `03` §4. Recommend **dropping after raw**, not generalizing — `state` already carries the needed geography |
| `consumer_disputed`, `consumer_consent_provided` | Do not exist (§8.1) |

### 9.3 Derived fields requiring revision before implementation

| Field | Action |
|---|---|
| `consumer_disputed_status` | **Delete** from `03` §5 and from the `agent_case_context` contract in `03` §6 |
| `response_days_calendar` | **Redefine** as `cfpb_routing_days` (received → sent to company) with an explicit note that it is not company responsiveness, or drop |
| `data_completeness_status` | **Extend** so `company_response = 'In progress'` maps to `PARTIAL`, per §7.5 |
| `timely_response_status` | Keep, but document `UNKNOWN` as unreachable in current source |

---

## 10. Data-quality observations (summary)

1. **Trailing-window incompleteness is structural, not incidental.** 88.5% of the last 7 days and 33.9% of records 30–60 days old are `In progress`. Trend and action models must exclude or explicitly flag a trailing window. *(§7.5)*
2. **Null encoding is mechanism-dependent**, and the API CSV export writes the literal string `None`. Unhandled, this becomes a fake taxonomy value. *(§7.2)*
3. **Date grain is mechanism-dependent** — date-only in bulk, timestamped in API, with no documented source time zone. *(§7.1)*
4. **`complaint_id` type contradicts the source's own OpenAPI contract.** Treat as string. *(§7.3)*
5. **`zip_code` is not numeric** and is masked on 5.66% of rows. *(§7.4)*
6. **Extreme category concentration:** ~81% credit-reporting products; 96.3% `Web` channel; 99.38% `timely = Yes`. Emerging-pattern detection will be dominated by one product family unless the trend grain controls for it. *(§7.6)*
7. **Legacy and current taxonomy labels coexist** (e.g. three distinct credit-reporting product labels; `Closed with relief` vs `Closed with non-monetary relief`). Normalize with versioning, never by merging. *(§7.6)*
8. **Filtered CSV export fails hard at ~100k rows** with an opaque `HTTP 400 / size` response. Any retry logic must treat this as a window-too-large signal, not a transient error. *(§3.2)*
9. **Bulk JSON archive lags the CSV** by two days. Prefer CSV. *(§3.1)*
10. **Bulk file rows are not date-ordered.** No incremental logic may rely on file position. *(§3.1)*

---

## 11. Legal and provenance observations

1. **License.** The API asserts `"license": "CC0"` in every response `_meta` block **[API]**, and the data.gov catalog entry lists the dataset as U.S. Government public-domain data. **However**, the CFPB's own data-use page states no explicit license, attribution requirement, or accuracy disclaimer **[DOC]**. The `CC0` assertion is machine-readable metadata, not a published legal term. Cite it as such; do not represent it as a formal CFPB license grant.
2. **No personal identifiers are published.** Names, contact details, account numbers, SSNs, and supporting documents are withheld **[DOC]**. Consistent with `02` §7 — no direct identity field was encountered anywhere in the audit.
3. **Narratives are opt-in, scrubbed, and revocable.** Consumers may withdraw consent at any time **[DOC]**, meaning a narrative snapshot can become non-reproducible by design. A further reason the MVP narrative exclusion is correct.
4. **Narratives are explicitly unverified.** CFPB publishes them "in their own words" without verification **[DOC]**. Already reflected in `02` §3.
5. **ZIP truncation is population-dependent** (omitted under 20,000 residents) **[DOC]** — a re-identification control the CFPB applies at source and which we should not attempt to reverse or supplement.
6. **The publisher has publicly questioned its own data's representativeness.** In the June 24, 2026 reform notice, the CFPB states it "cannot rely upon the consumer complaint portal data as a reliable reflection of actual market conditions" absent the announced corrections, and attributes part of a 3,700% rise in credit-reporting complaints (150,000 in 2019 → over 5 million in 2025) to "credit repair organizations and credit clinics misusing the Bureau's complaint process" **[DOC]**.

   **This is the most important provenance finding in the audit.** It does not block the project, but it changes what the required disclosure must say. The context note mandated by `02` §9 currently covers sampling bias, company size, market share, and geography. It should be extended to state that **the publisher itself has identified third-party-driven volume inflation in the dominant product category**. Presenting a credit-reporting volume spike as an "emerging issue pattern" without that caveat would come close to the prohibited claim in `01` §9 ("A complaint trend proves a company caused harm").

7. **Publication criteria remain as documented:** complaints are published only after they are sent to a company and either the company responds or 15 days elapse; complaints referred to other regulators, and those about depository institutions under $10 billion in assets, are not published **[DOC]**. This bounds the population and should be stated in the methodology page required by `01` §4.1.

---

## 12. Recommendation

# **GO — WITH CHANGES**

The source is live, official, freely available, updated daily, well past the volume needed, and materially fit for the product as scoped. The project's two hardest calls — **structured fields only** and **no narratives in MVP** — are independently validated by this audit, and the narrative finding in §6 validates them more strongly than the specification anticipated.

Proceeding is contingent on the following corrections. None require an architecture change.

### Blocking — must be fixed in the documents before any SQL is written

1. **Remove `consumer_disputed` in every form.** Delete the source-field row from `03` §4, delete `consumer_disputed_status` from `03` §5, remove it from the `agent_case_context` minimum-column contract in `03` §6, remove dispute status from the demo allowlist in `02` §7, and remove any dispute-based trigger from `04_decisioning_policy.md`. The field does not exist and has not been exported since June 2026.
2. **Redefine or drop `response_days_calendar`.** As written it measures CFPB routing latency and would misrepresent company responsiveness.
3. **Correct the field-type and field-name mappings** in `03` §4 per §8.2: string `complaint_id`, `VARCHAR` masked-capable `zip_code`, dual surface names for `company_response` / `timely`, and an explicit declaration of which retrieval surface (and therefore which date grain and null encoding) the pipeline uses.

### Required before the trend and action layers are trusted

4. **Add a trailing-window rule.** Exclude or explicitly flag recent complaints where `company_response = 'In progress'`, and map that state to `data_completeness_status = PARTIAL`. Without this, `resolution_action_queue` will escalate publication lag.
5. **Control the trend grain for product concentration**, or `emerging_issue_flag` will report the credit-reporting category and little else.

### Required for governance

6. **Add `tags` to the exclusion list** in `02` §7 as a deliberate protected-attribute decision, with the reasoning recorded.
7. **Extend the §9 context note** in `02_data_provenance.md` to disclose the publisher's own June 2026 statement on complaint-volume integrity in credit reporting.

### Recommended

8. **Adopt the bulk CSV archive as the primary ingestion path**, with the API `_meta` block as an independent freshness and row-count reconciliation check. Do not design against the filtered CSV export (100k cap) or the JSON export (retired).
9. **Add `has_narrative` and `company_public_response`** to the MVP field set, with the caveats in §8.3.
10. **Re-scope the Phase 2 narrative roadmap item** in `01` §10 as historical-only, or defer it pending confirmation of CFPB narrative policy.
11. **Add the field reference and release-notes URLs** to `02` §2, and add a recurring schema-drift check against them — Release 22 removed two fields with two months' notice, and `02` §10 already requires source-drift controls.

### Open item for the owner

12. **Confirm the narrative-publication policy.** Press reporting says the CFPB will stop publishing narratives; the June 2026 primary source does not say so; the data shows zero narratives published in August 2026. This does not affect the MVP, which excludes narratives, but it determines whether Phase 2 is viable at all.

---

## 13. Audit register

| # | Question | Answer | Section |
|---:|---|---|---|
| 1 | Current source URL and mechanism | Bulk CSV zip (recommended), search API JSON, capped filtered CSV export | §2, §3 |
| 2 | Exact current field names | 16 published fields; names differ CSV vs API; plus API-only `has_narrative` | §4 |
| 3 | Field data types | Documented types thin; observed types differ from spec in 4 cases | §4, §7 |
| 4 | Current date coverage | 2011-12-01 → 2026-08-15; 17,119,590 records; trailing edge incomplete | §5, §7.5 |
| 5 | Narratives available | Historically yes (22.41%); **zero published in Aug 2026** | §6 |
| 6 | Updated daily | Yes, CSV verified same-day; JSON archive lags 2 days | §7.1 |
| 7 | Distinct values and null behavior | Full distributions and null rates captured | §7.6 |
| 8 | Spec'd fields that don't exist | `consumer_disputed` (blocking); consent field; company response date | §8.1 |
| 9 | Important fields omitted | `has_narrative`, `company_public_response` (add); `tags` (exclude, governance) | §8.3 |
| 10 | Documentation / usage caveats | Publisher questions its own data's representativeness; export caps; publication criteria; CC0 is metadata not a license term | §11 |

---

**Prepared:** August 15, 2026
**Next document to revise:** `03_data_dictionary.md` §4, §5, §6 — then `04_decisioning_policy.md` for any dispute-based rule.
**No project files were modified in producing this audit.**
