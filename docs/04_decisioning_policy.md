# Customer Resolution Intelligence — Decisioning Policy

**Status:** Phase 0 — Product contract  
**Owner:** Shem Nyachieo  
**Version:** 1.1  
**Last updated:** August 15, 2026  
**Revision note:** v1.1 removes the dispute policy (its source field does not exist), adds a publication-lag policy, and requires confidence and limitation on every recommendation. See `adr/ADR-004-source-validation-removes-response-duration.md`.

## 1. Purpose

This document defines the deterministic rules used to produce operational priorities and next-best actions. It is designed for explainability, auditability, and human review.

This policy does **not** predict consumer behavior, determine complaint validity, make a financial decision, decide a legal/regulatory outcome, measure response time, or predict complaint resolution.

## 2. Decisioning philosophy

- Prioritize service cases and issue patterns—not people.
- Use observable source fields and documented derived metrics.
- Make every action reversible, inspectable, and attributable to one or more policy rules.
- Prefer `REQUIRE_HUMAN_REVIEW` when data is incomplete, conflicting, or outside policy scope.
- Permit `STANDARD_HANDLING`; not every complaint must be escalated.
- Treat emerging-pattern flags as a prompt for investigation, not a confirmed incident, cause, or conclusion.

## 3. Recommendation definition

A **recommendation** is a deterministic operational suggestion generated from a published complaint record plus approved aggregate trend signals.

A valid recommendation includes:

```text
recommendation_id
complaint_id
priority
recommended_action
policy_ids
reason_codes
evidence_fields
signal_confidence
interpretation_limitation
human_review_required
recent_publication_lag_flag
data_completeness_status
policy_version
model_version
generated_at
```

Every recommendation must carry: a `policy_id`, a `recommended_action`, a `priority`, at least one `reason_code`, the `evidence_fields` that produced it, a `signal_confidence` value, and an `interpretation_limitation` where one applies. A recommendation missing any of these is invalid and must not be emitted.

**"No action" remains a valid outcome.** `STANDARD_HANDLING` is a first-class result. The system must not manufacture escalations to populate a queue.

## 4. Action domain

| Action | Intended operational meaning | Allowed use |
|---|---|---|
| `STANDARD_HANDLING` | Continue normal workflow; no special signal is identified by this product | Routine queue management |
| `PRIORITIZE_CASE_REVIEW` | Move case earlier in a human review queue | Service-quality triage |
| `ESCALATE_REVIEW` | Route to supervisor/specialist workflow | Human-operated escalation |
| `INVESTIGATE_PATTERN` | Review an aggregate issue pattern for possible operational/product investigation | Operations/product investigation |
| `REQUIRE_HUMAN_REVIEW` | Pause automated recommendation because data is incomplete, inconsistent, or policy requires review | Safe fallback |
| `UPDATE_AGENT_GUIDANCE` | Consider updating knowledge, routing, or guidance for a documented aggregate pattern | Human-approved workflow/content change |

## 5. Priority domain

| Priority | Definition | Required handling |
|---|---|---|
| `LOW` | Informational context; no special action | Standard handling |
| `MEDIUM` | Monitor or process within normal operations | Standard handling or manager review based on local process |
| `HIGH` | A documented rule identifies a case or pattern needing prioritized human attention | Human review queue |
| `CRITICAL` | Higher-severity or multiple qualified triggers require immediate human attention | Human escalation workflow |

## 6. Policy rules

The implementation stores these rules in seed files. The table below is the human-readable policy contract.

| Policy ID | Trigger | Priority | Recommended action | Reason code | Confidence | Human review |
|---|---|---:|---|---|---|---:|
| `POLICY_UNTIMELY_RESPONSE` | `timely_response_status = NO` (published CFPB signal) | HIGH | `ESCALATE_REVIEW` | `PUBLISHED_UNTIMELY_RESPONSE` | `HIGH` | Yes |
| `POLICY_EMERGING_ISSUE` | Trend metric meets configured threshold **and** all qualification conditions in §8 are satisfied | HIGH | `INVESTIGATE_PATTERN` | `EMERGING_ISSUE_SIGNAL` | `MEDIUM` | Yes |
| `POLICY_PUBLICATION_LAG` | `recent_publication_lag_flag = TRUE` — the record is within the documented trailing window or its published response status is unresolved | MEDIUM | `REQUIRE_HUMAN_REVIEW` | `RECENT_PUBLICATION_LAG` | `LIMITED` | Yes |
| `POLICY_INCOMPLETE_CONTEXT` | A decision-critical source field is missing/unknown or the model cannot calculate required context | MEDIUM | `REQUIRE_HUMAN_REVIEW` | `INCOMPLETE_CONTEXT` | `LIMITED` | Yes |
| `POLICY_STABLE_PATTERN` | No escalation trigger is active and data is sufficient | LOW | `STANDARD_HANDLING` | `STABLE_PATTERN` | `HIGH` | No |
| `POLICY_CRITICAL_COMBINATION` | Two or more distinct `HIGH` policies triggered on the same record, with complete data, no publication lag, and a qualified pattern signal — see §7.1 | CRITICAL | `ESCALATE_REVIEW` | `MULTIPLE_QUALIFIED_TRIGGERS` *(plus all contributing reason codes)* | lowest of contributors | Yes |

