#!/usr/bin/env python3
"""
validate_source_quality.py — enforce the data-quality controls.

Checks the numbered controls in docs/08_source_quality_report.md §10 that are
checkable at the file level (before any Snowflake load exists to check
downstream): complaint_id uniqueness, the dispute field's continued absence,
masked-ZIP behavior, and null-rate drift against the documented baseline.

Reads data/profile_results.json, produced by profile_source_data.py.

Exits non-zero on any violation.

Usage:
    python scripts/validate_source_quality.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Baseline null rates from docs/08_source_quality_report.md, re-measured
# against the full 17,119,590-row population on 2026-08-15. A field drifting
# more than this many percentage points from baseline is worth a human look —
# not necessarily a failure, but not silent either.
NULL_RATE_BASELINE_PCT = {
    "Sub-product": 1.374,
    "Sub-issue": 5.418,
    "Consumer complaint narrative": 77.586,
    "Company public response": 45.409,
    "State": 0.364,
    "Tags": 95.375,
}
DRIFT_WARN_THRESHOLD_PCT = 5.0


def main() -> int:
    data_dir = Path(os.environ.get("LOCAL_DATA_DIR", "./data"))
    profile_path = data_dir / "profile_results.json"
    if not profile_path.exists():
        raise SystemExit(f"{profile_path} not found. Run profile_source_data.py first.")

    d = json.loads(profile_path.read_text())
    failures: list[str] = []
    warnings: list[str] = []

    # DQ: complaint_id must be unique and non-null (the canonical key test,
    # run at the file level before it is a dbt test at the model level).
    if d["complaint_id_duplicate_count"] != 0:
        failures.append(
            f"complaint_id has {d['complaint_id_duplicate_count']} duplicates "
            f"(expected 0)."
        )
    if d["null_counts"].get("Complaint ID", 0) != 0:
        failures.append(
            f"complaint_id has {d['null_counts']['Complaint ID']} nulls "
            f"(expected 0)."
        )

    # DQ: the dispute field must remain absent. If CFPB ever restores it, that
    # is a product-relevant event requiring a new ADR, not a silent pass.
    if d.get("consumer_disputed_field_present"):
        failures.append(
            "consumer_disputed field is PRESENT in the source. This reverses "
            "the finding in ADR-004 and requires a new ADR before proceeding — "
            "do not silently ignore this."
        )

    # DQ: masked ZIPs must exist in a plausible range (evidence the masking
    # behavior itself hasn't changed) but the exact rate is expected to drift
    # over time as more low-population-area ZIPs accumulate masks.
    zip_rate = d.get("zip_masked_rate_pct", 0)
    if not (1.0 <= zip_rate <= 25.0):
        warnings.append(
            f"ZIP masked rate is {zip_rate}%, outside the plausible 1-25% band. "
            f"Verify the masking behavior hasn't changed."
        )

    # DQ: null-rate drift against the documented baseline.
    for field, baseline in NULL_RATE_BASELINE_PCT.items():
        current = d["null_rates_pct"].get(field, 0)
        drift = abs(current - baseline)
        if drift > DRIFT_WARN_THRESHOLD_PCT:
            warnings.append(
                f"{field}: null rate {current}% drifted {drift:.1f}pp from "
                f"documented baseline {baseline}% (threshold {DRIFT_WARN_THRESHOLD_PCT}pp)."
            )

    # DQ: date coverage should start at the documented archive start.
    if d.get("date_received_min") != "2011-12-01":
        warnings.append(
            f"date_received minimum is {d.get('date_received_min')}, "
            f"expected 2011-12-01 per docs/02_data_source_audit.md."
        )

    print(f"Rows profiled: {d['total_rows']:,}")
    print(f"Checks run: {len(NULL_RATE_BASELINE_PCT) + 4}")
    print()

    if warnings:
        print(f"WARNINGS ({len(warnings)}) — review, not necessarily blocking:")
        for w in warnings:
            print(f"  ! {w}")
        print()

    if failures:
        print(f"FAILURES ({len(failures)}):", file=sys.stderr)
        for f in failures:
            print(f"  x {f}", file=sys.stderr)
        return 1

    print("PASS — no blocking data-quality failures.")
    print()
    print("Next: proceed to Snowflake raw load (snowflake/01_raw/, snowflake/02_load/).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
