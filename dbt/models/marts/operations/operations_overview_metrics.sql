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
-- decision record: docs/09_supported_vs_unsupported_metrics.md

with daily_metrics as (

    select * from {{ ref('fct_issue_daily_metrics') }}

),

action_queue as (

    select * from {{ ref('resolution_action_queue') }}

),

-- Complaint volume by date x product — the core, unconditionally supported
-- measure (docs/09_supported_vs_unsupported_metrics.md).
volume_metric as (

    select
        metric_date,
        product                                                   as dashboard_dimension,
        'complaint_volume'                                        as metric_name,
        issue_volume_current                                      as metric_value,
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
