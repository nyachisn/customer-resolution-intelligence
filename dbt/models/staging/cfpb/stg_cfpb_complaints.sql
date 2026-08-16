-- model: stg_cfpb_complaints.sql
-- purpose: Rename, cast, normalize nulls, add lineage and publication-lag flag.
-- grain: 1 published CFPB complaint record
-- inputs: source: raw.cfpb_complaints
-- outputs: int_complaint_status_context, dim_issue_taxonomy
-- owner: Shem Nyachieo
-- data classification: REAL_PUBLIC
-- limitations: complaint_id is STRING. Literal 'None' and empty strings
--              become NULL. Masked ZIPs unparsed. No duration derived from
--              date_sent_to_company.
-- decision record: docs/adr/ADR-004-source-validation-removes-response-duration.md
--
-- One-to-one shaping only, per docs/05_architecture.md §5 — no business rules
-- beyond null normalization and the publication-lag flag, which is a
-- data-quality concept (docs/03_data_dictionary.md §5), not a policy decision.

with source as (

    select * from {{ source('cfpb', 'cfpb_complaints') }}

),

renamed as (

    select
        -- ---------------------------------------------------------------
        -- Canonical key. STRING, never cast to integer — the source's own
        -- OpenAPI spec declares int64 but the live API returns a string.
        -- See docs/02_data_provenance.md §10.1.
        -- ---------------------------------------------------------------
        nullif(trim(complaint_id), '')                          as complaint_id,

        -- ---------------------------------------------------------------
        -- Dates. The bulk archive publishes date-only values; declare the
        -- surface rather than assuming a time zone. See DQ-06.
        -- ---------------------------------------------------------------
        try_to_date(date_received)                              as complaint_received_date,

        -- CFPB ROUTING/TRANSMISSION DATE. Not a company response date.
        -- No duration is derived from this field anywhere in this project.
        try_to_date(date_sent_to_company)                       as cfpb_routing_date,

        -- ---------------------------------------------------------------
        -- Taxonomy. Preserve source semantics; legacy and current labels
        -- are versioned downstream, never merged here.
        -- ---------------------------------------------------------------
        nullif(trim(product), '')                                as product,
        nullif(trim(sub_product), '')                            as sub_product,
        nullif(trim(issue), '')                                  as issue,
        nullif(trim(sub_issue), '')                              as sub_issue,

        -- ---------------------------------------------------------------
        -- Company, geography, channel.
        -- ---------------------------------------------------------------
        nullif(trim(company), '')                                as company,
        nullif(trim(state), '')                                  as state,

        -- ZIP is a privacy-masked field (~7.4% contain 'X'), stored as-is.
        -- Never parsed, cast, or geocoded. Excluded from every model
        -- downstream of staging — see docs/03_data_dictionary.md §4.
        nullif(trim(zip_code), '')                               as zip_code,

        nullif(trim(submitted_via), '')                          as submitted_via,

        -- ---------------------------------------------------------------
        -- Published response and timeliness. Source-provided categories,
        -- never measured intervals.
        -- ---------------------------------------------------------------
        nullif(trim(company_response_to_consumer), '')          as company_response,

        case upper(trim(timely_response))
            when 'YES' then 'YES'
            when 'NO'  then 'NO'
            else 'UNKNOWN'
        end                                                       as timely_response_status,

        -- The literal string "None" is written by the API's CSV export for
        -- absent values (docs/02_data_provenance.md §10.1). The bulk archive
        -- uses empty strings instead. Normalize both here.
        case
            when trim(company_public_response) in ('', 'None') then null
            else trim(company_public_response)
        end                                                       as company_public_response,

        -- ---------------------------------------------------------------
        -- Protected-population attribute. Loaded through staging for
        -- lineage completeness only — see docs/02_data_provenance.md §7 —
        -- and MUST NOT be referenced by any model past this one.
        -- ---------------------------------------------------------------
        case
            when trim(tags) in ('', 'None') then null
            else trim(tags)
        end                                                       as tags,

        -- ---------------------------------------------------------------
        -- Narrative text is never loaded past this expression. Only its
        -- presence is retained. See ADR-002.
        -- ---------------------------------------------------------------
        (nullif(trim(consumer_complaint_narrative), '') is not null) as has_narrative,

        -- ---------------------------------------------------------------
        -- Lineage
        -- ---------------------------------------------------------------
        source_system,
        source_url,
        source_retrieved_at,
        source_file_name,
        source_snapshot_date,
        loaded_at,
        load_run_id

    from source

),

