-- script: 01_create_warehouse.sql
-- purpose: Create the transform warehouse with explicit cost controls.
-- grain: n/a
-- inputs: Roles from 00_create_roles.sql
-- outputs: Compute for loads, dbt runs, and demo exports
-- owner: Shem Nyachieo
-- data classification: REFERENCE_CONFIG
-- limitations: X-Small is sufficient for this project's measured volume.
--              Resize only with a documented reason.
-- decision record: docs/05_architecture.md §4
--
-- IDEMPOTENT: safe to re-run.

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- Resource monitor — cost control
--
-- This runs against an account that holds other work, so the project's compute
-- is capped and cannot silently consume the account's credits. The monitor is
-- scoped to this warehouse only, not the account.
--
-- SUSPEND_IMMEDIATE at 100% is deliberate: a runaway query on a portfolio
-- project should stop, not keep billing.
-- ---------------------------------------------------------------------------

CREATE RESOURCE MONITOR IF NOT EXISTS CRI_MONITOR
    WITH
        CREDIT_QUOTA = 25
        FREQUENCY = MONTHLY
        START_TIMESTAMP = IMMEDIATELY
        TRIGGERS
            ON 75  PERCENT DO NOTIFY
            ON 90  PERCENT DO NOTIFY
            ON 100 PERCENT DO SUSPEND
            ON 110 PERCENT DO SUSPEND_IMMEDIATE;

-- ---------------------------------------------------------------------------
-- Warehouse
--
-- AUTO_SUSPEND = 60s: the workload is bursty (a load, a dbt build), not
-- interactive, so idle compute is pure waste.
-- INITIALLY_SUSPENDED: creating it must not start billing.
-- ---------------------------------------------------------------------------

CREATE WAREHOUSE IF NOT EXISTS CRI_TRANSFORM_WH
    WITH
        WAREHOUSE_SIZE = 'XSMALL'
        WAREHOUSE_TYPE = 'STANDARD'
        AUTO_SUSPEND = 60
        AUTO_RESUME = TRUE
        INITIALLY_SUSPENDED = TRUE
        MIN_CLUSTER_COUNT = 1
        MAX_CLUSTER_COUNT = 1
        SCALING_POLICY = 'STANDARD'
        STATEMENT_TIMEOUT_IN_SECONDS = 3600
        COMMENT = 'Customer Resolution Intelligence: loads, dbt transformations, and demo exports.';

ALTER WAREHOUSE CRI_TRANSFORM_WH SET RESOURCE_MONITOR = CRI_MONITOR;

-- ---------------------------------------------------------------------------
-- Warehouse access
--
-- CRI_APP_READER is granted USAGE because reading the curated surface needs
-- compute. It is denied access to RAW at the schema level in 03_grants.sql.
-- ---------------------------------------------------------------------------

GRANT USAGE ON WAREHOUSE CRI_TRANSFORM_WH TO ROLE CRI_LOADER;
GRANT USAGE ON WAREHOUSE CRI_TRANSFORM_WH TO ROLE CRI_TRANSFORMER;
GRANT USAGE ON WAREHOUSE CRI_TRANSFORM_WH TO ROLE CRI_APP_READER;
GRANT MONITOR, OPERATE ON WAREHOUSE CRI_TRANSFORM_WH TO ROLE CRI_ADMIN;

-- Verification
SHOW WAREHOUSES LIKE 'CRI_%';