### 6.1 Policy removed in v1.1

| Removed policy | Reason |
|---|---|
| `POLICY_DISPUTED_RESPONSE` | Its trigger field, `consumer_disputed_status`, **does not exist in the source**. The `Consumer disputed?` field was discontinued as a filter in 2017 and removed from CFPB exports entirely in June 2026. No proxy or substitute dispute signal may be constructed. This removes the project's only former `CRITICAL` trigger — see §7. |

### 6.2 Policies that must never exist

No policy may trigger on response duration, resolution duration, time-to-resolution, or handling time. The source publishes no company response timestamp, so any such rule would be triggering on a fabricated measure.

`POLICY_UNTIMELY_RESPONSE` is named for the **published** CFPB timeliness signal and must not be described, documented, or displayed as a response-time rule. Note also that this signal is near-degenerate — 99.38% of records are `Yes` — so it fires on roughly 0.62% of records.

## 7. Precedence and conflict rules

A complaint may trigger more than one policy. The final recommendation must apply the following precedence:

1. `POLICY_INCOMPLETE_CONTEXT` takes precedence when data quality prevents safe interpretation. Final action: `REQUIRE_HUMAN_REVIEW`.
2. `POLICY_PUBLICATION_LAG` takes precedence over any policy that reads a published response-status field. A record whose response status is unresolved must not be escalated on the basis of that status. Final action: `REQUIRE_HUMAN_REVIEW`.
3. `POLICY_UNTIMELY_RESPONSE` and `POLICY_EMERGING_ISSUE` may both apply. Final priority is the highest applicable priority; final action is selected by the action-precedence mapping and **all** reasons must be retained.
4. `POLICY_STABLE_PATTERN` applies only when no higher rule triggers.

**Confidence propagation.** When multiple policies apply, the final `signal_confidence` is the **lowest** confidence among triggered policies. Confidence never improves through combination. If any triggered policy carries `LIMITED`, the recommendation carries `LIMITED` and must populate `interpretation_limitation`.

**`CRITICAL` is reached by trigger combination, not by any single rule.** See §7.1.

The `int_priority_policy_application` model must retain one row per complaint record × evaluated policy. The `resolution_action_queue` model must retain the final selected action plus all triggered policy IDs, reason codes, evidence fields, confidence, and limitation text.

## 7.1 Escalation to `CRITICAL` — combination policy

Removing `POLICY_DISPUTED_RESPONSE` removed the only rule that produced `CRITICAL` on its own. Rather than retire the priority level or attach it arbitrarily to a single rule, `CRITICAL` is now defined as an explicit **combination** outcome. This is the more defensible design: a single published signal rarely justifies immediate escalation, whereas two independent qualified signals converging on the same complaint record does.

### `POLICY_CRITICAL_COMBINATION`

| Attribute | Value |
|---|---|
| Policy ID | `POLICY_CRITICAL_COMBINATION` |
| Priority | `CRITICAL` |
| Recommended action | `ESCALATE_REVIEW` |
| Reason code | `MULTIPLE_QUALIFIED_TRIGGERS` (retained **in addition to** the reason codes of every contributing policy) |
| Confidence | Lowest confidence among contributing policies |
| Human review | Yes |

**Trigger condition — all four must hold:**

1. **Two or more distinct `HIGH`-priority policies are triggered** on the same complaint record. In the current policy set the qualifying pair is `POLICY_UNTIMELY_RESPONSE` + `POLICY_EMERGING_ISSUE`.
2. **`data_completeness_status = COMPLETE`.** An incomplete record escalates to `REQUIRE_HUMAN_REVIEW`, never to `CRITICAL`.
3. **`recent_publication_lag_flag = FALSE`.** A record whose response status is still unresolved must never reach `CRITICAL` — this is the precise scenario in which publication lag would masquerade as a service failure.
4. **The contributing emerging-issue signal carries `issue_pattern_status = QUALIFIED_SIGNAL`.** An unqualified or insufficient-baseline signal does not count toward the combination.

**Seed configuration:**

```csv
policy_id,min_triggered_high_policies,require_complete_data,require_no_publication_lag,require_qualified_pattern,priority,action
POLICY_CRITICAL_COMBINATION,2,TRUE,TRUE,TRUE,CRITICAL,ESCALATE_REVIEW
```

