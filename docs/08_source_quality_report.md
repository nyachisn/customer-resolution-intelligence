# Customer Resolution Intelligence — Source Quality Report

**Status:** Phase 0 — Measured source assessment
**Owner:** Shem Nyachieo
**Version:** 1.2
**Last updated:** August 16, 2026
**Source retrieval date:** August 15, 2026
**Source snapshot metadata:** `last_updated` = `2026-08-15T12:00:00-05:00`; `total_record_count` = 17,119,590; `is_data_stale` = `false`; `has_data_issue` = `false`; `license` = `CC0`
**Revision note:** v1.1 replaced the §4 sample-based estimates with full-population measurements. **v1.2 adds §12** — a measured parser-disagreement defect found during the actual Snowflake load, invisible to the file-level Python profile that produced every other figure in this report.

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

**Measured against the full population** — all 17,119,590 rows, streamed from the retrieved archive by `scripts/profile_source_data.py` on August 15, 2026.

| Field | Null count | Null rate |
|---|---:|---:|
| `Consumer complaint narrative` | 13,282,406 | 77.586% |
| `Tags` | 16,331,589 | 95.375% |
| `Company public response` | 7,774,036 | 45.409% |
| `Sub-issue` | 927,566 | 5.418% |
| `Sub-product` | 235,222 | 1.374% |
| `State` | 62,326 | 0.364% |
| `ZIP code` | 1,867 | 0.011% |
| `Product`, `Issue`, `Company`, `Submitted via`, `Date received`, `Date sent to company`, `Company response to consumer`, `Timely response?`, `Complaint ID` | 0 | 0.000% |

Every figure confirmed the v1.0 sample-based estimate to within 0.05 percentage points, except ZIP masking — see §4.1.

**Control:** surface measured null rates for all fields after every load. Alert on material change from the figures above (`scripts/validate_source_quality.py`, `DRIFT_WARN_THRESHOLD_PCT = 5.0`).

### 4.1 Correction — ZIP masking rate

The v1.0 report estimated **5.66%** ZIP masking from aggregation-bucket arithmetic. **Full-population measurement finds 7.393%** (1,266,203 of 17,119,590 rows) — a real discrepancy, not sampling noise, most likely because the v1.0 estimate summed top-N-truncated aggregation buckets rather than counting masked values directly.

The underlying control is unaffected — masked ZIPs must never be parsed, cast, or geocoded regardless of their exact rate — but the corrected figure is the one to cite.

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
| DQ-19 | Verify null/duplicate counts against the actual loaded table, not only a pre-load file profile — different parsers can recover differently from the same malformed input | §12 |

---

## 11. Raw load results (executed 2026-08-16)

| Metric | Value |
|---|---|
| `load_run_id` | `49781bc8-1608-4436-a6d1-c6b0aa690cca` |
| Ingestion path | 18 row-aligned gzip chunks, ~1M rows each (see §9 amendment below) |
| Rows loaded | 17,119,590 |
| Rows affected by parser-shift corruption | 30 — see full breakdown in §12 |
| Rows with duplicate `complaint_id` | 0 (the naive formula `COUNT(*) - COUNT(DISTINCT complaint_id)` initially suggested 3, fully explained by the 3 null-`complaint_id` rows — `COUNT(DISTINCT)` excludes nulls, so it double-counts them as apparent duplicates. Confirmed by direct inspection: 0 genuine duplicate complaint IDs.) |
| Date range loaded | 2011-12-01 to 2026-08-15 |
| `VALIDATE()` errors reported | 0 across all 18 files |

### 11.1 Ingestion mechanism amendment — single-file COPY failed; multi-file chunking required

