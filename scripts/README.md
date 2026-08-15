# scripts/

Source retrieval, schema validation, and curated demo export.

**Status:** not yet implemented. Contracts below are binding on the implementations.

## `download_cfpb_data.py`

Retrieves the **bulk CSV archive** and writes the source retrieval record.

```text
https://files.consumerfinance.gov/ccdb/complaints.csv.zip
```

- Downloads to `data/` (git-ignored). Never commits.
- Emits publisher, source URL, retrieval date, file type, source coverage, schema observed, known limitations — per `docs/02_data_provenance.md` §2.2.
- **Does not use the filtered API export.** It is capped at ~100,000 rows and returns `HTTP 400` with body `size` above that. Treat that response as a window-too-large signal, not a transient error.
- Does not hard-code API response formats. The API surface has changed with limited notice.

## `validate_source_schema.py`

Asserts the source schema **before** load. Exits non-zero on any deviation.

- Exactly **16 columns**, by name.
- A column change is **source drift**, not a transient error. Do not patch this script to make a load pass — follow `docs/07_runbook.md` §9.
- Also reconciles freshness against the API `_meta` block; aborts if `is_data_stale` or `has_data_issue` is true.

## `export_demo_data.py`

Produces the curated, versioned export the application reads.

**Must exclude:** narratives, `tags`, `zip_code`, and every metric marked **No** in `docs/09_supported_vs_unsupported_metrics.md`.

**Must include:** `generated_at`, `source_snapshot_date`, `policy_version`, export version.

Validates its own output column set against the metric register (DQ-17), then stops for a manual disclosure review. That human gate is required — see `docs/07_runbook.md` §7.

## Shared rules

- Never write credentials to disk or logs.
- Never commit anything retrieved from the source.
- Every script logs its `load_run_id` and retrieval metadata.