**Precedence.** `POLICY_CRITICAL_COMBINATION` is evaluated **after** the rules in §7 and only when neither `POLICY_INCOMPLETE_CONTEXT` nor `POLICY_PUBLICATION_LAG` has fired. It cannot override the safe-fallback rules; conditions 2 and 3 make that structurally impossible.

**Expected frequency.** `POLICY_UNTIMELY_RESPONSE` fires on ~0.62% of records, and a qualified emerging-issue signal covers a small share of the taxonomy at any time. The intersection is therefore expected to be **rare** — which is the intended behavior for a `CRITICAL` designation. A `CRITICAL` volume that is not rare indicates a policy-configuration error, not a genuine surge.

**Required tests:**

| Test | Assertion |
|---|---|
| `test_critical_requires_qualified_triggers` | No row has `priority = CRITICAL` without ≥2 triggered `HIGH` policies recorded in `int_priority_policy_application` |
| `test_critical_excludes_incomplete` | No row has `priority = CRITICAL` with `data_completeness_status != COMPLETE` |
| `test_critical_excludes_publication_lag` | No row has `priority = CRITICAL` with `recent_publication_lag_flag = TRUE` |
| `test_critical_retains_all_reasons` | Every `CRITICAL` row carries `MULTIPLE_QUALIFIED_TRIGGERS` plus the reason code of each contributing policy |
| `test_critical_rarity` | `CRITICAL` share of the queue does not exceed the seed-configured sanity ceiling; breach fails the build for review |

## 8. Emerging-issue policy

### Initial MVP policy

A percentage increase alone is **never** sufficient to raise an emerging-issue signal. An `EMERGING_ISSUE` signal may be generated only when all conditions are met:

1. The current observation has an approved trend grain, initially `date × product × issue`.
2. The defined current window contains at least the seed-configured minimum complaint count.
3. The percentage change versus the **documented baseline** meets or exceeds the seed-configured threshold.
4. The baseline window itself contains at least the seed-configured minimum volume — a change measured against a near-zero baseline is `INSUFFICIENT_BASELINE`, not a signal.
5. Records within the window are not predominantly affected by `recent_publication_lag_flag`.
6. Source completeness is sufficient.
7. The output is labeled an **emerging signal** or **pattern requiring investigation**, never a confirmed incident, market event, or root cause.

### Required output fields

Every emerging-issue evaluation must expose all of the following together. Publishing the percentage change without its companions is prohibited.

| Field | Purpose |
|---|---|
| `issue_volume_current` | Current observed volume |
| `baseline_volume` | Documented baseline volume |
| `volume_change_pct` | Change versus baseline |
| `observed_share_pct` | This grain's share of all observed complaints in the window |
| `issue_pattern_status` | `QUALIFIED_SIGNAL`, `UNQUALIFIED_SIGNAL`, `INSUFFICIENT_BASELINE`, `NO_SIGNAL` |
| `signal_confidence` | Interpretation status |
| `interpretation_limitation` | Written limitation |

### Category concentration qualification

Observed complaint volume is heavily concentrated: credit-reporting categories account for roughly 81% of all published records, and the CFPB has publicly stated that volume in these categories is materially affected by third-party submission behavior.

Therefore:

- Trend evaluation must be performed **within** a product category, not across the whole dataset, so that concentration does not dominate every signal.
- `observed_share_pct` must accompany every signal so a reviewer can see whether a large percentage change sits on a large or trivial base.
- A signal arising in a category the CFPB has flagged for submission-behavior distortion must carry `signal_confidence = LIMITED` and a written limitation.
- **A large percentage increase must never be surfaced as evidence of an actual market incident.** It is a change in reported and published complaint volume. External reporting behavior, submission-pattern changes, and third-party filing activity are all sufficient to produce one.

### Initial seed example

```csv
policy_id,trend_grain,current_window_days,baseline_window_days,min_current_volume,min_baseline_volume,minimum_pct_change,priority,action
POLICY_EMERGING_ISSUE,product_issue,7,30,20,50,0.30,HIGH,INVESTIGATE_PATTERN
```

The initial values are illustrative project policy choices, not CFPB thresholds, industry standards, or evidence of harm. They must be shown in documentation and configurable through seeds.

## 9. Data completeness policy

`data_completeness_status` values:

| Status | Meaning | Decision effect |
|---|---|---|
| `COMPLETE` | Required source and derived fields are present for the applied rule | Normal policy evaluation allowed |
| `PARTIAL` | Some non-critical fields are missing | Policy can proceed only if rule-specific requirements are met; include caveat |
| `INSUFFICIENT` | Critical field(s) are missing, invalid, or incompatible with policy | `REQUIRE_HUMAN_REVIEW` |

`PARTIAL` is mandatory when `recent_publication_lag_flag` is true.

Decision-critical fields vary by policy. Examples:

