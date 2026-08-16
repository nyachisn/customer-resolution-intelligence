-- script: load_cfpb_data.sql
-- purpose: COPY the staged archive into the raw table with load metadata.
-- grain: 1 source record
-- inputs: Stage, file format, raw table
-- outputs: stg_cfpb_complaints
-- owner: Shem Nyachieo
-- data classification: REAL_PUBLIC
-- limitations: Never overwrite a prior load without a new load_run_id.
-- decision record: docs/07_runbook.md §5
--
-- TEMPLATE FILE — do not run directly. scripts/load_to_snowflake.py renders
-- the {{ }} placeholders into literal SQL and executes the result. Literal
-- substitution is used instead of Snowflake session variables because mixing
-- $session_var with the $1/$2 positional stage-column syntax inside a COPY
-- INTO transformation SELECT is an ambiguity not worth carrying in a script
-- that runs against 17M rows.
--
-- WHY MULTIPLE CHUNK FILES, NOT ONE ARCHIVE — diagnosed 2026-08-16: loading
-- the 9GB uncompressed CSV as a single staged file fails partway through with
-- a field-delimiter parse error. Python's csv module parses all 17.1M rows
-- without a single anomaly, and a 50,000-row extract loads clean. The fault
-- is Snowflake's internal parallel byte-range scan of one very large
-- uncompressed file landing inside a quoted multi-line narrative field.
-- Snowflake's own documented mitigation is exactly what this file does: load
-- from multiple moderately-sized files instead of one large one, so no
-- record boundary is ever ambiguous. See scripts/split_and_stage.py.
--
-- PREREQUISITE — split and stage the archive first:
--   python scripts/split_and_stage.py --connection cri

USE ROLE CRI_LOADER;
USE WAREHOUSE CRI_TRANSFORM_WH;
USE DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE;
USE SCHEMA RAW;

COPY INTO CFPB_COMPLAINTS (
    date_received, product, sub_product, issue, sub_issue,
    consumer_complaint_narrative, company_public_response, company,
    state, zip_code, tags, submitted_via, date_sent_to_company,
    company_response_to_consumer, timely_response, complaint_id,
    source_url, source_retrieved_at, source_file_name, source_snapshot_date,
    load_run_id
)
FROM (
    SELECT
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        '{{ source_url }}',
        '{{ source_retrieved_at }}'::TIMESTAMP_NTZ,
        -- METADATA$FILENAME now records the specific chunk file each row
        -- came from, which is finer-grained lineage than the single archive
        -- name would have given.
        METADATA$FILENAME,
        '{{ source_snapshot_date }}'::DATE,
        '{{ load_run_id }}'
    FROM @CFPB_STAGE/chunks/
)
PATTERN = '.*complaints_[0-9]+\\.csv\\.gz'
FILE_FORMAT = (FORMAT_NAME = CFPB_CSV_FORMAT)
-- CONTINUE, not ABORT_STATEMENT: with the file pre-split at real CSV row
-- boundaries there is no expected error source left, but a public 9GB
-- government CSV is exactly the kind of file where a single genuinely
-- malformed row is plausible. CONTINUE loads everything parseable and
-- reports exactly what it skipped, in the query result below — consistent
-- with "treat missing or malformed source data as a modeled condition
-- rather than a hidden error" (docs/02_data_provenance.md §10).
ON_ERROR = CONTINUE
PURGE = FALSE;

-- Explicit accounting of anything CONTINUE skipped. Zero rows here is the
-- expected, and desired, result.
SELECT * FROM TABLE(VALIDATE(CFPB_COMPLAINTS, JOB_ID => '_last'));

-- ---------------------------------------------------------------------------
-- Post-load verification (item 23): row count, min/max dates, duplicate IDs,
-- null IDs.
-- ---------------------------------------------------------------------------

SELECT
    '{{ load_run_id }}'                             AS load_run_id,
    COUNT(*)                                        AS row_count,
    COUNT(DISTINCT complaint_id)                    AS distinct_complaint_ids,
    COUNT(*) - COUNT(DISTINCT complaint_id)          AS duplicate_id_count,
    COUNT_IF(complaint_id IS NULL)                  AS null_id_count,
    MIN(date_received)                              AS min_date_received,
    MAX(date_received)                              AS max_date_received
FROM CFPB_COMPLAINTS
WHERE load_run_id = '{{ load_run_id }}';
