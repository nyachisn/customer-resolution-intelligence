-- test: assert_daily_volume_reconciles
-- asserts: fct_issue_daily_metrics.daily_complaint_count, summed across every
--          date for a given product x issue, equals the true complaint-level
--          count for that grain — proving it is a non-overlapping daily
--          count and safe to sum across a date range, unlike
--          issue_volume_current (a trailing rolling-window sum, which this
--          test deliberately does NOT check against the same reconciliation,
--          since summing it across dates is expected to overcount).
-- enforces: the 2026-08-16 fix to operations_overview_metrics.sql —
--           Operations Overview's "Complaint volume by product" was
--           previously built by summing issue_volume_current (a trailing
--           7-day rolling sum) across every date in the export window,
--           double- and multi-counting every complaint up to 7 times. See
--           docs/09_supported_vs_unsupported_metrics.md §4.1 and the header
--           comments in dbt/models/intermediate/int_issue_trends.sql and
--           dbt/models/marts/operations/operations_overview_metrics.sql.
--
-- Returns rows (the grain and the mismatched counts) on FAILURE.

with daily_metrics_rollup as (

    select
        product,
        issue,
        sum(daily_complaint_count) as summed_daily_count
    from {{ ref('fct_issue_daily_metrics') }}
    group by 1, 2

),

true_complaint_count as (

    select
        product,
        issue,
        count(*) as actual_complaint_count
    from {{ ref('int_complaint_status_context') }}
    where product is not null
      and issue is not null
    group by 1, 2

),

compared as (

    select
        coalesce(d.product, t.product) as product,
        coalesce(d.issue, t.issue)     as issue,
        d.summed_daily_count,
        t.actual_complaint_count
    from daily_metrics_rollup d
    full outer join true_complaint_count t
        on d.product = t.product
       and d.issue = t.issue

)

select *
from compared
where summed_daily_count is distinct from actual_complaint_count
