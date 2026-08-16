-- model: agent_case_context.sql
-- purpose: Provide a compact, agent-safe view of the complaint record's
--          structured source context, derived pattern signals, policy
--          evaluation outcomes, confidence, and constraints.
-- grain: 1 published complaint record
-- inputs: int_priority_policy_application, int_issue_trends, fct_complaints,
--         resolution_action_queue
-- outputs: Curated demo export
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: No narrative text. No dispute field. No duration.
--              Deterministic context_summary template only — no generative
--              text in the MVP. See docs/04_decisioning_policy.md §11.
-- decision record: docs/03_data_dictionary.md §6

with complaints as (

    select * from {{ ref('fct_complaints') }}

),

signals as (

    select * from {{ ref('int_resolution_signals') }}

),

actions as (

    select * from {{ ref('resolution_action_queue') }}

),

joined as (

    select
        c.complaint_id,
        c.complaint_received_date,
        c.product,
        c.sub_product,
        c.issue,
        c.sub_issue,
        c.submitted_via,
        c.company_response,
        c.timely_response_status,
        c.company_public_response,
        c.has_narrative,

        s.issue_volume_current,
        s.baseline_volume,
        s.volume_change_pct,
        s.observed_share_pct,
        s.issue_pattern_status,

        c.recent_publication_lag_flag,
        c.data_completeness_status,

        a.signal_confidence,
        a.interpretation_limitation,
        a.priority,
        a.recommended_action,
        a.reason_codes,
        a.policy_ids,
        a.generated_at

    from complaints c
    left join signals s
        on c.complaint_id = s.complaint_id
    left join actions a
        on c.complaint_id = a.complaint_id

),

-- Deterministic template per docs/04_decisioning_policy.md §11. No
-- generative text. Must not contain dispute status, duration, satisfaction,
-- cause, or the word "customer" applied to the record.
with_summary as (

    select
        *,
        'Complaint record ' || complaint_id
            || ', received ' || complaint_received_date::string
            || ', concerns ' || product || ' / ' || issue || '. '
            || 'Published response status: ' || coalesce(company_response, 'unknown') || '. '
            || 'Published timeliness signal: ' || timely_response_status || '. '
            || 'The related issue pattern is ' || coalesce(issue_pattern_status, 'NO_SIGNAL')
            || ', based on ' || coalesce(issue_volume_current::string, 'unknown') || ' observed complaints '
            || 'against a baseline of ' || coalesce(round(baseline_volume, 1)::string, 'unknown')
            || ' over the configured {{ var("emerging_issue_current_window_days") }}-day comparison'
            || coalesce(' (' || round(volume_change_pct * 100, 1)::string || '% change; '
                || round(observed_share_pct * 100, 2)::string || '% of observed complaints in this window)', '') || '. '
            || 'Confidence: ' || coalesce(signal_confidence, 'unknown') || '. '
            || 'Recommended operational action: ' || coalesce(recommended_action, 'unknown') || '. '
            || 'Reasons: ' || coalesce(array_to_string(reason_codes, ', '), 'none') || '.'
            || coalesce(' Limitation: ' || interpretation_limitation, '')
            as context_summary

    from joined

)

select * from with_summary
