# dbt/

Transformation, testing, documentation, and lineage.

**Status:** not yet implemented. The DAG and model contracts are specified; SQL is written in Phases 3–4.

## Layering

`sources → staging → intermediate → marts`

| Layer | Allowed logic |
|---|---|
| Source | Declare raw tables and freshness. No transformation |
| Staging | Rename, cast, normalize nulls, add lineage. One-to-one shaping, no business rules |
| Intermediate | Reusable joins, rolling volumes, policy evaluation inputs. Documented grain |
| Mart | Final metrics, context, action queue, application outputs |
| Seed | Policy configuration only — never mock records |

## DAG

```text
src_cfpb_complaints
  └── stg_cfpb_complaints
        ├── dim_issue_taxonomy
        └── int_complaint_status_context
              ├── int_issue_daily_volume ── int_issue_trends
              ├── int_company_issue_patterns
              └── int_resolution_signals
                    └── int_priority_policy_application
                          ├── fct_complaints ── fct_issue_daily_metrics
                          ├── agent_case_context
                          └── resolution_action_queue ── operations_overview_metrics
```

Model grains are defined in [docs/03_data_dictionary.md](../docs/03_data_dictionary.md) §2. Every model states its grain in one sentence or it is not ready to build.

## Non-negotiables

- **No duration models.** The source has no company response timestamp. See [ADR-004](../docs/adr/ADR-004-source-validation-removes-response-duration.md).
- **`complaint_id` is a string.** Never cast to integer.
- **Normalize literal `"None"` and empty strings to null at staging.** Never let `None` become a taxonomy value.
- **`recent_publication_lag_flag` and `signal_confidence`** must exist before any trend surface is published.
- **Policy thresholds live in seeds**, not in SQL.
- **Tests reflect real limitations.** Do not assert unreachable domain members.
- **Every model has a header** ([docs/05_architecture.md](../docs/05_architecture.md) §9) and a YAML description.

## Commands

```bash
dbt deps && dbt parse
dbt build --target dev
dbt docs generate && dbt docs serve
```

Full procedure: [docs/07_runbook.md](../docs/07_runbook.md) §6.
