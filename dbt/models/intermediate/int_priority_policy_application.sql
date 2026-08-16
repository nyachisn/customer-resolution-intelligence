-- model: int_priority_policy_application.sql
-- purpose: Evaluate every policy rule against every complaint record and
--          retain each trigger state — one row per complaint x policy
--          evaluated, not just per policy triggered.
-- grain: 1 published complaint record x policy rule evaluated
-- inputs: int_resolution_signals, seed priority_policy_thresholds (values
--         mirrored as dbt_project.yml vars for POLICY_EMERGING_ISSUE — the
--         trigger for that policy is int_issue_trends.issue_pattern_status,
--         already computed against those thresholds)
-- outputs: agent_case_context, resolution_action_queue
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: Precedence and final-action selection happen downstream in
--              resolution_action_queue.sql, per docs/04_decisioning_policy.md
--              §7 — this model preserves every evaluated policy's trigger
--              state, triggered or not, so the full evaluation is auditable.
-- decision record: docs/04_decisioning_policy.md §6

with signals as (

    select * from {{ ref('int_resolution_signals') }}

),

triggers as (

    select
        complaint_id,

        -- Boolean trigger state per rule, computed once, reused below.
        -- See docs/04_decisioning_policy.md §6 for the trigger definitions.
        (timely_response_status = 'NO')                          as is_untimely,
        (issue_pattern_status = 'QUALIFIED_SIGNAL')               as is_emerging,
        recent_publication_lag_flag                               as is_lagged,
        (data_completeness_status != 'COMPLETE')                  as is_incomplete

    from signals

),

-- ---------------------------------------------------------------------------
-- One row per (complaint_id, policy_id). Every policy is evaluated for every
-- complaint; `triggered` records whether the rule fired. Static per-policy
-- metadata (priority, action, reason_code, confidence, human_review_required)
-- mirrors seeds/resolution_action_playbook.csv and
-- seeds/priority_policy_thresholds.csv, kept here as literals because this
-- is the layer where trigger logic and policy metadata need to live
-- together to stay auditable in one place.
-- ---------------------------------------------------------------------------

policy_untimely_response as (
    select
        complaint_id, 'POLICY_UNTIMELY_RESPONSE' as policy_id, is_untimely as triggered,
        'HIGH' as priority, 'ESCALATE_REVIEW' as recommended_action,
        'PUBLISHED_UNTIMELY_RESPONSE' as reason_code, 'HIGH' as signal_confidence,
        true as human_review_required
    from triggers
),

policy_emerging_issue as (
    select
        complaint_id, 'POLICY_EMERGING_ISSUE' as policy_id, is_emerging as triggered,
        'HIGH' as priority, 'INVESTIGATE_PATTERN' as recommended_action,
        'EMERGING_ISSUE_SIGNAL' as reason_code, 'MEDIUM' as signal_confidence,
        true as human_review_required
    from triggers
),

policy_publication_lag as (
    select
        complaint_id, 'POLICY_PUBLICATION_LAG' as policy_id, is_lagged as triggered,
        'MEDIUM' as priority, 'REQUIRE_HUMAN_REVIEW' as recommended_action,
        'RECENT_PUBLICATION_LAG' as reason_code, 'LIMITED' as signal_confidence,
        true as human_review_required
    from triggers
),

policy_incomplete_context as (
    select
        complaint_id, 'POLICY_INCOMPLETE_CONTEXT' as policy_id, is_incomplete as triggered,
        'MEDIUM' as priority, 'REQUIRE_HUMAN_REVIEW' as recommended_action,
        'INCOMPLETE_CONTEXT' as reason_code, 'LIMITED' as signal_confidence,
        true as human_review_required
    from triggers
),

-- Triggered only when none of the four escalation policies above fired.
policy_stable_pattern as (
    select
        complaint_id, 'POLICY_STABLE_PATTERN' as policy_id,
        (not is_untimely and not is_emerging and not is_lagged and not is_incomplete) as triggered,
        'LOW' as priority, 'STANDARD_HANDLING' as recommended_action,
        'STABLE_PATTERN' as reason_code, 'HIGH' as signal_confidence,
        false as human_review_required
    from triggers
),

-- Combination policy. Confidence is hard-coded MEDIUM: the only two HIGH-
-- priority policies today are UNTIMELY_RESPONSE (confidence HIGH) and
-- EMERGING_ISSUE (confidence MEDIUM), so the "lowest of contributors" rule
-- in docs/04_decisioning_policy.md §7.1 always resolves to MEDIUM under the
-- current policy set. If a third HIGH-priority policy is ever added, this
-- must become a computed least() over the actual contributors — do not
-- leave the hard-code in place past that change.
policy_critical_combination as (
    select
        complaint_id, 'POLICY_CRITICAL_COMBINATION' as policy_id,
        (is_untimely and is_emerging and not is_lagged and not is_incomplete) as triggered,
        'CRITICAL' as priority, 'ESCALATE_REVIEW' as recommended_action,
        'MULTIPLE_QUALIFIED_TRIGGERS' as reason_code, 'MEDIUM' as signal_confidence,
        true as human_review_required
    from triggers
),

unioned as (
    select * from policy_untimely_response
    union all
    select * from policy_emerging_issue
    union all
    select * from policy_publication_lag
    union all
    select * from policy_incomplete_context
    union all
    select * from policy_stable_pattern
    union all
    select * from policy_critical_combination
)

select * from unioned
