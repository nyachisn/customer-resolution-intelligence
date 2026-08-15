# Customer Resolution Intelligence — Product Requirements

**Status:** Phase 0 — Product contract  
**Owner:** Shem Nyachieo  
**Version:** 1.1  
**Last updated:** August 15, 2026  
**Revision note:** v1.1 reconciles these requirements with `02_data_source_audit.md`. See `adr/ADR-004-source-validation-removes-response-duration.md`.

## 1. Product requirement statement

Customer Resolution Intelligence must convert structured public complaint records into a trusted, explainable operational decision layer, following the flow **Customer signal → Context → Pattern → Priority → Action**. It must support an operations leader’s need to detect patterns, a case manager’s need to prioritize review, and an agent’s need for concise complaint-record context.

The product must never present a recommendation as a credit, legal, eligibility, fraud, underwriting, or consumer-behavior decision, and must never present itself as a complaint-resolution prediction engine.

**Terminology requirement.** A row of public CFPB data is a **complaint record**, **complaint observation**, or **issue record**. It is never a customer record, consumer profile, or customer. "Customer" is reserved for describing the future commercial product operating on a client organization's own authorized data.

## 2. User stories

### Operations leader

- As a support operations leader, I want to see emerging issue patterns by product and issue so I can investigate potential service failures before they grow.
- As a support operations leader, I want to know which published cases are flagged for review and why so I can allocate capacity responsibly.
- As a support operations leader, I want explicit caveats on volume metrics so I do not mistake complaint volume for market-wide incidence.

### Complaint-resolution manager

- As a resolution manager, I want a prioritized queue with published response status, published timeliness signal, and pattern context so I can focus review attention.
- As a resolution manager, I want every recommendation to show policy IDs and reason codes so I can audit it.
- As a resolution manager, I want incomplete source context flagged rather than silently filled with assumptions.
- As a resolution manager, I want records whose response status is still unresolved at publication to be marked as such, so I do not mistake publication lag for a service failure.

### Human agent

- As a human agent, I want a concise complaint-record context brief so I can understand the published issue category, published response status, and relevant pattern signals.
- As a human agent, I want the recommended action to be a routing or review suggestion—not an instruction to make a regulated decision.

### AI-agent / workflow team

- As an AI-agent team, I want a bounded, documented context payload with a clear handoff condition so automation does not invent unknown facts.
- As an AI-agent team, I want the system to return `REQUIRE_HUMAN_REVIEW` when data is incomplete or a policy requires escalation.

## 3. Functional requirements

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-001 | Ingest a documented snapshot of official CFPB complaint data from the **bulk CSV archive** into Snowflake raw storage | Must | Raw table preserves source fields and load metadata; retrieval record complete per `02_data_provenance.md` §6.1; raw files are not committed to Git |
| FR-002 | Build a canonical clean complaint model | Must | One row per published complaint record; key, source dates, taxonomy, published response status, published timeliness signal, and lineage fields documented. **No dispute field. No derived duration field.** |
| FR-003 | Build a reusable issue taxonomy dimension | Must | Product, sub-product, issue, and sub-issue values are normalized without overwriting source meaning; legacy and current labels versioned, never merged |
| FR-004 | Build daily issue-volume metrics | Must | Metrics have a defined grain, date rule, dimensions, and test coverage; source-date grain documented per retrieval surface |
| FR-005 | Identify deterministic emerging-pattern signals | Must | Policy thresholds live in seeds; output includes current volume, baseline volume, percentage change, **observed share of complaints**, confidence/qualification status, policy ID, and interpretation limitation |
| FR-006 | Build complaint-record context for agent handoff | Must | One row per complaint record with source facts, derived signals, priority, recommendation, reason codes, confidence, and uncertainty fields |
| FR-007 | Build resolution action queue | Must | One row per complaint record/action decision; every non-standard action has policy ID, reason code, and confidence |
| FR-008 | Support “no special action” outcome | Must | `STANDARD_HANDLING` is a valid action; records are not escalated solely to populate a queue |
| FR-009 | Produce a curated web-demo export | Must | Export excludes narratives, `tags`, `zip_code`, and disallowed fields; version and generation timestamp included |
| FR-010 | Make documentation discoverable | Must | dbt Docs, README, source links, model grain, and methodology are available to a reviewer |
| **FR-011** | **Flag recent records affected by publication lag** | **Must** | **`recent_publication_lag_flag` is set where the record falls in the documented trailing window or its published response status is still unresolved; downstream response-status metrics inherit the flag and are labelled directional** |
| **FR-012** | **Attach signal confidence to every published signal** | **Must** | **Every derived signal and recommendation carries `signal_confidence` from the domain `HIGH`, `MEDIUM`, `LIMITED`, `NOT_SUPPORTED`, with a written limitation where confidence is `LIMITED`** |
| **FR-013** | **Enforce the unsupported-metric register** | **Must** | **No model, export, or UI surface publishes a metric classified `NOT_SUPPORTED` in `09_supported_vs_unsupported_metrics.md`; a test asserts the export column set against the register**

