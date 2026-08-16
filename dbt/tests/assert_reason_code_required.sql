-- test: assert_reason_code_required
-- asserts: Every recommendation whose action is not STANDARD_HANDLING
--          carries at least one reason code, a policy_id, evidence_fields,
--          and a signal_confidence value.
-- enforces: docs/04_decisioning_policy.md §3 and §10
--
-- Returns rows on FAILURE.

select
    complaint_id,
    recommended_action,
    reason_codes,
    policy_ids,
    evidence_fields,
    signal_confidence
from {{ ref('resolution_action_queue') }}
where recommended_action != 'STANDARD_HANDLING'
  and (
      reason_codes is null or array_size(reason_codes) = 0
      or policy_ids is null or array_size(policy_ids) = 0
      or evidence_fields is null
      or signal_confidence is null
  )
