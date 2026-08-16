-- test: assert_no_critical_without_trigger
-- asserts: No row carries priority = CRITICAL without POLICY_CRITICAL_COMBINATION
--          present among its triggered policy_ids, and no complaint reaches
--          CRITICAL while data is incomplete or publication-lag flagged.
-- enforces: docs/04_decisioning_policy.md §7.1
--
-- Returns rows on FAILURE (dbt singular test convention) — a non-empty
-- result here is a defect in the queue, not an expected outcome.

select
    complaint_id,
    priority,
    policy_ids,
    data_completeness_status,
    recent_publication_lag_flag
from {{ ref('resolution_action_queue') }}
where priority = 'CRITICAL'
  and (
      not array_contains('POLICY_CRITICAL_COMBINATION'::variant, policy_ids)
      or data_completeness_status != 'COMPLETE'
      or recent_publication_lag_flag = true
  )
