# Resolution Intelligence — Known Limitations

**Status:** Phase 0 — Product contract
**Owner:** Shem Nyachieo
**Version:** 1.0
**Last updated:** August 15, 2026
**Basis:** Verified source audit of the CFPB Consumer Complaint Database, retrieved August 15, 2026 (`02_data_source_audit.md`)

> This is the consolidated limitation register for Resolution Intelligence. It exists so that a reviewer, an agent consuming project output, or a future developer can see in one place what this product **cannot** establish and why.
>
> A limitation recorded here is a product feature, not an apology. The charter principle "No forced certainty" requires that constraints stay visible rather than being smoothed over.

---

## 1. The source is an observed dataset, not a sample

The CFPB Consumer Complaint Database is a record of complaints that were submitted to the CFPB, forwarded to a company, and met publication criteria. It is **not**:

- a statistical sample of consumer experience,
- a census of consumer harm,
- a measure of customer satisfaction,
- a representation of all issues customers encountered.

**Publication criteria bound the population.** Complaints are published only after being sent to a company and either the company responds or 15 days elapse. Complaints referred to other regulators are excluded, as are complaints about depository institutions with under $10 billion in assets. Whole classes of consumer experience are therefore structurally absent.

**Consequence:** every volume or trend figure describes *reported and published complaints*, never *customer experience*. Product language must say so.

---

## 2. No company response timestamp exists

**This is the single most consequential limitation.**

The dataset contains two dates:

| Field | What it records |
|---|---|
| `date_received` | The date the CFPB received the complaint |
| `date_sent_to_company` | The date the CFPB **routed** the complaint to the company |

Neither records when a company received, opened, responded to, or resolved anything. **There is no third date.**

For modern web-submitted complaints, `date_sent_to_company` follows `date_received` by **seconds to minutes** (observed: 23 seconds, 25 seconds, 13 minutes). An interval between them measures CFPB routing latency.

**Consequence:** the product cannot report response time, resolution time, time-to-resolution, handling time, or any SLA-style measure. `response_days_calendar` has been removed from the specification and no replacement is permitted. See `adr/ADR-004-source-validation-removes-response-duration.md`.

**What remains available:** the published `timely_response` field is CFPB's own categorical assessment (`Yes` / `No`). It is a source-provided signal, not a measured interval, and must never be rendered as a duration. It is also near-degenerate — 99.38% `Yes` — so it distinguishes very few records.

---

## 3. Recent records are structurally incomplete (publication lag)

Complaints are published before the company's response is necessarily recorded. Measured on the verified source:

| Window (by `date_received`) | Share still `In progress` |
|---|---:|
| Last 7 days | **88.52%** |
| 30–60 days prior | **33.94%** |
| ~12 months prior | 0.00% |
| Whole database | 3.55% |

The "published after 15 days" rule understates this considerably: a third of complaints remain unresolved one to two months after receipt.

**Consequence:** any response-status metric over a recent window is directional only. The `recent_publication_lag_flag` control exists to make this visible.

**Prohibited reading:** a high count of `In progress` records is evidence of publication timing, **never** of poor company performance, slow response, or service failure.

---

## 4. Extreme category concentration and external submission behavior

Observed distribution:

| Category | Share of database |
|---|---:|
| Credit-reporting categories (three labels combined) | **~81%** |
| Debt collection | 6.84% |
| Mortgage | 2.67% |
| All other products | <10% combined |

Additional concentration: 96.30% of complaints arrive via `Web`; 99.38% carry `timely_response = Yes`.

**The publisher has questioned its own data.** In its June 24, 2026 notice on complaint-system integrity, the CFPB stated it "cannot rely upon the consumer complaint portal data as a reliable reflection of actual market conditions" absent announced corrections, and attributed part of a rise in credit-reporting complaints from 150,000 (2019) to over 5 million (2025) to "credit repair organizations and credit clinics misusing the Bureau's complaint process."

**Consequence:** raw volume trends are materially affected by external reporting behavior and by changes in complaint submission patterns. A percentage increase is a change in *reported and published* volume. Emerging-issue detection must evaluate within category, require a documented minimum baseline, and publish `observed_share_pct` alongside `volume_change_pct`.

**Prohibited reading:** a large percentage increase is never, on its own, evidence of an actual market incident.

---

## 5. Fields that do not exist

