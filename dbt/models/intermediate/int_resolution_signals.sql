-- model: int_resolution_signals.sql
-- purpose: Attach record-level published and derived resolution signals —
--          joins each complaint record to the trend context for its own
--          date x product x issue grain.
-- grain: 1 published complaint record
-- inputs: int_complaint_status_context, int_issue_trends
-- outputs: int_priority_policy_application
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: No duration inputs. timely_response_status is a published
--              category, not a measured interval. A complaint's trend
--              context reflects an aggregate pattern for its date x product
--              x issue grain, not a fact about the individual complaint.
-- decision record: docs/adr/ADR-004-source-validation-removes-response-duration.md

with complaints as (

    select * from {{ ref('int_complaint_status_context') }}

),

trends as (

    select * from {{ ref('int_issue_trends') }}

),

joined as (

    select
        c.complaint_id,
        c.complaint_received_date,
        c.cfpb_routing_date,
        c.product,
        c.sub_product,
        c.issue,
        c.sub_issue,
        c.company,
        c.state,
        c.submitted_via,
        c.company_response,
        c.timely_response_status,
        c.company_public_response,
        c.has_narrative,
        c.recent_publication_lag_flag,
        c.data_completeness_status,

        -- Trend context for this complaint's date x product x issue grain.
        -- A left join: a complaint whose exact grain has no trend row (for
        -- example the earliest dates, before a full baseline window exists)
        -- still gets a record here, with the trend fields null and
        -- INSUFFICIENT_BASELINE-equivalent handling left to the policy layer.
        t.issue_volume_current,
        t.baseline_volume,
        t.volume_change_pct,
        t.observed_share_pct,
        t.issue_pattern_status,
        t.policy_id                                               as trend_policy_id

    from complaints c
    left join trends t
        on c.complaint_received_date = t.metric_date
       and c.product = t.product
       and c.issue = t.issue

)

select * from joined
