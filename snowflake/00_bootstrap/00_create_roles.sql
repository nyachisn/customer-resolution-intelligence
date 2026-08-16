-- script: 00_create_roles.sql
-- purpose: Create the four least-privilege project roles and their hierarchy.
-- grain: n/a
-- inputs: none
-- outputs: Roles consumed by 01_create_warehouse.sql and 03_grants.sql
-- owner: Shem Nyachieo
-- data classification: REFERENCE_CONFIG
-- limitations: Creates roles only. All object privileges are granted in 03_grants.sql.
-- decision record: docs/05_architecture.md §4
--
-- IDEMPOTENT: safe to re-run. Uses IF NOT EXISTS throughout and grants no
-- privileges here, so re-running cannot widen access.

USE ROLE USERADMIN;

-- ---------------------------------------------------------------------------
-- Project roles
-- ---------------------------------------------------------------------------

CREATE ROLE IF NOT EXISTS CRI_ADMIN
    COMMENT = 'Customer Resolution Intelligence: bootstrap and grant administration. Not used for routine transformation.';

CREATE ROLE IF NOT EXISTS CRI_LOADER
    COMMENT = 'Customer Resolution Intelligence: stage and load approved public CFPB data into RAW. No write access to marts.';

CREATE ROLE IF NOT EXISTS CRI_TRANSFORMER
    COMMENT = 'Customer Resolution Intelligence: run dbt transformations in ANALYTICS_DEV and ANALYTICS_PROD.';

CREATE ROLE IF NOT EXISTS CRI_APP_READER
    COMMENT = 'Customer Resolution Intelligence: read the curated demo surface only. MUST NOT be able to read RAW.';

-- ---------------------------------------------------------------------------
-- Role hierarchy
--
-- Functional roles roll up to CRI_ADMIN, which rolls up to SYSADMIN so the
-- account's standard admin path retains visibility. This is Snowflake's
-- recommended pattern: no custom role should be orphaned from SYSADMIN.
-- ---------------------------------------------------------------------------

GRANT ROLE CRI_LOADER      TO ROLE CRI_ADMIN;
GRANT ROLE CRI_TRANSFORMER TO ROLE CRI_ADMIN;
GRANT ROLE CRI_APP_READER  TO ROLE CRI_ADMIN;

USE ROLE SECURITYADMIN;
GRANT ROLE CRI_ADMIN TO ROLE SYSADMIN;

-- ---------------------------------------------------------------------------
-- Grant the roles to the project operator so they are usable from the CLI/dbt.
-- Replace NYACHISN if a different user operates the project.
-- ---------------------------------------------------------------------------

GRANT ROLE CRI_ADMIN       TO USER NYACHISN;
GRANT ROLE CRI_LOADER      TO USER NYACHISN;
GRANT ROLE CRI_TRANSFORMER TO USER NYACHISN;
GRANT ROLE CRI_APP_READER  TO USER NYACHISN;

-- Verification
SHOW ROLES LIKE 'CRI_%';
