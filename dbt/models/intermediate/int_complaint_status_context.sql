-- model: int_complaint_status_context.sql
-- purpose: Assemble published status context and a per-record data-completeness
--          assessment. Derives NO timing or duration measures.
-- grain: 1 published complaint record
-- inputs: stg_cfpb_complaints
-- outputs: int_issue_daily_volume, int_resolution_signals
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: Renamed from int_complaint_lifecycle. The source publishes no
--              company response timestamp; any duration here would measure
--              CFPB routing latency, not company behavior.
-- decision record: docs/adr/ADR-004-source-validation-removes-response-duration.md

with complaints as (

    select * from {{ ref('stg_cfpb_complaints') }}

),

with_completeness as (

    select
        *,

        -- Data-completeness assessment, per docs/04_decisioning_policy.md §9.
        -- Decision-critical fields: a known complaint_id, received date,
        -- product, and issue are required for any policy to evaluate safely
        -- — rows missing any of these are already excluded upstream in
        -- stg_cfpb_complaints, so INSUFFICIENT is unreachable here today;
        -- retained as a safety net in case that filter is ever loosened.
        -- timely_response_status is never null at source (0.000%, see the
        -- source quality report) so it does not gate completeness here.
        case
            when complaint_id is null
                or complaint_received_date is null
                or product is null
                or issue is null
                then 'INSUFFICIENT'
            when sub_product is null
                or sub_issue is null
                -- MEASURED (docs/08_source_quality_report.md §12): 21 rows
                -- carry a null company_response from the same parser-shift
                -- defect that produces the null issue/complaint_id rows
                -- excluded above. These particular rows kept a valid
                -- complaint_id/product/issue, so they pass the exclusion
                -- filter, but a decision-critical field is still genuinely
                -- missing for them — PARTIAL says so rather than silently
                -- treating them as COMPLETE.
                or company_response is null
                then 'PARTIAL'
            else 'COMPLETE'
        end                                                        as data_completeness_status

    from complaints

)

select * from with_completeness