with_publication_lag as (

    select
        *,

        -- Publication-lag flag. Window is a seed/var parameter
        -- (var: publication_lag_window_days, default 60), set from
        -- measurement: 33.94% of 30-60-day-old records were still
        -- 'In progress' at audit time. See docs/04_decisioning_policy.md §9.1.
        --
        -- coalesce(..., false) on the company_response check: 21 rows carry
        -- a null company_response from the parser-shift defect in
        -- docs/08_source_quality_report.md §12. Without it, SQL's
        -- three-valued logic turns `false or null` into null instead of
        -- false, and this flag — which nothing downstream may leave
        -- unresolved — would silently become null too. The date-based half
        -- of the condition is unaffected: complaint_received_date is
        -- guaranteed non-null by the filter below, so it alone still
        -- determines the flag correctly when company_response is unknown.
        (
            complaint_received_date >= dateadd(
                day,
                -{{ var('publication_lag_window_days') }},
                source_snapshot_date
            )
            or coalesce(company_response = 'In progress', false)
        )                                                          as recent_publication_lag_flag

    from renamed

),

-- -----------------------------------------------------------------------
-- Exclude rows carrying evidence of parser-shift corruption.
--
-- MEASURED FINDING (2026-08-16, load_run_id 49781bc8-1608-4436-a6d1-
-- c6b0aa690cca): a small number of source rows contain an unescaped
-- literal comma inside the Consumer complaint narrative field — a genuine
-- RFC4180 violation in the source. When a field's opening quote is not
-- properly closed and reopened around such a comma, every subsequent field
-- in that row shifts left by one position. Different rows shift by
-- different amounts depending on where the malformation falls, so no
-- single field reliably identifies every affected row: 3 rows land with a
-- null complaint_id (position 16, the last field), 6 land with a null
-- issue (position 4), 21 land with a null company_response_to_consumer
-- (position 14) — 30 rows total, no overlap between the sets, all
-- traceable to the same underlying comma-escaping defect class. product
-- and date_received (positions 1-2) are never affected, because the
-- malformation originates at the narrative field (position 6) and only
-- propagates forward.
--
-- A full-population Python streaming profile of the archive found zero
-- nulls in any of these fields. Snowflake's stricter COPY parser correctly
-- identified all 30 as corrupted. Neither parser is "wrong" — the input
-- itself is ambiguous — but this is the documented proof that a source-
-- file profile with one parser is not sufficient assurance; the actual
-- load engine's behavior must be checked too. See
-- docs/08_source_quality_report.md §12.
--
-- Every field in this project's source contract that the audit found
-- non-null at 0.000% (complaint_id, product, issue, date_received — see
-- docs/08_source_quality_report.md §4) is required here. A row missing
-- any of them carries a shift severe enough that its OTHER, still-non-null
-- fields cannot be trusted either — the shift corrupts the row's meaning,
-- not just the one empty cell. It is excluded entirely rather than loaded
-- with a plausible-looking but wrong value in some other column.
--
-- Excluded rows are never dropped silently: dbt/tests/
-- assert_dropped_row_count_bounded.sql fails the build if this count grows
-- past a small, documented ceiling, so a future load that starts dropping
-- materially more rows is caught rather than assumed to be "the same
-- known issue."
-- -----------------------------------------------------------------------

final as (

    select * from with_publication_lag
    where complaint_id is not null
      and product is not null
      and issue is not null
      and complaint_received_date is not null

)

select * from final