## 4. Customer-facing product requirements

### 4.1 Landing page

The Vercel site must:

- State the value proposition above the fold: **Turn customer signals into the next best action.**
- Explain that the site is an independent portfolio prototype using public CFPB data.
- Show the product flow: signals → context → decision → AI/human/workflow action.
- Link to methodology, data provenance, limitations, and technical architecture.
- Use “Request a Resolution Assessment” rather than a misleading purchase or production-integration CTA.
- State that visitors must not submit personal data, credentials, or production data through the public form.

### 4.2 Interactive demo

The demo must include:

| View | Required information | Prohibited information |
|---|---|---|
| Operations overview | Aggregate issue trends, emerging signals, action counts, observed-share context, methodology note | Consumer identities, unsupported company rankings, response-time or resolution-time measures |
| Issue investigation | Current volume, baseline volume, percentage change, observed share of complaints, confidence/qualification status, trend window, issue taxonomy, policy threshold, interpretation limitation | Causal claims, proof of misconduct, market-wide prevalence, or a percentage increase presented as an incident |
| Complaint-record context | Published structured context, published status signals, action, reasons, confidence, uncertainty | Narrative text, consumer PII, financial decision output, "customer" framing of a public row, any response-duration figure |
| Action playbook | Action definition, policy ID, owner, human-review condition, limitation note | Autonomous resolution instruction |

**Response-time prohibition in UI.** No demo view may present a duration, elapsed time, clock, SLA indicator, "days to respond," or any visual encoding of response speed. The published `timely_response` signal may be shown only as a source-provided category with a tooltip stating that the CFPB publishes no company response timestamp.

### 4.3 Accessibility and usability

- Use semantic HTML, descriptive labels, keyboard navigation, visible focus state, and sufficient color contrast.
- Do not use color alone to communicate priority or status.
- Charts must have an accessible textual summary.
- The product must remain understandable on mobile layouts.

## 5. Recommendation contract

A recommendation is valid only when all of the following are present:

1. `complaint_id` or stable surrogate identifier.
2. `recommended_action` from the approved action domain.
3. `priority` from the approved priority domain.
4. One or more `reason_codes`.
5. One or more `policy_ids` or an explicit `STANDARD_HANDLING` policy reference.
6. Source/derived **evidence fields** sufficient to explain the recommendation.
7. `signal_confidence` from the approved confidence domain.
8. `interpretation_limitation` where confidence is `LIMITED` or the record carries `recent_publication_lag_flag`.
9. `generated_at` timestamp and model/version metadata.

A recommendation is **not** a statement of factual wrongdoing, consumer risk, legal liability, creditworthiness, response speed, or the correct outcome of a complaint.

### 5.1 Confidence and interpretation domain

| Value | Meaning | Example |
|---|---|---|
| `HIGH` | Directly observed source field | Published `company_response`; published `timely_response` |
| `MEDIUM` | Deterministic derived analytical signal with documented methodology | Rolling issue volume; percentage change vs. documented baseline |
| `LIMITED` | Signal affected by source coverage, publication lag, denominator limitations, or other known constraints | Response-status distribution over a recent window; any company-level comparison |
| `NOT_SUPPORTED` | A conclusion the public data cannot defensibly establish | Response duration; satisfaction; root cause; market-wide rate |

Confidence is a **qualitative interpretation status**, not a statistical measure. Do not manufacture numerical confidence intervals, p-values, or significance claims unless a documented methodology supports them. No such methodology exists in the MVP.

## 6. Approved action domain

