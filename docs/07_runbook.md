# Resolution Intelligence — Runbook

**Status:** Phase 0 — Written ahead of implementation
**Owner:** Shem Nyachieo
**Version:** 1.0
**Last updated:** August 15, 2026

> This runbook is the reproducibility contract required by `01_product_requirements.md` §8: *"A new developer can run documented setup, load, dbt build, tests, and demo export steps."*
>
> It is written **before** implementation so that the operational path is designed rather than reconstructed. Steps describing code that does not yet exist are marked **[not yet implemented]**. Every command shown must work as written once the corresponding phase is built.

---

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | Ingestion and export scripts |
| dbt-snowflake | 1.8+ | Transformation |
| Snowflake account | Any edition | Trial tier is sufficient for this project's volume |
| Node.js | 20 LTS | Vercel application |
| Disk space | ~15 GB free | The bulk archive is ~1.4 GB compressed and expands substantially |

**Credentials required:** a Snowflake account identifier, user, and either a password or key-pair. These live in `.env` (never committed) and `~/.dbt/profiles.yml` (never committed). See `.env.example`.

---

## 2. One-time setup

```bash
git clone <repository-url>
cd resolution-intelligence
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # then fill in your own values
```

Confirm secrets are ignored before going further:

```bash
git check-ignore -v .env data/ && echo "secrets and data ignored"
```

If that command prints nothing, **stop** and fix `.gitignore` before continuing.

---

## 3. Snowflake bootstrap **[not yet implemented]**

Run once per environment, in order. Scripts are idempotent.

```bash
snowsql -f snowflake/00_bootstrap/00_create_roles.sql
snowsql -f snowflake/00_bootstrap/01_create_warehouse.sql
snowsql -f snowflake/00_bootstrap/02_create_database_schemas.sql
snowsql -f snowflake/00_bootstrap/03_grants.sql
```

**Verification gate.** Inspect role grants and confirm the warehouse has auto-suspend enabled and a resource monitor or documented cost control attached. Do not proceed until `RI_APP_READER` demonstrably cannot read `RAW`.

---

## 4. Source retrieval

### 4.1 Download the bulk archive

```bash
python scripts/download_cfpb_data.py    # [not yet implemented]
```

Manual equivalent:

```bash
curl -O https://files.consumerfinance.gov/ccdb/complaints.csv.zip
```

**Use the bulk CSV archive.** Do not substitute the filtered API export — it is capped at ~100,000 rows and returns `HTTP 400` with body `size` above that. See `02_data_provenance.md` §2.1.

The download lands in `data/`, which is git-ignored. **Never commit it.**

### 4.2 Complete the source retrieval record

Before loading, populate every field required by `02_data_provenance.md` §2.2:

| Field | How to obtain |
|---|---|
| Publisher | Constant: U.S. Consumer Financial Protection Bureau |
| Source URL | The exact URL used |
| Retrieval date | Download timestamp, with time zone |
| File type | ZIP containing one UTF-8 CSV |
| Source coverage | Min/max `date_received` and row count after extraction |
| Schema observed | Header row, verbatim |
| Known limitations | Reference `06_known_limitations.md` |

**A load that cannot populate every field must not proceed.**

### 4.3 Validate the schema

```bash
python scripts/validate_source_schema.py    # [not yet implemented]
```

Asserts **exactly 16 columns** by name. Expected header:

```text
Date received, Product, Sub-product, Issue, Sub-issue,
Consumer complaint narrative, Company public response, Company,
State, ZIP code, Tags, Submitted via, Date sent to company,
Company response to consumer, Timely response?, Complaint ID
```

**If this fails, stop.** A column change is source drift, not a transient error. Follow §9.

### 4.4 Reconcile freshness

Check the API `_meta` block independently:

```bash
curl -s "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?size=0&no_aggs=true" \
  | python -c "import json,sys; m=json.load(sys.stdin)['_meta']; print(m['last_updated'], m['total_record_count'], m['is_data_stale'], m['has_data_issue'])"
```

**Abort the load if `is_data_stale` or `has_data_issue` is `true`.** Record `total_record_count` for post-load reconciliation.

---

## 5. Raw load **[not yet implemented]**

```bash
snowsql -f snowflake/01_raw/00_create_file_format.sql
snowsql -f snowflake/01_raw/01_create_stage.sql
snowsql -f snowflake/01_raw/02_create_raw_tables.sql
snowsql -f snowflake/02_load/load_cfpb_complaints.sql
```

Load rules:

- All 16 source columns land in `RAW` unmodified, **as strings**. No casting at this layer.
- Load metadata is attached on every row: `source_system`, `source_url`, `source_retrieved_at`, `source_file_name`, `source_snapshot_date`, `loaded_at`, `load_run_id`.
- Never overwrite a prior load without a new `load_run_id`.

**Post-load verification:**

```sql
SELECT COUNT(*) FROM RAW.CFPB_COMPLAINTS WHERE load_run_id = '<run-id>';
```

Compare against `total_record_count` from §4.4. Investigate any discrepancy before building.

---

## 6. dbt build **[not yet implemented]**

