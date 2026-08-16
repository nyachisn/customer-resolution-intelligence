-- script: 01_create_stage.sql
-- purpose: Internal stage for the retrieved CFPB archive.
-- grain: n/a
-- inputs: CFPB_CSV_FORMAT from 00_create_file_format.sql
-- outputs: Used by the COPY INTO in 02_load/load_cfpb_data.sql
-- owner: Shem Nyachieo
-- data classification: REFERENCE_CONFIG
-- limitations: Internal stage only. The archive is uploaded via `snow stage
--              copy` or PUT, never committed to Git. See docs/05_architecture.md §6.
-- decision record: docs/adr/ADR-005-bulk-csv-as-primary-ingestion.md
--
-- IDEMPOTENT: safe to re-run.

USE ROLE CRI_LOADER;
USE DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE;
USE SCHEMA RAW;

-- SSE encryption: Snowflake-managed keys are sufficient for public CC0 data.
-- Directory table is not needed — this stage holds one file, replaced per load.
CREATE STAGE IF NOT EXISTS CFPB_STAGE
    FILE_FORMAT = CFPB_CSV_FORMAT
    ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')
    COMMENT = 'Holds the retrieved CFPB bulk CSV archive prior to COPY INTO RAW.CFPB_COMPLAINTS. Never committed to Git.';

SHOW STAGES LIKE 'CFPB_STAGE';
