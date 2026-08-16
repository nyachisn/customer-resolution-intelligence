-- script: 00_create_file_format.sql
-- purpose: CSV file format for the CFPB bulk archive.
-- grain: n/a
-- inputs: none
-- outputs: Used by 01_create_stage.sql and the COPY INTO in 02_load/load_cfpb_data.sql
-- owner: Shem Nyachieo
-- data classification: REFERENCE_CONFIG
-- limitations: Empty strings load as NULL. The literal string "None" (written
--              by the API's CSV export, not the bulk archive) is NOT converted
--              here — that normalization happens in staging, not raw, so RAW
--              stays a faithful mirror of the source file. See
--              docs/02_data_provenance.md §10.1.
-- decision record: docs/adr/ADR-005-bulk-csv-as-primary-ingestion.md
--
-- IDEMPOTENT: safe to re-run.

USE ROLE CRI_LOADER;
USE DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE;
USE SCHEMA RAW;

CREATE FILE FORMAT IF NOT EXISTS CFPB_CSV_FORMAT
    TYPE = CSV
    FIELD_DELIMITER = ','
    SKIP_HEADER = 1
    FIELD_OPTIONALLY_ENCLOSED_BY = '"'
    NULL_IF = ('')
    EMPTY_FIELD_AS_NULL = TRUE
    ENCODING = 'UTF8'
    COMPRESSION = 'AUTO'
    ERROR_ON_COLUMN_COUNT_MISMATCH = TRUE
    COMMENT = 'CFPB Consumer Complaint Database bulk CSV archive. 16 columns. See docs/03_data_dictionary.md §4.';

SHOW FILE FORMATS LIKE 'CFPB_CSV_FORMAT';
