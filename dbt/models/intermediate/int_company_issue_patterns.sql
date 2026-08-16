-- model: int_company_issue_patterns.sql
-- purpose: Bounded company-level pattern context.
-- grain: 1 calendar date x company x product x issue
-- inputs: int_complaint_status_context
-- outputs: operations marts (optional, bounded context only)
-- owner: Shem Nyachieo
-- data classification: DERIVED
-- limitations: CONSTRAINED MODEL. Every row carries signal_confidence =
--              LIMITED and a non-null denominator limitation. Never rank,
--              sort, or compare companies — the source contains no company
--              size, customer count, or transaction-volume denominator, so
--              any comparison would be undefined. See ADR-003.
-- decision record: docs/adr/ADR-003-no-individual-risk-score.md

with complaints as (

    select * from {{ ref('int_complaint_status_context') }}

),

patterns as (

    select
        complaint_received_date                                 as metric_date,
        company,
        product,
        issue,
        count(*)                                                  as complaint_count,

        -- Hard-coded, not derived: this model can never earn HIGH or MEDIUM
        -- confidence, because the underlying limitation (no denominator) is
        -- structural, not a data-quality gap that could close with more data.
        'LIMITED'                                                 as signal_confidence,
        'No denominator exists for this company (customer count, account '
        || 'count, or transaction volume). This count describes complaint '
        || 'volume only and must never be read as a company quality, risk, '
        || 'performance, or misconduct signal, and must never be used to '
        || 'rank or compare companies.'                            as interpretation_limitation

    from complaints
    where company is not null
      and product is not null
      and issue is not null
    group by 1, 2, 3, 4

)

select * from patterns
