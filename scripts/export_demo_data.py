#!/usr/bin/env python3
"""
export_demo_data.py — produce the curated versioned demo export

Writes the curated dataset the application reads.

MUST exclude: narratives, tags, zip_code, and every metric marked 'No' in
docs/09_supported_vs_unsupported_metrics.md.
MUST include: generated_at, source_snapshot_date, policy_version, export version.

Validates its own output column set against the metric register, then stops for
a manual disclosure review. That human gate is required — docs/07_runbook.md §7.

STATUS: NOT IMPLEMENTED. Phase 0 scaffold.
Implementation is gated on docs/00_project_charter.md §11.

Contract: scripts/README.md
"""

if __name__ == "__main__":
    raise SystemExit("export_demo_data.py is not implemented yet (Phase 0 scaffold).")
