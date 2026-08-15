# Resolution Intelligence — Project Charter

**Status:** Phase 0 — Product contract  
**Owner:** Shem Nyachieo  
**Version:** 1.1  
**Last updated:** August 15, 2026  
**Revision note:** v1.1 reconciles this charter with the verified source audit in `02_data_source_audit.md`. See `adr/ADR-004-source-validation-removes-response-duration.md`.

## 1. Product summary

**Resolution Intelligence** is a portfolio prototype for a **trusted decision layer for customer-issue operations**. It transforms publicly released Consumer Financial Protection Bureau (CFPB) complaint records into governed issue context, emerging-pattern signals, explainable priority, and recommended investigation or operational action — each accompanied by its supporting evidence and its stated limitations.

The project demonstrates the data foundation that could support AI agents, human agents, service-operations teams, and customer-engagement workflows. It is **not** complaint-management software, a credit-decision engine, a complaint-resolution prediction engine, or an autonomous customer-contact platform.

> **Product promise:** Turn customer signals into the next best action.

### Core product flow

```text
Customer signal → Context → Pattern → Priority → Action
```

Every stage carries its evidence forward, and every stage is permitted to say what it cannot support. The product focuses on issue intelligence, operational context, emerging patterns, explainable priority, recommended investigation or action, and the evidence and limitations behind each.

## 2. Problem statement

Customer-service organizations often manage cases as isolated tickets. Product, issue, published response status, timeliness, and intake-channel signals are fragmented or difficult to interpret together. This can delay detection of emerging service patterns and leave agents without concise context for prioritization and escalation.

The project answers one operational question:

> When a customer issue reaches a support operation, what is known about the issue, what pattern does it belong to, how urgent is operational handling, and what should happen next?

## 3. Product objectives

- Build a reproducible Snowflake + dbt data product using official CFPB public data.
- Establish a canonical complaint model with clear lineage, grain, tests, and documentation.
- Produce deterministic issue-pattern and resolution-signal models.
- Produce an explainable `resolution_action_queue` for service operations.
- Produce an `agent_case_context` model that supplies factual case context and explicit operational guidance.
- Demonstrate how trusted context could be handed to an AI agent, a human agent, or a workflow platform without claiming a live integration.
- Create a portfolio artifact that demonstrates product judgment, data governance, SQL/dbt modeling, and enterprise customer-experience thinking.

## 4. Primary users

| User | Job to be done | Product value |
|---|---|---|
| Support operations leader | Detect service bottlenecks and emerging issue patterns | Prioritized work and visible operational signals |
| Complaint-resolution manager | Review high-priority or unresolved cases | Explainable priority, response status, and reasons |
| Human support agent | Understand the relevant case context quickly | Structured issue and trend context without searching across sources |
| AI-agent / orchestration team | Receive governed context for automation or handoff | Explicit fields, actions, reasons, and safety limits |
| Product or CX leader | Identify product friction and service trends | Trend signals by product, issue, channel, and time |

## 5. Target customer profile

The future commercial concept is aimed at organizations with meaningful customer-service operations, including:

- Mid-market fintechs, lenders, payments companies, credit unions, card issuers, and consumer-finance companies.
- BPO and contact-center providers serving regulated industries.
- Customer-experience consultancies or systems integrators.

The CFPB dataset is a **public demonstration dataset**, not the future customer data product. A real deployment would use an organization’s authorized case-management, CRM, interaction, knowledge-base, and communication data.

## 6. Product scope

### In scope

- Public CFPB complaint data ingestion and transformation, sourced from the official bulk CSV archive.
- Structured fields only for the MVP.
- Complaint taxonomy, published response status, published timeliness signal, and intake-channel analysis.
- Deterministic trend metrics and emerging-pattern flags, each qualified by baseline, observed share, and confidence.
- Deterministic, policy-driven action recommendations.
- dbt documentation, tests, source lineage, seeds, and generated DAG/docs.
- A curated demo data export for a Vercel-hosted product prototype.

### Out of scope

- Sending SMS, email, voice, WhatsApp, or other communications.
- Accessing financial-institution CRM, ticketing, contact, account, or transaction data.
- Contacting consumers or attempting to identify consumers.
- Credit, underwriting, fraud, pricing, eligibility, legal, regulatory, or compensation decisions.
- Autonomous case resolution or account action.
- Any use of complaint narratives, including NLP/LLM processing, narrative ingestion, or sentiment analysis.
- Ranking companies as “good,” “bad,” “safe,” or “risky.”
- **Any measure of company response duration or resolution duration.** The public dataset contains no company response timestamp; see §6.1.
- Prediction of complaint outcome, resolution likelihood, customer satisfaction, or root cause.

