-- script: 02_create_raw_tables.sql
-- purpose: Immutable source-aligned raw table plus load metadata.
-- grain: 1 source record in the loaded CFPB extract
-- inputs: CFPB bulk CSV archive (via CFPB_STAGE)
-- outputs: stg_cfpb_complaints
-- owner: Shem Nyachieo
-- data classification: REAL_PUBLIC
-- limitations: All 16 source columns stored as VARCHAR. No casting, no
--              business logic at this layer — that is staging's job.
--              complaint_id is a STRING by design; never cast to NUMBER.
-- decision record: docs/03_data_dictionary.md §4
--
-- IDEMPOTENT: safe to re-run. CREATE TABLE IF NOT EXISTS — does not truncate
-- an existing load. To reload, load_cfpb_data.sql handles truncation
-- explicitly with a new load_run_id.

USE ROLE CRI_LOADER;
USE DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE;
USE SCHEMA RAW;

CREATE TABLE IF NOT EXISTS CFPB_COMPLAINTS (
    -- --- Source columns, verbatim column order, all VARCHAR ---
    -- See docs/03_data_dictionary.md §4 for the verified field dictionary.
    date_received                   VARCHAR,
    product                         VARCHAR,
    sub_product                     VARCHAR,
    issue                           VARCHAR,
    sub_issue                       VARCHAR,
    consumer_complaint_narrative    VARCHAR,  -- EXCLUDED downstream. Never leaves RAW. See ADR-002.
    company_public_response         VARCHAR,
    company                         VARCHAR,
    state                           VARCHAR,
    zip_code                        VARCHAR,  -- May contain 'X' privacy masks. Never parse/geocode.
    tags                            VARCHAR,  -- Protected-population attribute. EXCLUDED downstream. See ADR-003.
    submitted_via                   VARCHAR,
    date_sent_to_company             VARCHAR,  -- CFPB routing date. NOT a company response date. See ADR-004.
    company_response_to_consumer    VARCHAR,
    timely_response                 VARCHAR,
    complaint_id                    VARCHAR,  -- STRING by design. See docs/02_data_provenance.md §10.1.

    -- --- Load metadata, required by docs/02_data_provenance.md §6 ---
    source_system                   VARCHAR DEFAULT 'CFPB_CONSUMER_COMPLAINT_DATABASE',
    source_url                      VARCHAR,
    source_retrieved_at             TIMESTAMP_NTZ,
    source_file_name                VARCHAR,
    source_snapshot_date            DATE,
    loaded_at                       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    load_run_id                     VARCHAR
)
COMMENT = 'Immutable source-aligned CFPB Consumer Complaint Database load. RAW layer — no transformation. See docs/05_architecture.md §5.';

ALTER TABLE CFPB_COMPLAINTS SET TAG
    CUSTOMER_RESOLUTION_INTELLIGENCE.GOVERNANCE.data_classification = 'real_public',
    CUSTOMER_RESOLUTION_INTELLIGENCE.GOVERNANCE.source_system = 'CFPB_CONSUMER_COMPLAINT_DATABASE';

SHOW TABLES LIKE 'CFPB_COMPLAINTS';
DESCRIBE TABLE CFPB_COMPLAINTS;
