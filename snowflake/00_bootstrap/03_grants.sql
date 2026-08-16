-- script: 03_grants.sql
-- purpose: Apply least-privilege grants across the project's schemas.
-- grain: n/a
-- inputs: Roles, warehouse, database, and schemas from the preceding scripts
-- outputs: The project's access-control posture
-- owner: Shem Nyachieo
-- data classification: REFERENCE_CONFIG
-- limitations: CRI_APP_READER is deliberately granted NOTHING on RAW.
--              Verify this before proceeding — see the check at the end.
-- decision record: docs/05_architecture.md §4
--
-- IDEMPOTENT: safe to re-run. Grants are additive and repeat cleanly.
--
-- Design note: FUTURE grants are used throughout so that objects dbt creates
-- later inherit the correct privileges automatically. Without them, every new
-- model would need a manual grant and the posture would drift.

USE ROLE SECURITYADMIN;

-- ---------------------------------------------------------------------------
-- Database usage — every project role needs to see the database
-- ---------------------------------------------------------------------------

GRANT USAGE ON DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE TO ROLE CRI_LOADER;
GRANT USAGE ON DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE TO ROLE CRI_TRANSFORMER;
GRANT USAGE ON DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE TO ROLE CRI_APP_READER;

-- ---------------------------------------------------------------------------
-- CRI_LOADER — writes RAW, reads nothing else
-- ---------------------------------------------------------------------------

GRANT USAGE, CREATE TABLE, CREATE STAGE, CREATE FILE FORMAT
    ON SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_LOADER;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_LOADER;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON FUTURE TABLES IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_LOADER;

GRANT READ, WRITE ON ALL STAGES    IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_LOADER;
GRANT READ, WRITE ON FUTURE STAGES IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_LOADER;
GRANT USAGE ON ALL FILE FORMATS    IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_LOADER;
GRANT USAGE ON FUTURE FILE FORMATS IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_LOADER;

-- ---------------------------------------------------------------------------
-- CRI_TRANSFORMER — reads RAW, owns the analytics schemas
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_TRANSFORMER;
GRANT SELECT ON ALL TABLES    IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_TRANSFORMER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_TRANSFORMER;
GRANT SELECT ON ALL VIEWS     IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_TRANSFORMER;
GRANT SELECT ON FUTURE VIEWS  IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW TO ROLE CRI_TRANSFORMER;

-- dbt creates and drops objects in its target schemas, and creates the
-- per-model schemas configured in dbt_project.yml, so it needs CREATE SCHEMA
-- on the database.
GRANT CREATE SCHEMA ON DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE TO ROLE CRI_TRANSFORMER;

GRANT ALL PRIVILEGES ON SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_DEV  TO ROLE CRI_TRANSFORMER;
GRANT ALL PRIVILEGES ON SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD TO ROLE CRI_TRANSFORMER;

GRANT USAGE ON SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.GOVERNANCE TO ROLE CRI_TRANSFORMER;
GRANT SELECT ON ALL TABLES    IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.GOVERNANCE TO ROLE CRI_TRANSFORMER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.GOVERNANCE TO ROLE CRI_TRANSFORMER;

-- ---------------------------------------------------------------------------
-- CRI_APP_READER — reads the curated production surface ONLY
--
-- NOTE WHAT IS ABSENT: no grant of any kind on RAW. The application must never
-- be able to reach source records, narrative text, ZIP codes, or the tags
-- field. This is the single most important boundary in this file.
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD TO ROLE CRI_APP_READER;
GRANT SELECT ON ALL VIEWS     IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD TO ROLE CRI_APP_READER;
GRANT SELECT ON FUTURE VIEWS  IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD TO ROLE CRI_APP_READER;
GRANT SELECT ON ALL TABLES    IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD TO ROLE CRI_APP_READER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD TO ROLE CRI_APP_READER;

-- ---------------------------------------------------------------------------
-- CRI_ADMIN — administration and audit
-- ---------------------------------------------------------------------------

GRANT USAGE ON DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE TO ROLE CRI_ADMIN;
GRANT ALL PRIVILEGES ON SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.GOVERNANCE TO ROLE CRI_ADMIN;

-- ---------------------------------------------------------------------------
-- VERIFICATION — run these and read the output before proceeding.
--
-- The critical assertion: the CRI_APP_READER result must contain NO row
-- referencing the RAW schema. If it does, stop and fix before loading data.
-- ---------------------------------------------------------------------------

SHOW GRANTS TO ROLE CRI_LOADER;
SHOW GRANTS TO ROLE CRI_TRANSFORMER;
SHOW GRANTS TO ROLE CRI_APP_READER;
