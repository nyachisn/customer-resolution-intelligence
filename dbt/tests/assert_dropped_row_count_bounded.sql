-- test: assert_dropped_row_count_bounded
-- asserts: The gap between RAW row count and staging row count (rows
--          excluded for having no usable complaint_id) stays within a small,
--          documented ceiling.
-- enforces: docs/08_source_quality_report.md §12 — measured finding, load_run
--           49781bc8-1608-4436-a6d1-c6b0aa690cca, 2026-08-16: 30 of
--           17,119,590 source rows (0.000175%) contain an unescaped comma
--           inside the narrative field, an RFC4180 violation that shifts
--           every subsequent field left by one position. Different rows
--           shift by different amounts: 3 land with a null complaint_id,
--           6 with a null issue, 21 with a null company_response_to_consumer
--           — no overlap between the sets. stg_cfpb_complaints excludes all
--           rows missing complaint_id, product, issue, or
--           complaint_received_date, since a shift severe enough to null
--           one required field means the row's other fields cannot be
--           trusted either.
--
-- CEILING = 100 is deliberately generous relative to the measured 30 — this
-- test exists to catch a NEW, LARGER class of problem (a schema change, a
-- broken chunk boundary, a corrupted upload), not to fail on the exact
-- count staying at 3 forever. If this test starts failing, do not raise the
-- ceiling to make it pass — investigate first, per docs/07_runbook.md §9.
--
-- Returns a row (the actual dropped count) on FAILURE.

{% set ceiling = 100 %}

with raw_count as (
    select count(*) as n from {{ source('cfpb', 'cfpb_complaints') }}
),

staged_count as (
    select count(*) as n from {{ ref('stg_cfpb_complaints') }}
),

dropped as (
    select
        raw_count.n - staged_count.n as dropped_row_count
    from raw_count, staged_count
)

select dropped_row_count
from dropped
where dropped_row_count > {{ ceiling }}
   or dropped_row_count < 0
