# ADR-002 — Exclude complaint narratives from the MVP

**Status:** Accepted
**Date:** August 15, 2026
**Owner:** Shem Nyachieo
**Related:** `02_data_provenance.md` §5, `06_known_limitations.md` §6, `09_supported_vs_unsupported_metrics.md`

---

## Context

The CFPB publishes consumer narrative text — the complainant's own description of what happened — when the consumer opts in and after CFPB scrubs personal information. Narratives are the most immediately compelling field in the dataset, and an LLM-powered narrative analysis would be the most eye-catching thing this project could build.

That is exactly why the decision needs a record.

## Decision

**Exclude complaint narratives from the MVP entirely.** No narrative ingestion, no NLP, no sentiment analysis, no LLM processing, under any framing.

The `has_narrative` boolean may be derived as a completeness flag. The narrative text itself is not loaded beyond the raw layer and never reaches a model, an export, or the application.

## Rationale

Three structural properties, each independently sufficient:

| Property | Consequence |
|---|---|
| **Opt-in** | Records carrying narratives are a self-selected subset (22.41% of the database; 7.53% over the trailing twelve months). Any narrative-derived measure describes that subset, not the complaint population — and would be read as describing the population |
| **Unverified** | CFPB publishes narratives in the consumer's own words and does not verify their accuracy. They are allegations, not established facts. A product that summarized them would be laundering unverified claims into apparent findings |
| **Revocable consent** | A consumer may withdraw consent at any time, and the narrative is then unpublished. **A narrative snapshot is therefore not reproducible** — a direct contradiction of this project's reproducibility contract |

The revocability point is decisive on its own. A project whose stated principle is "a reproducible path from source retrieval to demo export" cannot build on a field that may vanish between retrievals.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| **LLM summarization of narratives into case context** | Would require a content-safety plan, a re-identification policy, a prompt/eval/retention plan, and human review of every public display. That is a project of its own, and none of it changes the reproducibility problem |
| **Sentiment scoring as a priority input** | Sentiment on a self-selected, unverified subset is not a measure of anything the product may claim. It would also import tone into an operational priority, which conflicts with "explainability before sophistication" |
| **Narratives displayed verbatim in the demo** | Even CFPB-scrubbed text carries residual re-identification risk and is unverified. Displaying it in a portfolio piece invites the reader to treat it as fact |
| **Keyword extraction only, no LLM** | Milder, but inherits every problem above: self-selected subset, unverified content, non-reproducible snapshot |

## Consequences

**Accepted:** the MVP works entirely on structured fields. This is a narrower product and a more defensible one.

**Roadmap status:** narrative analysis is an **optional future exploration**, not planned work. It requires verified source availability at the time, current publication policy permitting the use, a dedicated decision record, and the full safety plan above.

**Enforcement:** narrative exclusion is asserted in the demo-export field policy (`02_data_provenance.md` §7), in the metric register, and by DQ-12.