### 6.1 Response-time limitation (validated)

The public CFPB dataset provides **no company response timestamp**. It provides `date_received` (when the CFPB received the complaint) and `date_sent_to_company` (when the CFPB routed the complaint to the company). Neither records when — or whether — a company acted.

Accordingly, this project does not calculate, display, or imply response duration, resolution duration, time-to-resolution, or handling time. The published `timely_response` field is retained as a **source-provided categorical signal**, not as evidence of a measured interval.

## 7. MVP success criteria

The MVP is successful when:

- A reviewer can understand the source data, transformations, model grain, and recommendation logic in under five minutes.
- Every record in `resolution_action_queue` has a stable key, policy ID, action, and at least one reason code.
- Every final model has source lineage, documented grain, and data-quality tests.
- The project makes no prohibited claims and contains no direct personal identifiers.
- A reproducible path exists from source retrieval → Snowflake raw load → dbt build → curated demo export.
- A user can inspect a demo case and understand why the recommended action was generated.

## 8. Non-negotiable product principles

1. **Explainability before sophistication.** A transparent rule is preferable to an opaque score.
2. **Complaint records, not people.** The project operates on published **complaint records** — observed public rows. A row is a complaint observation, not a customer, a consumer profile, or an identified person. The word "customer" describes the future commercial product and its hypothetical customer-owned data, never the identity behind a public CFPB row.
3. **Lineage is a feature.** Every output must be traceable to source fields, transformations, and policy rules.
4. **No forced certainty.** Missing, ambiguous, or incomplete source information must remain visible.
5. **No false activation claims.** The prototype is activation-ready; it does not claim to send or receive customer communications.
6. **Human judgment remains required.** Recommendations assist operational review and do not replace decisions in regulated workflows.
7. **State the confidence, state the limit.** Every signal carries a `signal_confidence` value (`HIGH`, `MEDIUM`, `LIMITED`, `NOT_SUPPORTED`) and, where applicable, a written interpretation limitation. A conclusion the public data cannot defensibly establish must be labelled `NOT_SUPPORTED` rather than softened.
8. **Observed, not representative.** The CFPB database is an **observed public complaint dataset**, not a statistical sample of consumer experience. No output may imply market-wide prevalence, harm, or dissatisfaction.

## 9. Portfolio positioning

> I built Resolution Intelligence, a Snowflake + dbt decision layer that converts public CFPB complaint records into governed issue context, emerging-pattern signals, and explainable operational next-best actions. It demonstrates the trusted context an AI or human agent would need to resolve customer issues with more consistency and speed.

## 10. Key artifacts

| Artifact | Purpose |
|---|---|
| `docs/00_project_charter.md` | Product contract, scope, objectives, and success criteria |
| `docs/01_product_requirements.md` | Functional and non-functional requirements |
| `docs/02_data_provenance.md` | Source, usage, privacy, and disclosure rules |
| `docs/03_data_dictionary.md` | Model and field definitions, including grain |
| `docs/04_decisioning_policy.md` | Deterministic action policy and reason-code contract |
| `docs/05_architecture.md` | Snowflake, dbt, application, security, and delivery design |
| `docs/02_data_source_audit.md` | Independent verification of the live CFPB source schema |
| `docs/06_known_limitations.md` | Consolidated limitation register and interpretation rules |
| `docs/08_source_quality_report.md` | Measured source-quality findings and data-quality controls |
| `docs/09_supported_vs_unsupported_metrics.md` | Metric-by-metric support determination |
| `docs/adr/ADR-004-...md` | Decision record removing response-duration measurement |

## 11. Approval checkpoint

Do not build Snowflake objects or dbt SQL until the owner confirms:

- The scope and non-goals are acceptable.
- Structured CFPB data—not narratives—is the MVP input.
- No model represents a consumer risk score or financial decision.
- Every model listed in the data dictionary has an agreed grain.
- Every recommendation must be tied to a documented policy rule and reason code.
- **No model, metric, or UI element expresses company response duration or resolution duration.**
- **Every published signal carries a confidence value and, where applicable, a stated limitation.**
- **Emerging-pattern output is always accompanied by baseline, observed share, and qualification status.**
