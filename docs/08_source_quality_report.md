# Customer Resolution Intelligence — Source Quality Report

**Status:** Phase 0 — Measured source assessment
**Owner:** Shem Nyachieo
**Version:** 1.0
**Last updated:** August 15, 2026
**Source retrieval date:** August 15, 2026
**Source snapshot metadata:** `last_updated` = `2026-08-15T12:00:00-05:00`; `total_record_count` = 17,119,590; `is_data_stale` = `false`; `has_data_issue` = `false`; `license` = `CC0`

> This report records **measured** source-quality findings and the data-quality controls the implementation must carry as a result. It complements `02_data_source_audit.md` (which establishes the schema) and `06_known_limitations.md` (which states what the product cannot claim).

---

## 1. Source retrieval record

| Attribute | Value |
|---|---|
| Publisher | U.S. Consumer Financial Protection Bureau (CFPB) |
| Source URL | `https://files.consumerfinance.gov/ccdb/complaints.csv.zip` |
| Retrieval date | August 15, 2026 |
| File type | ZIP archive containing one UTF-8 CSV (`complaints.csv`), ~1.41 GB compressed |
| Source coverage | 2011-12-01 through 2026-08-15; 17,119,590 published records |
| Schema observed | 16 columns (see §3) |
| Known limitations | See `06_known_limitations.md` |
| Reconciliation source | Search API `_meta` block at `.../search/api/v1/` |

**Verification method.** Findings below were established by direct observation of the live source: aggregation queries against the search API, boundary probes using `sort=created_date_asc` / `created_date_desc`, monthly narrative-share aggregations, filtered CSV export probes at several window sizes, and a ranged read of the header and first 192,820 rows of the bulk archive.

---

## 2. Freshness and availability

| Check | Result |
|---|---|
| Bulk CSV archive `Last-Modified` | 2026-08-15 — same day as retrieval |
| Search API `_meta.last_updated` | 2026-08-15T12:00:00-05:00 |
| `is_data_stale` | `false` |
| `has_data_issue` | `false` |
| Same-day records present | Yes — latest `date_received` = 2026-08-15 |
| **Bulk JSON archive `Last-Modified`** | **2026-08-13 — two days stale** |

**Finding:** the daily update cadence is confirmed for the CSV archive. The **JSON archive lags** and must not be used.

**Control:** reconcile loaded row count and `source_snapshot_date` against the API `_meta` block on every load. Fail the load if `is_data_stale` is `true` or `has_data_issue` is `true`.

---

## 3. Observed schema — 16 columns

| # | CSV header | API JSON key | Observed type |
|---:|---|---|---|
| 1 | `Date received` | `date_received` | CSV date-only; API ISO-8601 with `Z` |
| 2 | `Product` | `product` | string |
| 3 | `Sub-product` | `sub_product` | string, nullable |
| 4 | `Issue` | `issue` | string |
| 5 | `Sub-issue` | `sub_issue` | string, nullable |
| 6 | `Consumer complaint narrative` | `complaint_what_happened` | string, usually empty |
| 7 | `Company public response` | `company_public_response` | string, nullable |
| 8 | `Company` | `company` | string |
| 9 | `State` | `state` | string, nullable |
| 10 | `ZIP code` | `zip_code` | string, may contain `X` |
| 11 | `Tags` | `tags` | string, mostly null |
| 12 | `Submitted via` | `submitted_via` | string |
| 13 | `Date sent to company` | `date_sent_to_company` | as field 1 |
| 14 | `Company response to consumer` | `company_response` | string |
| 15 | `Timely response?` | `timely` | string `Yes`/`No` |
| 16 | `Complaint ID` | `complaint_id` | CSV digits; **API JSON string** |

API-only, not a CSV column: `has_narrative` (boolean).

**No seventeenth field exists.** No consumer identifier, no company response date, no dispute field, no consent field.

