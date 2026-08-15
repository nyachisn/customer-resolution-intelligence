#!/usr/bin/env python3
"""
validate_source_quality.py — enforce the data-quality controls

Checks the 18 numbered controls in docs/08_source_quality_report.md §10,
including: complaint_id typed as string, masked ZIPs unparsed, literal 'None'
normalized to null, no duration-shaped column names anywhere (DQ-16), and
export columns validated against the metric register (DQ-17).

Exits non-zero on any violation.

STATUS: NOT IMPLEMENTED. Phase 0 scaffold.
Implementation is gated on docs/00_project_charter.md §11.

Contract: scripts/README.md
"""

if __name__ == "__main__":
    raise SystemExit("validate_source_quality.py is not implemented yet (Phase 0 scaffold).")
