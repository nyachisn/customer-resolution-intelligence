-- test: assert_no_response_duration_claim
-- asserts: No column in any built model expresses a response duration,
--          resolution duration, or any interval derived from date_received
--          and date_sent_to_company.
-- enforces: DQ-16; docs/adr/ADR-004-source-validation-removes-response-duration.md
--
-- Unlike the other singular tests, this queries INFORMATION_SCHEMA rather
-- than model output — it is a schema-shape assertion, not a data assertion.
-- The source publishes no company response timestamp, so any column
-- matching these patterns is a defect by construction, not a data-quality
-- edge case to investigate.
--
-- Returns rows on FAILURE.

select
    table_schema,
    table_name,
    column_name
from {{ target.database }}.information_schema.columns
where table_schema ilike '{{ target.schema }}%'
  and (
      column_name ilike '%response_days%'
      or column_name ilike '%resolution_days%'
      or column_name ilike '%days_to_respond%'
      or column_name ilike '%time_to_resolution%'
      or column_name ilike '%handling_time%'
      or column_name ilike '%response_duration%'
      or column_name ilike '%resolution_duration%'
      or (column_name ilike '%elapsed%' and column_name not ilike '%elapsed_placeholder_never_matches%')
  )
