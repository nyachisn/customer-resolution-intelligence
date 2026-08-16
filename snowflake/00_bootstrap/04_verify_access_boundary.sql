-- script: 04_verify_access_boundary.sql
-- purpose: Prove that CRI_APP_READER cannot read RAW, by testing it rather than
--          by reading the grant list.
-- grain: n/a
-- inputs: Objects and grants from 00–03
-- outputs: Pass/fail evidence for the project's central access boundary
-- owner: Shem Nyachieo
-- data classification: REFERENCE_CONFIG
-- limitations: Must be run with secondary roles disabled — see the warning below.
-- decision record: docs/05_architecture.md §4
--
-- Run after every bootstrap and after any grant change.

-- ===========================================================================
-- WARNING — SECONDARY ROLES WILL SILENTLY DEFEAT THIS TEST
--
-- Snowflake defaults new users to DEFAULT_SECONDARY_ROLES = ('ALL'). With that
-- set, every granted role stays active alongside the primary role and the
-- session's privileges are the UNION of all of them. An operator who holds
-- ACCOUNTADMIN therefore keeps ACCOUNTADMIN after USE ROLE CRI_APP_READER, and
-- the primary role becomes decorative.
--
-- This was observed during the initial bootstrap: CRI_APP_READER read a table
-- in RAW while holding no grant of any kind on RAW. The grants were correct;
-- the test was being run in a session that also carried ACCOUNTADMIN.
--
-- USE SECONDARY ROLES NONE is therefore load-bearing, not decoration. Do not
-- remove it to make the script "simpler".
-- ===========================================================================

USE ROLE CRI_APP_READER;
USE SECONDARY ROLES NONE;
USE WAREHOUSE CRI_TRANSFORM_WH;

-- ---------------------------------------------------------------------------
-- TEST 1 — RAW must be unreachable.
--
-- EXPECTED: SQL compilation error,
--   "Schema 'CUSTOMER_RESOLUTION_INTELLIGENCE.RAW' does not exist or not authorized."
--
-- A successful result here is a FAILURE of the boundary. Stop and fix before
-- loading any data.
-- ---------------------------------------------------------------------------

SHOW TABLES IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.RAW;

-- ---------------------------------------------------------------------------
-- TEST 2 — the curated surface must be reachable.
--
-- EXPECTED: success (empty until dbt has built models).
-- ---------------------------------------------------------------------------

SHOW TABLES IN SCHEMA CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD;

-- ---------------------------------------------------------------------------
-- TEST 3 — confirm the session is what we think it is.
--
-- EXPECTED: CURRENT_ROLE = CRI_APP_READER, CURRENT_SECONDARY_ROLES = ''
-- ---------------------------------------------------------------------------

SELECT
    CURRENT_ROLE()            AS active_primary_role,
    CURRENT_SECONDARY_ROLES() AS active_secondary_roles;

-- ---------------------------------------------------------------------------
-- Restore the operator session.
-- ---------------------------------------------------------------------------

USE SECONDARY ROLES ALL;
USE ROLE ACCOUNTADMIN;
