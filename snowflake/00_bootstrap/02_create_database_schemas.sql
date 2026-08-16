-- script: 02_create_database_schemas.sql
-- purpose: Create the project database, schemas, and governance tag objects.
-- grain: n/a
-- inputs: Roles from 00_create_roles.sql
-- outputs: Containers for RAW loads, dbt targets, and governance metadata
-- owner: Shem Nyachieo
-- data classification: REFERENCE_CONFIG
-- limitations: Creates containers only. No tables are defined here.
-- decision record: docs/05_architecture.md §4
--
-- IDEMPOTENT: safe to re-run.

USE ROLE SYSADMIN;

-- ---------------------------------------------------------------------------
-- Database
--
-- DATA_RETENTION_TIME_IN_DAYS = 1: this project holds only public data that is
-- freely re-downloadable from CFPB. Longer Time Travel would add storage cost
-- for no recovery benefit.
-- ---------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS CUSTOMER_RESOLUTION_INTELLIGENCE
    DATA_RETENTION_TIME_IN_DAYS = 1
    COMMENT = 'Customer Resolution Intelligence. Public CFPB complaint data only. See docs/02_data_provenance.md.';

USE DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE;

-- ---------------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS RAW
    COMMENT = 'Immutable source-aligned CFPB loads plus load metadata. All columns stored as strings. No business logic.';

CREATE SCHEMA IF NOT EXISTS ANALYTICS_DEV
    COMMENT = 'dbt development target.';

CREATE SCHEMA IF NOT EXISTS ANALYTICS_PROD
    COMMENT = 'dbt production-style final models and curated outputs.';

CREATE SCHEMA IF NOT EXISTS GOVERNANCE
    COMMENT = 'Policy and reference tables, run metadata, data-quality logs, and tag definitions.';

-- The default PUBLIC schema is unused and dropped to keep the namespace honest.
DROP SCHEMA IF EXISTS PUBLIC;

-- ---------------------------------------------------------------------------
-- Governance tags
--
-- Required metadata per docs/05_architecture.md §4. Tags make provenance
-- visible in Snowflake itself, not only in documentation — a reviewer can query
-- ACCOUNT_USAGE.TAG_REFERENCES and see the classification of every object.
-- ---------------------------------------------------------------------------

USE SCHEMA GOVERNANCE;

CREATE TAG IF NOT EXISTS owner
    COMMENT = 'Accountable owner of the tagged object.';

CREATE TAG IF NOT EXISTS project
    COMMENT = 'Owning project.';

CREATE TAG IF NOT EXISTS environment
    ALLOWED_VALUES 'dev', 'prod'
    COMMENT = 'Deployment environment.';

CREATE TAG IF NOT EXISTS data_classification
    ALLOWED_VALUES 'real_public', 'derived', 'reference_config', 'synthetic_demo', 'restricted'
    COMMENT = 'Classification per docs/02_data_provenance.md §4.';

CREATE TAG IF NOT EXISTS source_system
    COMMENT = 'Originating source system.';

CREATE TAG IF NOT EXISTS source_retrieved_at
    COMMENT = 'UTC timestamp the source extract was retrieved. Required by docs/02_data_provenance.md §2.2.';

-- ---------------------------------------------------------------------------
-- Apply tags
-- ---------------------------------------------------------------------------

ALTER DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE SET TAG
    GOVERNANCE.owner = 'shem_nyachieo',
    GOVERNANCE.project = 'customer_resolution_intelligence',
    GOVERNANCE.source_system = 'CFPB_CONSUMER_COMPLAINT_DATABASE';

ALTER SCHEMA RAW            SET TAG GOVERNANCE.data_classification = 'real_public';
ALTER SCHEMA ANALYTICS_DEV  SET TAG GOVERNANCE.data_classification = 'derived', GOVERNANCE.environment = 'dev';
ALTER SCHEMA ANALYTICS_PROD SET TAG GOVERNANCE.data_classification = 'derived', GOVERNANCE.environment = 'prod';
ALTER SCHEMA GOVERNANCE     SET TAG GOVERNANCE.data_classification = 'reference_config';

-- Verification
SHOW SCHEMAS IN DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE;
