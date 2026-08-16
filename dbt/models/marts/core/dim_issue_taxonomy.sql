-- model: dim_issue_taxonomy.sql
-- purpose: Reusable product/issue taxonomy reference.
-- grain: 1 distinct product x sub_product x issue x sub_issue combination
-- inputs: stg_cfpb_complaints
-- outputs: Trend and case marts
-- owner: Shem Nyachieo
-- data classification: REAL_PUBLIC
-- limitations: Legacy and current labels coexist and must be versioned,
--              never merged. See docs/08_source_quality_report.md §6.
-- decision record: docs/03_data_dictionary.md §2

with complaints as (

    select * from {{ ref('stg_cfpb_complaints') }}

),

distinct_taxonomy as (

    select distinct
        product,
        sub_product,
        issue,
        sub_issue
    from complaints
    -- product and issue are non-null per the source contract (0.000% null,
    -- docs/08_source_quality_report.md §4); sub_product and sub_issue may
    -- be null and are retained as such, not defaulted.
    where product is not null
      and issue is not null

),

with_key as (

    select
        {{ dbt_utils.generate_surrogate_key(['product', 'sub_product', 'issue', 'sub_issue']) }}
            as issue_taxonomy_key,
        product,
        sub_product,
        issue,
        sub_issue

    from distinct_taxonomy

)

select * from with_key