| Field | Status |
|---|---|
| `Consumer disputed?` | Discontinued as a filter November 2017; **removed from exports entirely June 2026**. Does not exist. No proxy may be constructed. |
| `Consumer consent provided?` | Removed from exports June 2026. Consent state is only indirectly observable via `has_narrative`. |
| Company response date | **Has never existed** in the public dataset. |
| Any customer, account, or transaction identifier | Never published. |
| Satisfaction, sentiment, or outcome-quality field | Does not exist in any form. |

---

## 6. Narrative coverage is partial and unstable

Narratives are published only when the consumer opts in. Coverage is partial across the database (22.41% of all records) and materially lower in recent periods (7.53% across the trailing twelve months, declining through 2026).

Three properties make narratives unsuitable for the MVP:

| Property | Consequence |
|---|---|
| **Opt-in** | Records with narratives are a self-selected subset. Any narrative-derived measure describes that subset, not the complaint population |
| **Unverified** | CFPB publishes narratives in the consumer's own words and does not verify their accuracy. They are not a factual record |
| **Revocable consent** | A consumer may withdraw consent at any time, so a narrative snapshot is **not reproducible** — a direct conflict with the project's reproducibility contract |

**Consequence:** the MVP narrative exclusion is validated on structural grounds, independent of any given month's coverage. Narrative analysis remains an optional future exploration conditional on verified availability at the time of the work — not planned work.

---

## 7. No denominator for comparative or market-wide measures

The dataset contains no measure of company size, customer count, account count, transaction volume, or market share.

**Consequence:** the product cannot compute a complaint rate, a per-customer rate, a market-wide incidence figure, or a defensible company-to-company comparison. Any company-level aggregate is bounded contextual signal only and must carry `signal_confidence = LIMITED` with a denominator limitation.

---

## 8. Source schema instability

The CFPB has changed the published schema with limited notice:

| Release | Date | Change |
|---|---|---|
| 22 | June 2026 | Removed `Consumer disputed` and `Consumer consent provided` from exports |
| 23 | July 2026 | Capped filtered CSV exports at ~100,000 rows; **retired the JSON export** |
| 14 | November 2017 | Discontinued `Consumer disputed?` as a filterable column |

**Consequence:** schema validation must assert exact expected columns and treat drift as a documented condition. The release-notes page must be checked on a recurring basis. API response formats must not be hard-coded.

---

## 9. Type and encoding hazards

| Hazard | Detail |
|---|---|
| `complaint_id` typing | The source's own OpenAPI spec declares `integer($int64)`; the live API returns a **string**. Treat as string; never cast to integer. |
| Masked ZIP values | ~5.7% of records carry `X` characters (`XXXXX`, `064XX`). Never numeric, never geocoded, never treated as a real postal code. |
| Literal `"None"` | The API's CSV export writes the four-character string `None` for missing values. If loaded naively it becomes a legitimate-looking taxonomy category. Must be converted to null. |
| Empty-string nulls | The bulk archive uses empty strings instead. Both encodings must be handled. |
| Date grain | Bulk archive publishes date-only; API publishes timestamps. **No documented source time zone** for API timestamps, so day-boundary logic must not assume UTC correctness. |
| Unordered bulk rows | The bulk archive is not date-ordered. No incremental logic may rely on file position. |

---

## 10. Taxonomy versioning

Legacy and current labels coexist in the same columns — three distinct credit-reporting product labels, and response values such as `Closed with relief` alongside `Closed with non-monetary relief`.

**Consequence:** taxonomy must be versioned, never merged. Merging legacy labels into current ones would silently rewrite historical meaning.

---

## 11. Sensitive-attribute exclusion

The `tags` field (`Older American`, `Servicemember`) is a **protected/vulnerable-population attribute**. It is deliberately excluded from all decisioning inputs and public surfaces as a governance decision, not an oversight. `zip_code` is excluded beyond the raw layer as a re-identification surface with no MVP requirement.

---

## 12. What this product is not

Recorded here so the boundary survives contact with a demo audience:

- Not complaint-management software.
- Not a complaint-resolution prediction engine.
- Not a credit, underwriting, fraud, eligibility, or regulatory decision system.
- Not a consumer scoring system.
- Not a company performance ranking.
- Not an integration with the CFPB, any financial institution, or Twilio.
- Not a production financial-services decision engine.

---

## 13. Limitation register maintenance

- Update this document whenever the source audit is re-run.
- Any newly discovered limitation requires an entry here **and** a corresponding entry in `09_supported_vs_unsupported_metrics.md`.
- A limitation may only be removed with evidence from a dated source verification, recorded in an ADR.
