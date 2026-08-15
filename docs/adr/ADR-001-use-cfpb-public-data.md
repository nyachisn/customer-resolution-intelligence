# ADR-001 — Use CFPB public complaint data as the sole MVP source

**Status:** Accepted
**Date:** August 15, 2026
**Owner:** Shem Nyachieo
**Related:** `02_data_provenance.md`, `06_known_limitations.md`, [ADR-005](ADR-005-bulk-csv-as-primary-ingestion.md)

---

## Context

Customer Resolution Intelligence demonstrates a decision layer for customer-issue operations. A demonstration needs data. A portfolio project has no access to a real organization's case-management, CRM, or interaction data, and obtaining it would require agreements no portfolio project can support.

The options were: use a public dataset, generate synthetic data, or seek authorized private data.

## Decision

**Use the CFPB Consumer Complaint Database as the sole MVP source.**

The CFPB publishes complaint records under CC0, states the data is freely available to use, analyze, and build on, and updates it daily. It carries genuine structure — product taxonomy, issue taxonomy, intake channel, published response status — that maps directly onto the operational concepts the product models.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| **Synthetic data** | Synthetic data cannot demonstrate data governance. Every interesting problem this project solves — taxonomy drift, publication lag, category concentration, masked values, schema instability — exists precisely because the data is real. A generated dataset would have let the product make claims no real dataset supports, which is the failure mode the project exists to avoid |
| **Authorized private data** | Requires a data-processing agreement, secure transfer, and a client. Not available to a portfolio project, and mixing it into a public demo would be a governance failure. Deferred to the future-onboarding principle in `02_data_provenance.md` §12 |
| **Multiple public sources** | Combining sources multiplies provenance surface without improving the demonstration. One source, documented exhaustively, is the stronger portfolio artifact |
| **A scraped or third-party mirror** | Introduces unverified data into a project whose premise is verified provenance |

## Consequences

**Accepted:** the source is an observed public complaint dataset, not a sample of consumer experience. It carries no denominator, no customer identity, and no response timestamp. Each of these bounds what the product may claim, and each is documented rather than worked around.

**Required:** a single-source provenance contract. No enrichment from other datasets. Any change to source usage requires an ADR.

**Positioning:** the CFPB data is explicitly the *demonstration* dataset, not the future product's data. A real deployment would connect an organization's own authorized data.