- Untimely-response policy requires a known published timeliness status.
- Emerging-issue policy requires valid date, product, issue, baseline volume, and trend-window metrics.
- Any policy reading a published response-status field requires that the record is **not** flagged for publication lag.

### 9.1 Publication-lag rule

A record carries `recent_publication_lag_flag = TRUE` when **either** condition holds:

1. `date_received` falls within the **trailing 60 days** of `source_snapshot_date`; **or**
2. `company_response = 'In progress'` at any age.

**Window selection.** 60 days is set from measurement, not convention:

| Window (by `date_received`) | Share still `In progress` |
|---|---:|
| Last 7 days | 88.52% |
| 30–60 days prior | 33.94% |
| ~12 months prior | 0.00% |
| Whole database | 3.55% |

A third of complaints remain unresolved one to two months after receipt, so a 30-day window would leave a large body of structurally incomplete records unflagged. Resolution is effectively complete well before twelve months. 60 days covers the observed incompleteness without flagging so much of the dataset that the control loses meaning.

The window is a **seed parameter**, not a hard-coded value:

```csv
policy_id,publication_lag_window_days
POLICY_PUBLICATION_LAG,60
```

It must be re-validated whenever the source audit is re-run; CFPB publication timing may change.

This is an artifact of CFPB publication timing, not company behavior.

Accordingly:

- Response-status metrics aggregating flagged records are **directional only** and must be labelled as such.
- **A high count of `In progress` records must never be interpreted, displayed, or described as evidence of poor company performance, slow response, or service failure.**
- Flagged records must not be escalated on the basis of their response status.

## 10. Reason-code rules

- Every non-`STANDARD_HANDLING` recommendation must contain one or more reason codes.
- Reason codes must describe observable conditions, not conclusions about intent, guilt, risk, or consumer behavior.
- Approved reason codes: `PUBLISHED_UNTIMELY_RESPONSE`, `EMERGING_ISSUE_SIGNAL`, `RECENT_PUBLICATION_LAG`, `INCOMPLETE_CONTEXT`, `STABLE_PATTERN`, `MULTIPLE_QUALIFIED_TRIGGERS`.
- **Retired in v1.1:** `CONSUMER_DISPUTED` (source field does not exist), `LATE_RESPONSE` (renamed to `PUBLISHED_UNTIMELY_RESPONSE` to prevent reading it as a measured delay).
- Prohibited reason codes: `HIGH_RISK_CUSTOMER`, `LIKELY_FRAUD`, `BAD_COMPANY`, `INVALID_COMPLAINT`, `SLOW_RESPONSE`, `LONG_RESOLUTION_TIME`, `DISSATISFIED_CUSTOMER`, `ROOT_CAUSE_IDENTIFIED`, and any code naming a duration, a satisfaction state, a cause, or a person.

## 11. Deterministic context summary

The MVP `context_summary` must use a deterministic template built from approved structured and derived fields. Example:

> Complaint record {complaint_id}, received {date_received}, concerns {product} / {issue}. Published response status: {company_response}. Published timeliness signal: {timely_response_status}. The related issue pattern is {issue_pattern_status}, based on {issue_volume_current} observed complaints against a baseline of {baseline_volume} over the configured {trend_window}-day comparison ({volume_change_pct} change; {observed_share_pct} of observed complaints in this window). Confidence: {signal_confidence}. Recommended operational action: {recommended_action}. Reasons: {reason_codes}. Limitation: {interpretation_limitation}.

The template must not contain any dispute status, any duration, any satisfaction or cause statement, or the word "customer" applied to the record.

Do not use generative AI to create summaries in the MVP.

## 12. Prohibited policy behavior

The policy must not:

- Infer a consumer’s identity, income, creditworthiness, vulnerability, or likely behavior.
- Decide an outcome, refund, compensation, account restriction, credit action, or legal response.
- Use protected characteristics or proxies for them, including the source `tags` field.
- Treat complaint volume as proof of misconduct or comparative company quality.
- Hide unknown values by defaulting them to a favorable or unfavorable state.
- Issue a customer-facing message or communication.
- **Compute, store, or trigger on any response duration or resolution duration.**
- **Interpret `In progress` records as evidence of poor company performance.**
- **Surface a percentage change as evidence of a market incident.**
- Infer customer satisfaction, sentiment, root cause, or prevalence.
- Describe a complaint record as a customer or consumer profile.
- Manufacture numerical statistical confidence intervals or significance claims. `signal_confidence` is a qualitative interpretation status.

## 13. Policy versioning and change control

- Every policy has a stable `policy_id`.
- Thresholds and action mapping live in version-controlled dbt seed files.
- Material changes require an ADR, test updates, documentation updates, and a reviewed pull request.
- Final records must include `policy_version` or a comparable configuration/version identifier.
- Historical recommendation results must be reproducible against the policy version used at generation time.
