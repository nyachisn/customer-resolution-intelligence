# Customer Resolution Intelligence

**An analytical product built on 17.1M published CFPB consumer complaints — from ingestion through to a recommended action.**

🔗 **[Live application](https://customer-resolution-intelligence.vercel.app)** · [What you're looking at](https://customer-resolution-intelligence.vercel.app/) · [How it's built](https://customer-resolution-intelligence.vercel.app/data-story) · [Explore](https://customer-resolution-intelligence.vercel.app/explore)

---

## The architecture

A batch ELT pipeline with a layered dbt transformation DAG.

```
CFPB bulk archive
      ↓  batch ingestion, record count reconciled against source metadata
Snowflake RAW              source-preserving, landed unchanged
      ↓  dbt
staging → intermediate → marts → decisioning        13 models, 91 tests
      ↓  materialized back into Snowflake
Snowflake ANALYTICS        6 mart tables, 3 seeds
      ↓  curated export, read through a read-only role, column allowlist
Versioned JSON in Git
      ↓
Next.js on Vercel  ·  Streamlit operations console
```

| | |
|---|---|
| **Records loaded** | 17,119,590 → **17,119,581 modeled** (9 dropped by the required-field filter, asserted by a test) |
| **Coverage** | 176 complete months, Dec 2011 – Jul 2026 |
| **dbt models** | 13 — 1 staging, 5 intermediate, 5 marts, 2 decisioning |
| **Tests** | 91 — 55 `not_null`, 17 `accepted_values`, 8 `unique`, 4 `unique_combination_of_columns`, 2 `relationships`, 5 singular |
| **Storage** | 2.53 GB — ANALYTICS_PROD 1.51 + RAW 1.02 |
| **Stack** | Snowflake · dbt · dbt Cloud · Next.js · Vercel · Streamlit |

**Who does what:** Snowflake is the data platform. dbt is transformation and modeling. dbt Cloud is orchestration, scheduling and CI. Next.js is the application; Vercel hosts it.

---

## Three findings worth reading

**The CFPB renamed its product taxonomy twice** — April 2017 and August 2023. Plotted on the published labels, a 15-year per-product chart shows nearly every category dying and being reborn on those two dates; credit reporting alone appears as three unrelated products. The application maps eleven product lineages and marks both change dates on the curve rather than smoothing over them.

**A double-counting defect, found before it reached reporting.** `complaint_volume` was sourced from `issue_volume_current` — a trailing 7-day rolling sum — and then summed across every date in the export window, so a single complaint was counted in up to seven rows. It was corrected to `daily_complaint_count`, the true per-date count and the only field in the model safe to sum across dates.

**Daily grain was mostly drawing the calendar.** Sundays average 6,126 published complaints against 24,011 on a Tuesday — weekends run at 37% of a weekday. A daily line is therefore a picture of the publishing schedule more than of complaint behaviour, so every trend in the product is at month grain, and the application shows the evidence for that decision.

---

## What the source does and does not support

The premise of the project is that **a data product is only as good as the claims it refuses to make.**

An independent audit of the live source found several assumptions in the original specification to be wrong. The most consequential:

> **The public CFPB dataset contains no company response timestamp.**
>
> It publishes `date_received` and `date_sent_to_company` — the date the *CFPB routed* the complaint to the company. For modern web-submitted complaints these are separated by seconds. A "response time" derived from them would have measured a government API's routing speed while being labelled company responsiveness.

The specified `response_days_calendar` metric was removed rather than relabelled, along with the entire dispute policy, after the audit found the `Consumer disputed?` field had been dropped from CFPB exports in June 2026. A CI check greps the application for that vocabulary so it cannot quietly return.

See [ADR-004](docs/adr/ADR-004-source-validation-removes-response-duration.md) and the binding register in [09_supported_vs_unsupported_metrics.md](docs/09_supported_vs_unsupported_metrics.md).

**Reading the data well.** The CFPB database is an observed public complaint dataset — complaints that met publication criteria — not a statistical sample of consumer experience. Volume is highly concentrated: credit-reporting categories are roughly 81% of records. A change in complaint volume is a change in what was reported and published. Complaint narratives are excluded entirely; no narrative ingestion, NLP, or LLM processing is part of this project.

---

## Data source

**Publisher:** U.S. Consumer Financial Protection Bureau
**Source:** [Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/)
**Ingestion:** official bulk CSV archive (`complaints.csv.zip`), used rather than the filtered API export for reproducibility, full historical coverage, and to avoid the export's ~100,000-row cap
**Coverage observed:** 2011-12-01 → 2026-08-15 · 17,119,590 published records · 16 fields

---

## Access model

Four Snowflake roles, each with one job. The export script runs as the application reader, so it fails the same way the application would if the boundary were ever wrong.

| Role | Responsibility |
|---|---|
| `CRI_LOADER` | Loads source data into RAW |
| `CRI_TRANSFORMER` | Builds the analytical models |
| `CRI_APP_READER` | Reads curated analytical outputs |
| `CRI_ADMIN` | Owns Snowflake objects and grants |

---

## Documentation

| Document | Purpose |
|---|---|
| [00_project_charter.md](docs/00_project_charter.md) | Product contract, scope, objectives, success criteria |
| [01_product_requirements.md](docs/01_product_requirements.md) | Functional and non-functional requirements |
| [02_data_provenance.md](docs/02_data_provenance.md) | Source, ingestion, usage, and disclosure rules |
| [02_data_source_audit.md](docs/02_data_source_audit.md) | Independent verification of the live source schema |
| [03_data_dictionary.md](docs/03_data_dictionary.md) | Model and field definitions, including grain |
| [04_decisioning_policy.md](docs/04_decisioning_policy.md) | Deterministic action policy and reason-code contract |
| [05_architecture.md](docs/05_architecture.md) | Snowflake, dbt, application, security, and delivery design |
| [06_known_limitations.md](docs/06_known_limitations.md) | Consolidated limitation register |
| [09_supported_vs_unsupported_metrics.md](docs/09_supported_vs_unsupported_metrics.md) | Binding metric register |
| [15_explore_workspace.md](docs/15_explore_workspace.md) | Explore surface: populations, filter contract, payload strategy |
| [adr/](docs/adr/) | Architecture decision records |

---

## Status

Built and deployed. dbt Cloud runs the production job and runs on pull requests; the application deploys from `main` on Vercel.

Independent portfolio project by [Shem Nyachieo](https://github.com/nyachisn). Not affiliated with or endorsed by the CFPB or any financial institution.
