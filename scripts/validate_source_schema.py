#!/usr/bin/env python3
"""
validate_source_schema.py — assert the source schema before load

Asserts EXACTLY 16 columns by name against the retrieved archive, and
reconciles freshness against the search API _meta block (aborts if
is_data_stale or has_data_issue is true).

Exits non-zero on any deviation. A column change is SOURCE DRIFT, not a
transient error — follow docs/07_runbook.md §9. Do not patch this script to
make a load pass.

STATUS: NOT IMPLEMENTED. Phase 0 scaffold.
Implementation is gated on docs/00_project_charter.md §11.

Contract: scripts/README.md
"""

if __name__ == "__main__":
    raise SystemExit("validate_source_schema.py is not implemented yet (Phase 0 scaffold).")
