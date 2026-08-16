-- model: fct_issue_daily_metrics.sql
-- purpose: Trusted daily operational metric layer.
-- grain: 1 calendar date x product x issue
-- inputs: int_issue_trends
-- outputs: operations_overview_metrics
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: Observed counts only. Every row carries observed_share_pct
--              alongside volume_change_pct so a reviewer can see whether a
--              percentage change sits on a large or trivial base. Never a
--              market-wide measure. daily_complaint_count is the true,
--              non-overlapping per-date count — safe to SUM() across dates.
--              issue_volume_current is a trailing rolling-window sum — safe
--              to display standalone, NOT safe to sum across dates. A
--              consumer wanting "total volume over a window" must use
--              daily_complaint_count, never issue_volume_current.
-- decision record: docs/09_supported_vs_unsupported_metrics.md

with trends as (

    select * from {{ ref('int_issue_trends') }}

),

metrics as (

    select
        metric_date,
        product,
        issue,
        daily_complaint_count,
        issue_volume_current,
        baseline_volume,
        volume_change_pct,
        observed_share_pct,
        issue_pattern_status,
        policy_id,
        current_timestamp()                                       as generated_at

    from trends

)

select * from metrics
