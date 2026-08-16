# Customer Resolution Intelligence

**A trusted decision layer for customer-issue operations.**

> Customer signal → Context → Pattern → Priority → Action

Customer Resolution Intelligence is a **portfolio prototype**. It converts the public CFPB Consumer Complaint Database into governed issue context, emerging-pattern signals, explainable operational priority, and recommended investigation or action — each carrying its supporting evidence and its stated limitations.

It is an independent project. It is not affiliated with, endorsed by, or integrated with the CFPB, any financial institution, or Twilio.

---

## What this is

A demonstration of the **data foundation** an AI agent, a human agent, or a workflow platform would need to handle a customer issue with context and consistency:

- **Issue intelligence** — a canonical complaint model with versioned taxonomy, documented grain, lineage, and tests.
- **Operational context** — published status signals assembled into a concise, agent-safe brief per complaint record.
- **Emerging patterns** — deterministic, seed-configured signals with baseline, observed share, and qualification status.
- **Explainable priority** — every priority traceable to a policy rule.
- **Recommended action** — every recommendation carrying `policy_id`, `recommended_action`, `priority`, `reason_code`, evidence fields, and confidence.
- **Evidence and limitations** — every signal stating what it can and cannot support.

Built on Snowflake + dbt, surfaced through a Next.js application on Vercel.

## What this is not

- Not complaint-management software.
- Not a complaint-resolution prediction engine.
- Not a production financial-services decision engine.
- Not a credit, underwriting, fraud, eligibility, or regulatory decision system.
- Not a consumer scoring system, and not a company performance ranking.
- Not an integration with the CFPB, any financial institution, or Twilio.

It does not identify or contact consumers, make financial decisions, or determine complaint outcomes.

---

## Why the constraints are the point

This project's premise is that **a data product is only as good as the claims it refuses to make**.

An independent audit of the live CFPB source (August 15, 2026) found that several assumptions in the original specification were wrong. The most consequential:

> **The public CFPB dataset contains no company response timestamp.**
>
> It publishes `date_received` and `date_sent_to_company` — the date the *CFPB routed* the complaint to the company. For modern web-submitted complaints these are separated by **seconds**. A "response time" derived from them would have measured a government API's routing speed while being labelled company responsiveness.

The specified `response_days_calendar` metric was removed rather than relabelled. So was the entire dispute policy, after the audit found that the `Consumer disputed?` field — still listed in most third-party documentation — was removed from CFPB exports in June 2026.

See [ADR-004](docs/adr/ADR-004-source-validation-removes-response-duration.md) for the decision record, and [09_supported_vs_unsupported_metrics.md](docs/09_supported_vs_unsupported_metrics.md) for the binding register of what this product may and may not measure.

---

## Data source

**Publisher:** U.S. Consumer Financial Protection Bureau
**Source:** [Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/)
**Ingestion:** official bulk CSV archive (`complaints.csv.zip`)
**Retrieval date:** August 15, 2026
**Coverage observed:** 2011-12-01 → 2026-08-15; 17,119,590 published records
**Schema observed:** 16 fields ([field reference](https://cfpb.github.io/api/ccdb/fields.html))

The bulk archive is used rather than the filtered API export for reproducibility, full historical coverage, and to avoid the export's ~100,000-row cap.

### Required context

> This portfolio prototype uses publicly available data from the CFPB Consumer Complaint Database. The prototype is an independent demonstration of data modeling and operational decisioning. It does not identify or contact consumers, make financial decisions, determine complaint outcomes, or represent an integration with CFPB, financial institutions, or Twilio.

> The CFPB database is an **observed public complaint dataset** — a record of complaints that met publication criteria. It is not a statistical sample of consumer experience. Published complaint volume should be interpreted with relevant context including company size, market share, geography, and reporting conditions. A change in complaint volume is a change in what was reported and published, not a measured change in customer experience and not evidence of an incident.

> Complaint volume is highly concentrated — credit-reporting categories account for roughly 81% of records — and is materially affected by third-party submission behavior. In June 2026 the CFPB stated it "cannot rely upon the consumer complaint portal data as a reliable reflection of actual market conditions" absent announced corrections.

Complaint narratives are excluded. No narrative ingestion, NLP, sentiment analysis, or LLM processing is part of this project.

---

## Documentation

| Document | Purpose |
|---|---|
| [00_project_charter.md](docs/00_project_charter.md) | Product contract, scope, objectives, success criteria |
| [01_product_requirements.md](docs/01_product_requirements.md) | Functional and non-functional requirements |
| [02_data_provenance.md](docs/02_data_provenance.md) | Source, ingestion, usage, privacy, and disclosure rules |
| [02_data_source_audit.md](docs/02_data_source_audit.md) | Independent verification of the live source schema |
| [03_data_dictionary.md](docs/03_data_dictionary.md) | Model and field definitions, including grain |
| [04_decisioning_policy.md](docs/04_decisioning_policy.md) | Deterministic action policy and reason-code contract |
| [05_architecture.md](docs/05_architecture.md) | Snowflake, dbt, application, security, and delivery design |
| [06_known_limitations.md](docs/06_known_limitations.md) | Consolidated limitation register |
| [08_source_quality_report.md](docs/08_source_quality_report.md) | Measured source quality and data-quality controls |
| [09_supported_vs_unsupported_metrics.md](docs/09_supported_vs_unsupported_metrics.md) | Binding metric register |
| [10_build_plan.md](docs/10_build_plan.md) | Build status board, issue log, and open decisions |
| [adr/](docs/adr/) | Architecture decision records |

---

## Project status

**Phase 0 — product contract.** Documentation only.

No Snowflake objects, dbt models, ingestion code, or application code have been written. Implementation is gated on owner approval of the checkpoints in [00_project_charter.md](docs/00_project_charter.md) §11 and [01_product_requirements.md](docs/01_product_requirements.md) §11.

---

## Why this is Twilio-adjacent

Twilio frames agent productivity around unifying channels and carrying context across AI and human agents. This project deliberately works the layer beneath that: **what is known about an issue, what pattern it belongs to, what is uncertain, and what should happen next.**

Communications and agents are only as useful as the context behind them. Customer Resolution Intelligence focuses on making that context trustworthy — governed fields, explicit reasoning, stated confidence, and clear handoff conditions that a customer-engagement platform could activate.

The prototype is **activation-ready**, not activated. It claims no live integration.

---

## Contact

**Request a Resolution Assessment** — a discovery conversation about your own authorized data.

Do not submit personal data, credentials, or production data through the public form.
