-- model: int_issue_daily_volume.sql
-- purpose: Calculate daily observed complaint-volume counts by approved
--          analysis dimensions.
-- grain: 1 calendar date x product x issue
-- inputs: int_complaint_status_context
-- outputs: int_issue_trends
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: An observed count of published complaints, not a rate and
--              not a market measure. See docs/09_supported_vs_unsupported_metrics.md.
-- decision record: docs/04_decisioning_policy.md §8

with complaints as (

    select * from {{ ref('int_complaint_status_context') }}

),

daily_volume as (

    select
        complaint_received_date                                 as metric_date,
        product,
        issue,
        count(*)                                                  as complaint_count,
        count_if(recent_publication_lag_flag)                    as lag_flagged_count

    from complaints
    where complaint_received_date is not null
      and product is not null
      and issue is not null
    group by 1, 2, 3

)

select * from daily_volume
