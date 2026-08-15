# snowflake/

Idempotent DDL for the warehouse, database, schemas, roles, grants, and raw load path.

**Status:** not yet implemented. Structure is defined; scripts are written in Phase 1.

## Layout

```text
snowflake/
├── 00_bootstrap/
│   ├── 00_create_roles.sql
│   ├── 01_create_warehouse.sql
│   ├── 02_create_database_schemas.sql
│   └── 03_grants.sql
├── 01_raw/
│   ├── 00_create_file_format.sql
│   ├── 01_create_stage.sql
│   └── 02_create_raw_tables.sql
└── 02_load/
    └── load_cfpb_complaints.sql
```

## Objects

| Object | Name |
|---|---|
| Database | `RESOLUTION_INTELLIGENCE` |
| Schemas | `RAW`, `ANALYTICS_DEV`, `ANALYTICS_PROD`, `GOVERNANCE` |
| Warehouse | `RI_TRANSFORM_WH` — smallest practical size, auto-suspend on |
| Roles | `RI_ADMIN`, `RI_LOADER`, `RI_TRANSFORMER`, `RI_APP_READER` |

## Rules

- **Scripts are idempotent.** Re-running must not destroy or duplicate.
- **Least privilege.** `RI_APP_READER` reads the curated surface only and must not be able to read `RAW`. Verify this explicitly after bootstrap.
- **Raw is immutable and untyped.** All 16 source columns load as strings with load metadata attached. No casting, no business logic.
- **Every script carries the standard header** from `docs/05_architecture.md` §9.
- **Cost control.** Auto-suspend enabled, plus a resource monitor or a documented alternative.

Full procedure: [docs/07_runbook.md](../docs/07_runbook.md) §3 and §5.
