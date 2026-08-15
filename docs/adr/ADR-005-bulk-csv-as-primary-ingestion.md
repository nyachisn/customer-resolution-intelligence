# ADR-005 — Bulk CSV archive as the primary ingestion path

**Status:** Accepted
**Date:** August 15, 2026
**Owner:** Shem Nyachieo
**Related:** `02_data_provenance.md` §2.1, `08_source_quality_report.md` §9, `07_runbook.md` §4

---

## Context

The CFPB exposes complaint data through several surfaces. The original specification said "bulk download/API" without choosing, which left the decision to whoever wrote the ingestion script first. The surfaces are not equivalent, and one of them silently cannot do the job.

## Decision

**Ingest the official bulk CSV archive.** Use the search API only for aggregate reconciliation and freshness checking.

```text
https://files.consumerfinance.gov/ccdb/complaints.csv.zip
```

## Surface assessment (verified August 15, 2026)

| Surface | Assessment |
|---|---|
| **Bulk CSV archive** | **Selected.** Full history in one retrieval, refreshed daily at a stable URL, no authentication, no pagination |
| Search API (JSON) | **Secondary — reconciliation only.** Deep pagination requires `search_after` cursors seeded from `_meta.break_points`. Workable, but fragile for a full historical load |
| Filtered CSV export | **Rejected.** Capped at ~100,000 rows. Verified: a 6-day window (61,744 rows) returns `HTTP 200`; a 15-day window (~222,600 rows) returns **`HTTP 400` with body `size`**. At current intake volume the cap permits roughly a four-day window |
| Bulk JSON archive | **Rejected.** Observed two days stale at retrieval while the CSV archive was same-day |
| API JSON export | **Retired by CFPB** in Release 23, July 2026 |

## Rationale

| Reason | Detail |
|---|---|
| **Reproducibility** | A dated archive is a citable snapshot. A filtered API query is a moving target whose result depends on parameters, index state, and pagination behavior — three ways for two "identical" runs to differ |
| **Historical coverage** | The archive carries December 2011 onward in a single retrieval. Assembling the same history through a row-capped export would require hundreds of stitched requests |
| **Avoids the row cap** | The filtered export cannot perform a historical load at all. This is a hard blocker, not a preference |
| **Stable archival ingestion** | Fixed URL, daily refresh, no auth, no cursors, no rate-limit handling |

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| **Paginate the search API for the full history** | Technically possible via `search_after`, but 17.1M records through a cursor-paginated JSON API is slow, fragile, and rate-limit exposed — for a dataset published as a single file |
| **Filtered export with date-window chunking** | Would require ~4-day chunks and hundreds of requests, each capable of failing the cap check as daily volume grows. Brittle by construction |
| **Bulk JSON instead of bulk CSV** | Measurably staler. Same content, worse freshness |
| **Incremental daily API pulls onto a bulk baseline** | Reasonable at production scale and unnecessary here. It also mixes date grains — the archive publishes date-only values, the API publishes timestamps — which would corrupt trend models. Deferred until measured volume justifies it |

## Consequences

**Accepted:** each load retrieves the full archive rather than a delta. At this project's cadence that is the simpler and more reproducible choice.

**Required controls:**

- The API surface must not be hard-coded. It has changed materially with limited notice — two fields removed June 2026, JSON export retired July 2026.
- `HTTP 400` with body `size` must be handled as a window-too-large signal, not a transient error worth retrying.
- The retrieval surface determines date grain and must be declared. Surfaces must never be mixed (DQ-06).
- The bulk archive is **not date-ordered**; no incremental logic may rely on file position (DQ-15).
- Every load reconciles row count and freshness against the API `_meta` block (DQ-13).