Loading the 9GB uncompressed CSV as one staged file failed partway through with a field-delimiter parse error, despite the file being valid CSV (confirmed: Python's `csv` module parses all 17.1M rows without an anomaly, and a 50,000-row extract of the same content loads into Snowflake with zero errors). The fault is Snowflake's internal parallel byte-range scan of one very large uncompressed file landing inside a quoted multi-line narrative field. Snowflake's own documented mitigation — loading from multiple moderately-sized files instead of one large one — resolved it completely. See `scripts/split_and_stage.py` and `docs/adr/ADR-005-bulk-csv-as-primary-ingestion.md`.

## 12. Load-time finding — parser disagreement on malformed rows (measured 2026-08-16)

The full-population profile in §4 was produced by streaming the archive through Python's `csv` module. That profile reported **zero** null values across all 17,119,590 rows for every field. Loading the same archive into Snowflake (`load_run_id 49781bc8-1608-4436-a6d1-c6b0aa690cca`) produced null values Python never saw — a genuine discrepancy between two correct, careful measurements of the same file, not a mistake in either one.

**Full measured scope.** Querying the loaded raw table directly (not assuming the first symptom found was the only one):

| Symptom | Row count |
|---|---:|
| Null `complaint_id` | 3 |
| Null `issue` | 6 |
| Null `company_response_to_consumer` | 21 |
| **Union (any of the three)** | **30** |

The three sets do not overlap — 30 distinct rows, each corrupted in one specific field, out of 17,119,590 (0.000175%). `product` and `date_received` — the two fields preceding the narrative column in row order — are never affected.

**Root cause, confirmed by inspecting raw row content:** these rows contain an unescaped literal comma inside the `Consumer complaint narrative` field — a real RFC4180 violation in the CFPB's own published file. One recovered row's narrative field read in part:

> *"...and just the SNAP BENEFI=ST.**,**Company believes it acted appropriately as authorized by contract or law"*

The comma mid-sentence is not a field delimiter in the source data's intent, but nothing in the file marks it as literal text either — the field's opening quote was not properly closed and reopened around the embedded comma. Every field after the malformation shifts left by one position; where the resulting shortfall lands — `issue` at position 4, `company_response_to_consumer` at position 14, `complaint_id` at position 16 — depends on exactly how much content the malformed comma swallowed in that specific row. This is genuinely ambiguous input, not a bug in either parser: Python's `csv` module (lenient mode) absorbed it one way, producing a complete-looking 16-field row; Snowflake's COPY parser absorbed it differently, correctly recognizing each row as short one field and leaving the corresponding column empty.

**Why this matters beyond these 30 rows.** A file-level profile, however careful, characterizes what one parser makes of the file. It is not proof of what a *different* parser — specifically, the one that will actually load the data — will do with the same bytes. This is why §3's schema check and this section both exist: one is necessary, neither alone is sufficient. It is also why the first-found symptom (3 null `complaint_id` rows) was not assumed to be the whole story — querying the union across every field the source contract requires non-null found ten times as many affected rows as the first check alone would have reported.

**Handling.** `stg_cfpb_complaints.sql` excludes any row missing `complaint_id`, `product`, `issue`, or `complaint_received_date` — the four fields the source contract requires non-null. A shift severe enough to null one required field means the row's other, still-non-null fields cannot be trusted either, so the whole row is excluded rather than loaded with a plausible-looking but corrupted value in some other column. `RAW.CFPB_COMPLAINTS` retains all 17,119,590 rows unmodified, including these 30, preserving source fidelity at that layer — the three affected source columns carry `severity: warn` tests rather than hard failures for exactly this reason. `dbt/tests/assert_dropped_row_count_bounded.sql` fails the build if the excluded-row count ever exceeds 100 — generous relative to the measured 30, but tight enough to catch a materially different class of problem (a broken chunk boundary, a corrupted upload, a schema change) rather than assuming every future gap is "the same known issue."

**Control:** DQ-19 — never assume a file-level profile characterizes load-time parser behavior; verify null/duplicate counts against the actual loaded table, not only against a pre-load streaming profile.

## 13. Report maintenance

Re-run this assessment whenever the source is re-retrieved, and always before a portfolio demo. Record the new retrieval date, re-measure §2, §4, §7, and §8, and note any drift from the figures above. Material drift requires an ADR.
