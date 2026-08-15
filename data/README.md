# data/

**This directory is intentionally empty. It holds no data in version control.**

Raw CFPB source files are never committed. They are approximately 1.4 GB compressed, freely available from the official publisher, and committing them would defeat the provenance controls this project is built to demonstrate. See `docs/02_data_provenance.md` §8.

## How to obtain the data

```bash
curl -O https://files.consumerfinance.gov/ccdb/complaints.csv.zip
```

Or, once implemented:

```bash
python scripts/download_cfpb_data.py
```

Downloads land here and are git-ignored.

## Before you load anything

Complete the **source retrieval record** in `docs/02_data_provenance.md` §2.2 — publisher, source URL, retrieval date, file type, source coverage, schema observed, known limitations. A load that cannot populate every field must not proceed.

Then validate the schema (16 columns, exact names) and reconcile freshness against the API `_meta` block. Full procedure: `docs/07_runbook.md` §4.

## Source

**Publisher:** U.S. Consumer Financial Protection Bureau
**Database:** [Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/)
**License:** CC0
**Field reference:** https://cfpb.github.io/api/ccdb/fields.html