**Control:** schema validation must assert exactly these 16 columns by name before load. Any deviation is source drift requiring documentation review.

---

## 4. Completeness and null rates

Measured on a 192,820-row sample of the bulk archive, with whole-database aggregation figures where available.

| Field | Empty in sample | Sample rate | Whole-DB estimate |
|---|---:|---:|---|
| `Consumer complaint narrative` | 188,940 | 97.99% | 77.59% empty; ~100% for 2026 |
| `Tags` | 187,580 | 97.28% | 95.38% null |
| `Company public response` | 127,275 | 66.01% | 45.41% null |
| `Sub-issue` | 2,635 | 1.37% | ~5.4% |
| `State` | 220 | 0.11% | ~0.36% |
| `ZIP code` | 178 | 0.09% | plus 5.66% masked |
| `Sub-product` | 1 | 0.0005% | ~1.4% |
| `Product`, `Issue`, `Company`, `Submitted via`, `Timely response?`, `Complaint ID` | 0 | 0.00% | effectively non-null |

Whole-database figures derive from aggregation bucket sums against total. Aggregation buckets are top-N truncated, so these are **upper-bound estimates** and must be re-measured after load rather than treated as exact.

**Control:** surface measured null rates for all fields after every load. Alert on material change from the figures above.

---

## 5. Value domains

### `company_response` — 8 values

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

`Closed`, `Closed with relief`, and `Closed without relief` are **legacy labels**. Normalize with versioning; never merge into current labels.

### `timely` — 2 values, no nulls

| Value | Count | Share |
|---|---:|---:|
| Yes | 17,013,482 | 99.38% |
| No | 106,108 | 0.62% |

**Finding:** the `UNKNOWN` member of the specified `timely_response_status` domain is **unreachable** — no null or third value exists anywhere in the database or sample. A test asserting `UNKNOWN` is reachable will fail.

### `submitted_via` — 6 values, no nulls

| Value | Count | Share |
|---|---:|---:|
| Web | 16,486,487 | 96.30% |
| Referral | 277,558 | 1.62% |
| Phone | 219,502 | 1.28% |
| Postal mail | 109,976 | 0.64% |
| Fax | 25,644 | 0.15% |
| Email | 423 | 0.002% |

**Finding:** channel analysis is viable but low-information at 96.3% concentration.

### `tags` — 3 values, 95.38% null

`Servicemember` (503,825), `Older American` (229,958), `Older American, Servicemember` (57,990). Note the third value is a **composite string**, not a normalized multi-value field.

**Excluded from all downstream use** as a protected-population attribute.

### `company_public_response`

Of 9,345,595 non-null values, **8,984,505 (96.14%)** are the placeholder "Company has responded to the consumer and the CFPB and chooses not to provide a public response." Substantive public responses exist on ~361,090 records — **2.11% of the database**.

**Control:** model the field, but do not build a headline metric on it.

---

## 6. Category concentration

| Product | Share |
|---|---:|
| Credit reporting or other personal consumer reports | 67.82% |
| Credit reporting, credit repair services, or other personal consumer reports *(legacy)* | 12.64% |
| Debt collection | 6.84% |
| Mortgage | 2.67% |
| Checking or savings account | 2.26% |
| Credit card | 1.96% |
| *(15 further values)* | remainder |

Credit-reporting variants total **~81%**. 21 distinct product values and 178 distinct issue values were observed, with legacy and current labels coexisting.

**Control:** trend evaluation must run within product category. `observed_share_pct` must accompany every trend signal.

---

## 7. Publication lag (measured)

`company_response` distribution by recency of `date_received`:

| Window | Total | `In progress` | Share |
|---|---:|---:|---:|
| Last 7 days | 77,532 | 68,630 | **88.52%** |
| 30–60 days prior | 666,519 | 226,214 | **33.94%** |
| ~12 months prior | 510,378 | 0 | 0.00% |
| Whole database | 17,119,590 | 607,157 | 3.55% |