| Action | Meaning | Human review requirement |
|---|---|---|
| `STANDARD_HANDLING` | No special operational signal identified | No additional review required by this product |
| `PRIORITIZE_CASE_REVIEW` | Review case sooner due to a documented service signal | Yes |
| `ESCALATE_REVIEW` | Route case to a supervisor/specialist review workflow | Yes |
| `INVESTIGATE_PATTERN` | Investigate a potential emerging issue pattern | Yes |
| `REQUIRE_HUMAN_REVIEW` | Source data or policy condition is incomplete/ambiguous | Yes |
| `UPDATE_AGENT_GUIDANCE` | Consider knowledge/routing guidance for a documented aggregate pattern | Yes |

## 7. Priority domain

| Priority | Meaning |
|---|---|
| `LOW` | Informational; no special operational signal |
| `MEDIUM` | Monitor or handle within standard operational process |
| `HIGH` | Documented policy trigger warrants prioritized review |
| `CRITICAL` | Multiple or higher-severity policy triggers warrant immediate human review |

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Reproducibility | A new developer can run documented setup, load, dbt build, tests, and demo export steps |
| Explainability | Every final action has reasons and policy IDs; business logic is not hidden in an opaque model |
| Data quality | Source freshness, schema assumptions, key constraints, accepted values, and custom policy tests are documented |
| Governance | Source, retrieval date, ownership, classification, and usage boundaries are documented |
| Security | No credentials, raw public download files, or sensitive exports are committed to Git |
| Performance | Start with one controlled source period; use incremental processing only when justified by measured volume |
| Maintainability | SQL files have headers; models have YAML docs; policy thresholds are seed-based |
| Auditability | Final models contain generated timestamps, source load metadata, policy versions, and model versioning where practical |

## 9. Explicitly unacceptable claims

The website, README, code comments, demo, or interview narrative must not claim:

- “This system identifies high-risk customers.”
- “This system predicts customer behavior.”
- “This system decides whether a complaint is valid.”
- “This system determines regulatory compliance or legal liability.”
- “This system integrates with CFPB, Twilio, banks, or customer CRMs.”
- “This system contacts customers.”
- “A complaint trend proves a company caused harm or committed misconduct.”
- “Complaint volume represents all consumer experience, all market share, or all incidents.”

Added in v1.1 following source validation:

- **“This company responded in X days.”** / any statement of response duration, resolution duration, time-to-resolution, or handling time. The source publishes no company response timestamp.
- **“This system measures customer satisfaction.”** No satisfaction signal exists in the dataset.
- **“This issue is caused by …”** / any root-cause or causal attribution.
- **“X% of customers experienced this.”** / any statement of prevalence among all customers or the market.
- **“Company A performs worse than Company B.”** Comparative performance requires a denominator (accounts, customers, transaction volume) that the dataset does not contain.
- **“Complaints rose N%, indicating a market incident.”** A percentage change is an observed change in reported complaints, not evidence of an incident.
- **“This dataset is a sample of consumer experience.”** It is an observed public complaint dataset.
- **“This customer …”** applied to a public CFPB row. Use complaint record, complaint observation, or issue record.

## 10. Phase 2 / later roadmap

These ideas are intentionally deferred. They are **optional future explorations**, not committed roadmap items.

- **Narrative analysis — optional future exploration, conditional on verified source availability.** Any narrative work is contingent on (a) verifying narrative coverage against the live source at the time of the work, (b) current CFPB publication policy permitting the intended use, and (c) a dedicated safety, provenance, and evaluation plan. Narratives are opt-in, unverified by CFPB, and carry revocable consent, so a narrative snapshot is not reproducible. This item must not be described as planned work, and no narrative ingestion, NLP, sentiment analysis, or LLM processing may be built into the MVP under any framing.
- Organization-authorized private data connectors for CRM, case management, communications, and knowledge bases.
- Closed-loop action outcomes and action-effectiveness measures.
- Twilio, Segment, Flex, CRM, ticketing, or contact-center integration.
- Role-based access control for a multi-tenant commercial application.

## 11. Product acceptance checkpoint

Do not proceed to SQL implementation until the owner can answer:

- What decision is the product allowed to recommend?
- What is the difference between an issue pattern and an individual consumer prediction?
- What condition produces `REQUIRE_HUMAN_REVIEW`?
- What is the evidence displayed with every action?
- Which claims are prohibited in the product UI and portfolio story?
- Why can this product not report how long a company took to respond?
- What does each `signal_confidence` value mean, and what makes a signal `LIMITED`?
- What does `recent_publication_lag_flag` protect against?
- Why is a large percentage increase not evidence of a market incident?
