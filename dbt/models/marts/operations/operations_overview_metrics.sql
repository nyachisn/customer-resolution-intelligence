-- model: operations_overview_metrics.sql
-- purpose: Curated aggregate display metrics for the demo.
-- grain: 1 metric date x dashboard dimension x metric name
-- inputs: fct_issue_daily_metrics, resolution_action_queue
-- outputs: Curated demo export
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: Every metric here must appear as Supported in
--              docs/09_supported_vs_unsupported_metrics.md. Context notes
--              (docs/02_data_provenance.md §9) are attached by the export
--              script, not baked into the numbers themselves.
--              FIXED 2026-08-16: complaint_volume previously sourced from
--              issue_volume_current (a trailing 7-day rolling sum), summed
--              across every date in the application's export window — a
--              real double-counting defect, since the same complaint was
--              counted in up to 7 different rows before the app's own sum.
--              Now sourced from daily_complaint_count, the true per-date
--              count, which is safe to sum across a date range. See
--              dbt/models/intermediate/int_issue_trends.sql and
--              docs/09_supported_vs_unsupported_metrics.md §4.1.
-- decision record: docs/09_supported_vs_unsupported_metrics.md

with daily_metrics as (

    select * from {{ ref('fct_issue_daily_metrics') }}

),

action_queue as (

    select * from {{ ref('resolution_action_queue') }}

),

-- Complaint volume by date x product — the core, unconditionally supported
-- measure (docs/09_supported_vs_unsupported_metrics.md). Sourced from
-- daily_complaint_count (true per-date count), NOT issue_volume_current
-- (rolling 7-day sum) — see the model header for why this distinction is
-- load-bearing here specifically: this metric is the one place downstream
-- consumers sum across dates, which only daily_complaint_count supports.
volume_metric as (

    select
        metric_date,
        product                                                   as dashboard_dimension,
        'complaint_volume'                                        as metric_name,
        daily_complaint_count                                     as metric_value,
        current_timestamp()                                       as generated_at
    from daily_metrics

),

-- Emerging-pattern signal counts by date x product, qualified signals only.
emerging_metric as (

    select
        metric_date,
        product                                                   as dashboard_dimension,
        'emerging_issue_count'                                    as metric_name,
        count(*)                                                  as metric_value,
        current_timestamp()                                       as generated_at
    from daily_metrics
    where issue_pattern_status = 'QUALIFIED_SIGNAL'
    group by 1, 2

),

-- Action counts by date x recommended action, from the queue.
action_count_metric as (

    select
        source_snapshot_date                                       as metric_date,
        recommended_action                                         as dashboard_dimension,
        'action_count'                                             as metric_name,
        count(*)                                                   as metric_value,
        current_timestamp()                                       as generated_at
    from action_queue
    group by 1, 2

),

combined as (

    select * from volume_metric
    union all
    select * from emerging_metric
    union all
    select * from action_count_metric

)

select * from combined