**Control:** implement `recent_publication_lag_flag`. Any response-status aggregate over a flagged window is directional only.

---

## 8. Narrative coverage (measured)

| Scope | Complaints | With narrative | Share |
|---|---:|---:|---:|
| Whole database | 17,119,590 | 3,837,184 | **22.41%** |
| Trailing twelve months | — | — | **7.53%** |
| Recent months (2026) | — | — | declining, 4.06% → below 1% |

Narrative publication is opt-in, so coverage is a **self-selected subset** in every period. Coverage also varies substantially over time, so it must be re-measured at each retrieval rather than assumed from this report.

**Control:** derive `has_narrative` as a completeness flag only. Never ingest narrative text beyond the raw layer (DQ-12). No metric may be computed over the narrative subset and presented as describing the complaint population.

---

## 9. Retrieval mechanism assessment

| Mechanism | Assessment |
|---|---|
| **Bulk CSV archive** | **Selected.** Full history, daily refresh, no auth, no pagination, stable URL. Rows are **not** date-ordered. |
| Search API (JSON) | Secondary — reconciliation and aggregates only. Deep pagination requires `search_after` seeded from `_meta.break_points`. |
| Filtered CSV export | **Rejected as primary.** Verified: a 6-day window (61,744 rows) returns HTTP 200; a 15-day window (~222,600 rows) returns **HTTP 400 with body `size`**. Documented cap is 100,000 rows — roughly a four-day window at current volume. |
| Bulk JSON archive | **Rejected.** Two days stale at retrieval. |
| API JSON export | **Retired** by CFPB in July 2026. |

**Control:** retry logic must treat `HTTP 400 / size` as a window-too-large signal, not a transient error.

---

## 10. Data-quality controls required of the implementation

Each control below is mandatory and traceable to a finding above.

| # | Control | Addresses |
|---:|---|---|
| DQ-01 | Assert exactly 16 expected source columns by name before load; fail on drift | §3, §8 of limitations |
| DQ-02 | Treat `complaint_id` as a string; never cast to integer | §3 |
| DQ-03 | Store `zip_code` as variable-length string; never parse, cast, or geocode masked values containing `X` | §3, §4 |
| DQ-04 | Convert literal `"None"` to null at staging; never allow it as a taxonomy value | §5 |
| DQ-05 | Normalize empty strings to null for all nullable fields | §4 |
| DQ-06 | Declare the retrieval surface and its date grain; never mix bulk and API date semantics | §3 |
| DQ-07 | Set `recent_publication_lag_flag` on records within the trailing **60-day** window (seed-configured) or with `company_response = 'In progress'` | §7 |
| DQ-08 | Attach `signal_confidence` to every derived signal | §6, §7 |
| DQ-09 | Publish `observed_share_pct` and `baseline_volume` with every `volume_change_pct` | §6 |
| DQ-10 | Version taxonomy labels; never merge legacy into current | §5, §6 |
| DQ-11 | Exclude `tags` and `zip_code` from all downstream models and exports | §5 |
| DQ-12 | Never ingest narrative text beyond the raw layer; derive `has_narrative` only | §8 |
| DQ-13 | Reconcile loaded row count and freshness against the API `_meta` block | §2 |
| DQ-14 | Surface measured null rates after every load; alert on material change | §4 |
| DQ-15 | Do not rely on bulk archive row order for any incremental logic | §9 |
| DQ-16 | Assert that no model or export column expresses a duration | `06_known_limitations.md` §2 |
| DQ-17 | Validate every export column against `09_supported_vs_unsupported_metrics.md` | Register enforcement |
| DQ-18 | Check the CFPB release-notes page on a recurring basis for schema drift | §8 of limitations |

---

## 11. Report maintenance

Re-run this assessment whenever the source is re-retrieved, and always before a portfolio demo. Record the new retrieval date, re-measure §2, §4, §7, and §8, and note any drift from the figures above. Material drift requires an ADR.
