-- model: int_issue_trends.sql
-- purpose: Calculates deterministic issue-volume trend measures — current
--          window, baseline, percentage change, observed share, and pattern
--          qualification.
-- grain: 1 calendar date x product x issue x trend policy (POLICY_EMERGING_ISSUE)
-- inputs: int_issue_daily_volume, dbt_project.yml vars (mirroring seed
--         priority_policy_thresholds.csv, POLICY_EMERGING_ISSUE row)
-- outputs: int_resolution_signals, fct_issue_daily_metrics, operations marts
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: Counts are not normalized for company size or market share.
--              Evaluated within product category, not across the whole
--              dataset, because ~81% of the dataset is credit-reporting
--              categories (docs/08_source_quality_report.md §6) and an
--              across-dataset comparison would be dominated by that
--              concentration. A percentage change is never evidence of a
--              market incident on its own — see the qualification logic below.
-- decision record: docs/04_decisioning_policy.md §8

{% set current_days = var('emerging_issue_current_window_days') %}
{% set baseline_days = var('emerging_issue_baseline_window_days') %}
{% set min_current = var('emerging_issue_min_current_volume') %}
{% set min_baseline = var('emerging_issue_min_baseline_volume') %}
{% set min_pct_change = var('emerging_issue_min_pct_change') %}

with daily_by_issue as (

    select * from {{ ref('int_issue_daily_volume') }}

),

-- Total observed volume per date, across ALL products/issues, for the
-- observed_share_pct denominator. Computed once here rather than per row.
daily_total as (

    select
        metric_date,
        sum(complaint_count) as total_complaint_count
    from daily_by_issue
    group by 1

),

windowed as (

    select
        d.metric_date,
        d.product,
        d.issue,
        d.complaint_count,

        -- Current window: trailing N calendar days including today, within
        -- this product x issue grain.
        sum(d.complaint_count) over (
            partition by d.product, d.issue
            order by d.metric_date
            range between interval '{{ current_days }} days' preceding and current row
        ) as issue_volume_current,

        -- Baseline window: the N days immediately preceding the current
        -- window, same grain. This is the RAW baseline sum, not yet
        -- normalized to the current window's length.
        sum(d.complaint_count) over (
            partition by d.product, d.issue
            order by d.metric_date
            range between interval '{{ current_days + baseline_days }} days' preceding
                       and interval '{{ current_days + 1 }} days' preceding
        ) as baseline_volume_raw,

        -- Total dataset volume in the same current window, for observed share.
        t.total_complaint_count as total_volume_current_day

    from daily_by_issue d
    left join daily_total t
        on d.metric_date = t.metric_date

),

total_windowed as (

    select
        metric_date,
        sum(total_complaint_count) over (
            order by metric_date
            range between interval '{{ current_days }} days' preceding and current row
        ) as total_volume_current
    from daily_total

),

combined as (

    select
        w.metric_date,
        w.product,
        w.issue,
        w.issue_volume_current,

        -- Baseline normalized to the current window's length, so the
        -- comparison is apples-to-apples regardless of the two windows'
        -- different raw lengths (7 vs 30 days by default).
        w.baseline_volume_raw / nullif({{ baseline_days }}, 0) * {{ current_days }}
            as baseline_volume,

        tw.total_volume_current,

        {{ safe_divide(
            'w.issue_volume_current - (w.baseline_volume_raw / nullif(' ~ baseline_days ~ ', 0) * ' ~ current_days ~ ')',
            'w.baseline_volume_raw / nullif(' ~ baseline_days ~ ', 0) * ' ~ current_days
        ) }} as volume_change_pct,

        {{ safe_divide('w.issue_volume_current', 'tw.total_volume_current') }}
            as observed_share_pct

    from windowed w
    left join total_windowed tw
        on w.metric_date = tw.metric_date

),

qualified as (

    select
        *,

        -- Qualification per docs/04_decisioning_policy.md §8. A percentage
        -- change alone is never sufficient — all conditions must hold.
        case
            when baseline_volume < {{ min_baseline }} or baseline_volume is null
                then 'INSUFFICIENT_BASELINE'
            when issue_volume_current < {{ min_current }}
                then 'NO_SIGNAL'
            when volume_change_pct is not null
                 and volume_change_pct >= {{ min_pct_change }}
                then 'QUALIFIED_SIGNAL'
            when volume_change_pct is not null
                 and volume_change_pct > 0
                then 'UNQUALIFIED_SIGNAL'
            else 'NO_SIGNAL'
        end as issue_pattern_status,

        'POLICY_EMERGING_ISSUE' as policy_id

    from combined

)

select * from qualified