```bash
cd dbt
dbt deps
dbt parse
dbt build --target dev
```

`dbt build` runs models and tests together, so a failing test halts the chain rather than producing an untested mart.

Selective rebuilds:

```bash
dbt build --select stg_cfpb_complaints+     # a model and everything downstream
dbt build --select marts.operations         # one mart group
dbt build --selector critical_models        # the CI-critical set
```

### Expected test coverage

| Area | Assertion |
|---|---|
| `complaint_id` | unique, not_null on staging and `fct_complaints` |
| Taxonomy | accepted values or monitored source-domain test on `product`, `company_response`, `timely`, `submitted_via` |
| Lineage | `agent_case_context.complaint_id` relationship to `fct_complaints` |
| Explainability | `reason_codes` not null when action is not `STANDARD_HANDLING` |
| Action domain | `recommended_action` accepted values |
| Escalation | the five `CRITICAL` tests in `04_decisioning_policy.md` §7.1 |
| **No durations** | no model or export column expresses a duration (DQ-16) |
| **Register** | export column set validated against `09_supported_vs_unsupported_metrics.md` (DQ-17) |

### Generate documentation

```bash
dbt docs generate
dbt docs serve
```

---

## 7. Demo export **[not yet implemented]**

```bash
python scripts/export_demo_data.py --version $(date +%Y-%m-%d)
```

The export must:

- Exclude narratives, `tags`, `zip_code`, and every metric marked **No** in `09_supported_vs_unsupported_metrics.md`.
- Include `generated_at`, `source_snapshot_date`, `policy_version`, and the export version.
- Write to the application's data directory, which **is** committed — it is small, curated, and reviewed.

**Manual review gate.** Read every column name in the output against `02_data_provenance.md` §7 before committing. This gate is not automatable away; DQ-17 catches known violations, but a human confirms the disclosure posture.

---

## 8. Application **[not yet implemented]**

```bash
cd app
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

Environment variables (see `.env.example`):

```text
NEXT_PUBLIC_APP_ENV=development
DEMO_DATA_VERSION=YYYY-MM-DD
```

**Never** place Snowflake account details, passwords, private keys, or raw exports in client-side variables.

---

## 9. Source drift response

Schema validation failing is an expected event, not an emergency. The CFPB removed two fields in June 2026 and retired the JSON export in July 2026.

1. **Stop.** Do not force the load through or patch the validator to pass.
2. Check the [release notes](https://cfpb.github.io/api/ccdb/release-notes.html) and the [field reference](https://cfpb.github.io/api/ccdb/fields.html).
3. Re-run the source audit and update `02_data_source_audit.md` and `08_source_quality_report.md` with a new retrieval date.
4. Assess product impact against `09_supported_vs_unsupported_metrics.md`. **A removed field may invalidate a metric.**
5. If a product boundary, policy, or safety assumption changes, write an ADR.
6. Update `03_data_dictionary.md`, the source YAML, and the tests **in the same pull request**.

---

## 10. Routine maintenance

| Cadence | Task |
|---|---|
| Before any demo | Re-run §4.4 freshness check; confirm the footer snapshot date is accurate |
| Each retrieval | Re-measure null rates (§4 of the source quality report), publication lag, and narrative coverage |
| Monthly | Check the CFPB release-notes page for schema drift (DQ-18) |
| Each source audit | Re-validate the 60-day publication-lag window against measured `In progress` shares |
| Each policy change | Bump `policy_version`; confirm historical recommendations remain reproducible |

---

## 11. Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| `HTTP 400`, body `size`, from the API export | Requested window exceeds the ~100,000-row cap | Expected. Use the bulk archive — this is why it is the primary path |
| Schema validation fails on column count | Source drift | Follow §9. Do not patch the validator |
| `complaint_id` cast error | Something is casting to integer | It is a **string**. See `02_data_provenance.md` §10.1 |
| ZIP parse or geocode failure | Masked values containing `X` | Expected on ~5.7% of rows. Never parse these |
| `None` appearing as a taxonomy value | Literal `"None"` from a CSV export not normalized | Fix at staging (DQ-04). Never let it reach a dimension |
| Trend dates look shifted by a day | Bulk and API date grains mixed | Declare one retrieval surface (DQ-06) |
| `In progress` spike in a recent window | Publication lag | Expected. Confirm `recent_publication_lag_flag` is set. **Not a company performance finding** |
| Every trend signal is credit-reporting | ~81% category concentration | Expected. Confirm trends evaluate within category |
| `CRITICAL` volume is not rare | Policy configuration error | Review §7.1 seed values. `CRITICAL` is designed to be rare |
| `timely_response_status = UNKNOWN` test fails | The domain member is unreachable — the source has no null or third value | Expected. Keep the domain for safety; do not assert reachability |
| dbt cannot connect | `profiles.yml` or `.env` misconfigured | Verify with `dbt debug`. Never commit either file |

---

## 12. What this runbook does not cover

- Production incident response — this is a portfolio prototype, not a production service.
- Multi-tenant deployment, RBAC, or customer data onboarding. See `02_data_provenance.md` §12.
- Anything involving narratives, private customer data, or outbound communications. All are out of scope.
