#!/usr/bin/env python3
"""
validate_source_schema.py — assert the source schema before load.

Asserts EXACTLY 16 columns by name against the retrieved archive, matching
docs/03_data_dictionary.md §4 and docs/08_source_quality_report.md §3.

Exits non-zero on any deviation. A column change is SOURCE DRIFT, not a
transient error — follow docs/07_runbook.md §9. Do not patch this script to
make a load pass.

Usage:
    python scripts/validate_source_schema.py
    python scripts/validate_source_schema.py --data-dir ./data
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import sys
import zipfile
from pathlib import Path

# Verified against the live source August 15, 2026. See
# docs/02_data_source_audit.md and docs/08_source_quality_report.md §3.
EXPECTED_COLUMNS = [
    "Date received",
    "Product",
    "Sub-product",
    "Issue",
    "Sub-issue",
    "Consumer complaint narrative",
    "Company public response",
    "Company",
    "State",
    "ZIP code",
    "Tags",
    "Submitted via",
    "Date sent to company",
    "Company response to consumer",
    "Timely response?",
    "Complaint ID",
]


def read_header(archive_path: Path) -> list[str]:
    with zipfile.ZipFile(archive_path) as zf:
        members = zf.infolist()
        if len(members) != 1:
            raise SystemExit(
                f"Expected exactly 1 member in the archive, found {len(members)}."
            )
        with zf.open(members[0]) as raw:
            # Header line only — no need to decompress the full 9GB member.
            wrapped = io.TextIOWrapper(raw, encoding="utf-8")
            reader = csv.reader(wrapped)
            header = next(reader)
    return header


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir", default=os.environ.get("LOCAL_DATA_DIR", "./data")
    )
    args = parser.parse_args()

    archive_path = Path(args.data_dir) / "complaints.csv.zip"
    if not archive_path.exists():
        raise SystemExit(
            f"Archive not found at {archive_path}. "
            f"Run scripts/download_cfpb_data.py first."
        )

    print(f"Reading header from {archive_path} ...")
    actual = read_header(archive_path)

    print(f"Expected {len(EXPECTED_COLUMNS)} columns, found {len(actual)}.")

    if actual == EXPECTED_COLUMNS:
        print("PASS — schema matches exactly, in order.")
        for i, col in enumerate(actual, 1):
            print(f"  {i:2d}. {col}")
        print()
        print("Next: python scripts/profile_source_data.py")
        return 0

    # Deviation. Report it precisely rather than a generic failure.
    print("FAIL — SOURCE SCHEMA DRIFT DETECTED", file=sys.stderr)
    print(file=sys.stderr)

    expected_set = set(EXPECTED_COLUMNS)
    actual_set = set(actual)
    missing = expected_set - actual_set
    added = actual_set - expected_set

    if missing:
        print(f"Columns MISSING from source (present in our contract, absent now):",
              file=sys.stderr)
        for c in missing:
            print(f"  - {c}", file=sys.stderr)
    if added:
        print(f"Columns ADDED in source (not in our contract):", file=sys.stderr)
        for c in added:
            print(f"  + {c}", file=sys.stderr)
    if not missing and not added and actual != EXPECTED_COLUMNS:
        print("Same column names, different ORDER:", file=sys.stderr)
        print(f"  expected: {EXPECTED_COLUMNS}", file=sys.stderr)
        print(f"  actual:   {actual}", file=sys.stderr)

    print(file=sys.stderr)
    print("Do NOT patch this script to make the load pass. Follow "
          "docs/07_runbook.md §9: check the CFPB release notes, re-run the "
          "source audit, assess product impact against "
          "docs/09_supported_vs_unsupported_metrics.md, and write an ADR if "
          "a product boundary changes.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
