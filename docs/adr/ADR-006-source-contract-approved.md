# ADR-006 — Source contract approved (build plan item 7)

**Status:** Accepted
**Date:** August 15, 2026
**Owner:** Shem Nyachieo
**Related:** `02_data_source_audit.md`, `08_source_quality_report.md`, `09_supported_vs_unsupported_metrics.md`, `06_known_limitations.md`

---

## Decision

The owner approves the source contract established by the CFPB source audit (August 15, 2026) as the basis for all further implementation. Specifically:

- The verified 16-field schema in `03_data_dictionary.md` §4 is accepted as authoritative, superseding the original specification's assumed schema.
- The removal of the company-response-duration measure and the dispute policy, per [ADR-004](ADR-004-source-validation-removes-response-duration.md), is approved.
- The bulk CSV archive as primary ingestion, per [ADR-005](ADR-005-bulk-csv-as-primary-ingestion.md), is approved.
- The supported/unsupported metric register in `09_supported_vs_unsupported_metrics.md` is approved as binding.
- The known limitations register in `06_known_limitations.md` is approved as the project's standing caveats.

This satisfies build plan item 7 and clears the Phase 0 approval checkpoints in `00_project_charter.md` §11 and `01_product_requirements.md` §11.

## What was approved

| Checkpoint | Status |
|---|---|
| Scope and non-goals acceptable | ✅ |
| Structured CFPB data, not narratives, is the MVP input | ✅ |
| No model represents a consumer risk score or financial decision | ✅ |
| Every model has an agreed grain | ✅ |
| Every recommendation ties to a documented policy rule and reason code | ✅ |
| No model expresses response or resolution duration | ✅ |
| Every signal carries a confidence value and stated limitation | ✅ |
| Emerging-pattern output carries baseline, observed share, and qualification | ✅ |

## Effect

Implementation may proceed past Phase 0. This ADR is the record that it did.
