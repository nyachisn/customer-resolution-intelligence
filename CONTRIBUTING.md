# Contributing to Resolution Intelligence

This is a portfolio project with a single owner, but it is built to the standards it advocates. These rules exist because the project's premise is data governance — a contribution that quietly weakens a control undermines the whole artifact.

## Before you write code

Read, in order:

1. [docs/00_project_charter.md](docs/00_project_charter.md) — what this product is and is not
2. [docs/06_known_limitations.md](docs/06_known_limitations.md) — what the source cannot support
3. [docs/09_supported_vs_unsupported_metrics.md](docs/09_supported_vs_unsupported_metrics.md) — the binding metric register

## Hard rules

These are not style preferences. A pull request violating any of them will not be merged.

| Rule | Why |
|---|---|
| **No raw source data in Git** | 1.4 GB, freely re-downloadable, and committing it defeats the provenance model |
| **No credentials in Git** | Includes `.env`, `profiles.yml`, key files, and account identifiers in code comments |
| **No response-duration measure** | The source publishes no company response timestamp. See [ADR-004](docs/adr/ADR-004-source-validation-removes-response-duration.md) |
| **No metric marked "No" in the register** | The register is binding and test-enforced |
| **No narrative processing** | No ingestion, NLP, sentiment, or LLM work on narrative text |
| **No "customer" for a CFPB row** | Use complaint record, complaint observation, or issue record |
| **Unknown values stay unknown** | Never default a missing value to a favorable or unfavorable state |

## Pull request standards

**One concern per PR.** Docs, Snowflake bootstrap, a dbt model group, a policy change, the export, or a UI feature — not several at once.

**Every SQL model carries the standard header** from [docs/05_architecture.md](docs/05_architecture.md) §9: model, purpose, grain, inputs, outputs, owner, data classification, limitations, decision record.

**Every model declares its grain in one sentence.** If it cannot, it is not ready.

**Tests reflect actual data limitations, not idealized assumptions.** For example: do not assert that `timely_response_status = UNKNOWN` is reachable — the source has no null or third value.

**Documentation changes ship with the code that changes.** If a source field changes, the source mapping, the tests, and `docs/03_data_dictionary.md` update in the same PR.

## When to write an ADR

Any change to: source datasets or usage terms, narrative/LLM use, the grain of a final mart, the action or priority domain, a policy threshold with material product impact, private-data onboarding, public demo field exposure, application-to-warehouse connectivity, the ingestion mechanism, or the metric register.

Never hide a consequential choice in a commit message.

## Claims review

Before merging anything that changes user-facing text — UI copy, README, methodology pages, chart labels — check it against [docs/01_product_requirements.md](docs/01_product_requirements.md) §9, "Explicitly unacceptable claims."

If a caveat in the metric register contradicts your sentence, the sentence is wrong.
