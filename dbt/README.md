# dbt/

Transformation, testing, documentation, and lineage.

**Status:** implemented and verified. All 13 models built successfully against both `ANALYTICS_DEV` and `ANALYTICS_PROD` on the full 17,119,590-row CFPB archive. Last full `dbt build`: 66 PASS, 3 expected WARN (documented source anomalies — see `docs/08_source_quality_report.md` §12), 0 ERROR. See `docs/12_project_context.md` for current status and `docs/10_build_plan.md` for the full history.

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

Verified 2026-08-16 by extracting every `{{ ref(...) }}` call directly from the model files, not assumed from a simplified drawing:

```text
stg_cfpb_complaints (view)
  ├── dim_issue_taxonomy (table)
  └── int_complaint_status_context (view)
        ├── int_issue_daily_volume → int_issue_trends
        ├── int_company_issue_patterns
        └── int_resolution_signals ◄── also reads int_issue_trends directly
              └── int_priority_policy_application
                    ├── fct_complaints ◄── also reads dim_issue_taxonomy
                    │     └── fct_issue_daily_metrics ◄── reads int_issue_trends, not fct_complaints
                    ├── resolution_action_queue ◄── also reads int_resolution_signals
                    │     └── operations_overview_metrics ◄── also reads fct_issue_daily_metrics
                    └── agent_case_context ◄── ALSO reads fct_complaints AND resolution_action_queue directly
```

The tree-shaped drawing understates `agent_case_context`'s real dependencies — it reads three upstream models directly (`fct_complaints`, `int_resolution_signals`, `resolution_action_queue`), not only `int_priority_policy_application` transitively. Model grains are defined in [docs/03_data_dictionary.md](../docs/03_data_dictionary.md) §2. Every model states its grain in one sentence or it is not ready to build.

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
