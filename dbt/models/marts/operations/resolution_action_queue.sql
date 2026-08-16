-- model: resolution_action_queue.sql
-- purpose: Prioritized, auditable operational action queue.
-- grain: 1 published complaint record x final recommendation run/version
-- inputs: int_priority_policy_application, int_resolution_signals
-- outputs: Curated demo export
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: Every non-standard action requires policy_id, reason_code,
--              evidence_fields, and signal_confidence. STANDARD_HANDLING is
--              a valid outcome — the system does not manufacture escalations
--              to populate the queue. No field expresses response or
--              resolution duration.
-- decision record: docs/04_decisioning_policy.md §3, §7, §7.1

with policies as (

    select * from {{ ref('int_priority_policy_application') }}

),

signals as (

    select * from {{ ref('int_resolution_signals') }}

),

-- One row per complaint: every triggered policy's id/reason, and the
-- weakest (lowest) confidence among them, per docs/04_decisioning_policy.md
-- §7 — "confidence never improves through combination."
triggered_rollup as (

    select
        complaint_id,
        array_agg(policy_id) within group (order by policy_id)      as triggered_policy_ids,
        array_agg(reason_code) within group (order by policy_id)     as triggered_reason_codes,

        -- Confidence rank: HIGH=4 (strongest) down to NOT_SUPPORTED=1
        -- (weakest). MIN(rank) then maps back to the weakest confidence
        -- actually present among triggered policies for this complaint.
        min(
            case signal_confidence
                when 'HIGH' then 4
                when 'MEDIUM' then 3
                when 'LIMITED' then 2
                when 'NOT_SUPPORTED' then 1
            end
        )                                                            as min_confidence_rank,

        max(case when policy_id = 'POLICY_INCOMPLETE_CONTEXT' and triggered then true else false end)     as incomplete_triggered,
        max(case when policy_id = 'POLICY_PUBLICATION_LAG' and triggered then true else false end)        as lag_triggered,
        max(case when policy_id = 'POLICY_CRITICAL_COMBINATION' and triggered then true else false end)   as critical_triggered,
        max(case when policy_id = 'POLICY_UNTIMELY_RESPONSE' and triggered then true else false end)      as untimely_triggered,
        max(case when policy_id = 'POLICY_EMERGING_ISSUE' and triggered then true else false end)         as emerging_triggered

    from policies
    where triggered
    group by complaint_id

),

-- ---------------------------------------------------------------------------
-- Precedence waterfall, per docs/04_decisioning_policy.md §7:
--   1. INCOMPLETE_CONTEXT — data quality prevents safe interpretation
--   2. PUBLICATION_LAG — response status may be incomplete; never escalate
--      on a status that might still change
--   3. CRITICAL_COMBINATION — two qualified HIGH triggers converge, and
--      neither of the above blocked it
--   4. A single HIGH trigger (untimely OR emerging, not both — if both fired
--      with no block, CRITICAL_COMBINATION already claimed this case)
--   5. STABLE_PATTERN — nothing else triggered
-- ---------------------------------------------------------------------------

final_action as (

    select
        s.complaint_id,
        s.complaint_received_date,
        s.product,
        s.issue,
        s.company_response,
        s.timely_response_status,
        s.recent_publication_lag_flag,
        s.data_completeness_status,
        s.issue_volume_current,
        s.baseline_volume,
        s.volume_change_pct,
        s.observed_share_pct,
        s.issue_pattern_status,

        r.triggered_policy_ids,
        r.triggered_reason_codes,
        r.min_confidence_rank,

        case
            when r.incomplete_triggered then 'MEDIUM'
            when r.lag_triggered        then 'MEDIUM'
            when r.critical_triggered   then 'CRITICAL'
            when r.untimely_triggered   then 'HIGH'
            when r.emerging_triggered   then 'HIGH'
            else 'LOW'
        end                                                          as priority,

        case
            when r.incomplete_triggered then 'REQUIRE_HUMAN_REVIEW'
            when r.lag_triggered        then 'REQUIRE_HUMAN_REVIEW'
            when r.critical_triggered   then 'ESCALATE_REVIEW'
            when r.untimely_triggered   then 'ESCALATE_REVIEW'
            when r.emerging_triggered   then 'INVESTIGATE_PATTERN'
            else 'STANDARD_HANDLING'
        end                                                          as recommended_action

    from signals s
    left join triggered_rollup r
        on s.complaint_id = r.complaint_id

),

with_confidence as (

    select
        *,
        case min_confidence_rank
            when 4 then 'HIGH'
            when 3 then 'MEDIUM'
            when 2 then 'LIMITED'
            when 1 then 'NOT_SUPPORTED'
            else 'HIGH'  -- fallback: STABLE_PATTERN is the only always-on trigger and carries HIGH
        end                                                          as signal_confidence

    from final_action

),

final as (

    select
        {{ dbt_utils.generate_surrogate_key(['complaint_id', "'" ~ var('model_version') ~ "'"]) }}
            as recommendation_id,
        complaint_id,
        priority,
        recommended_action,
        triggered_reason_codes                                      as reason_codes,
        triggered_policy_ids                                        as policy_ids,

        -- Evidence: the actual signal values that produced this
        -- recommendation, not just their names. This is what a reviewer or
        -- a downstream agent reads to understand "why."
        object_construct(
            'timely_response_status', timely_response_status,
            'company_response', company_response,
            'issue_pattern_status', issue_pattern_status,
            'issue_volume_current', issue_volume_current,
            'baseline_volume', baseline_volume,
            'volume_change_pct', volume_change_pct,
            'observed_share_pct', observed_share_pct,
            'data_completeness_status', data_completeness_status,
            'recent_publication_lag_flag', recent_publication_lag_flag
        )                                                            as evidence_fields,

        signal_confidence,

        case
            when recent_publication_lag_flag then
                'Response status may be incomplete: this record falls within '
                || 'the trailing publication-lag window. Treat any response-'
                || 'status signal as directional, not final.'
            when signal_confidence = 'LIMITED' then
                'This recommendation is affected by a documented source '
                || 'coverage or completeness limitation. See '
                || 'docs/06_known_limitations.md.'
            else null
        end                                                          as interpretation_limitation,

        (recommended_action != 'STANDARD_HANDLING')                  as human_review_required,
        recent_publication_lag_flag,
        data_completeness_status,
        current_date()                                                as source_snapshot_date,
        '{{ var("policy_version") }}'                                as policy_version,
        '{{ var("model_version") }}'                                 as model_version,
        current_timestamp()                                          as generated_at

    from with_confidence

)

select * from final
