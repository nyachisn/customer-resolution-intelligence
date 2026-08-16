-- model: fct_complaints.sql
-- purpose: Authoritative canonical complaint record fact model.
-- grain: 1 canonical published complaint record
-- inputs: int_complaint_status_context, dim_issue_taxonomy
-- outputs: All case-level marts
-- owner: Shem Nyachieo
-- data classification: REAL_PUBLIC
-- limitations: One row per complaint record. A row is a complaint
--              observation — not a customer, a consumer profile, or an
--              identified person. Excludes narrative text, tags, and
--              zip_code by design; none of the three reach this model.
-- decision record: docs/adr/ADR-003-no-individual-risk-score.md

with complaints as (

    select * from {{ ref('int_complaint_status_context') }}

),

taxonomy as (

    select * from {{ ref('dim_issue_taxonomy') }}

),

joined as (

    select
        c.complaint_id,
        c.complaint_received_date,
        c.cfpb_routing_date,
        t.issue_taxonomy_key,
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
        c.source_system,
        c.source_url,
        c.source_retrieved_at,
        c.source_snapshot_date,
        c.load_run_id,
        current_timestamp()                                       as generated_at

    from complaints c
    left join taxonomy t
        on c.product = t.product
       and equal_null(c.sub_product, t.sub_product)
       and c.issue = t.issue
       and equal_null(c.sub_issue, t.sub_issue)

)

select * from joined
