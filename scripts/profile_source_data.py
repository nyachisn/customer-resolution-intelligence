#!/usr/bin/env python3
"""
profile_source_data.py — measure source quality after retrieval.

Re-measures the findings recorded in docs/08_source_quality_report.md against
the FULL retrieved archive (17.1M rows), not the 192,820-row sample the
original report used. Streams the CSV in chunks — never loads it fully into
memory.

Output: data/profile_results.json, plus a console summary.

Usage:
    python scripts/profile_source_data.py
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

FIELDS = [
    "Date received", "Product", "Sub-product", "Issue", "Sub-issue",
    "Consumer complaint narrative", "Company public response", "Company",
    "State", "ZIP code", "Tags", "Submitted via", "Date sent to company",
    "Company response to consumer", "Timely response?", "Complaint ID",
]

CHUNK_ROWS = 250_000


def profile(archive_path: Path) -> dict:
    total = 0
    null_counts: Counter = Counter()
    value_counts: dict[str, Counter] = defaultdict(Counter)
    complaint_ids: set[str] = set()
    id_dupes = 0
    min_date, max_date = None, None
    narrative_by_month: Counter = Counter()
    complaints_by_month: Counter = Counter()
    zip_masked = 0
    company_response_in_progress = 0
    consumer_disputed_present = False  # sanity check: field must NOT exist

    with zipfile.ZipFile(archive_path) as zf:
        member = zf.infolist()[0]
        with zf.open(member) as raw:
            wrapped = io.TextIOWrapper(raw, encoding="utf-8", newline="")
            reader = csv.DictReader(wrapped)

            if "Consumer disputed?" in (reader.fieldnames or []):
                consumer_disputed_present = True

            for row in reader:
                total += 1

                for f in FIELDS:
                    v = row.get(f, "")
                    if v is None or v == "":
                        null_counts[f] += 1

                cid = row.get("Complaint ID", "")
                if cid:
                    if cid in complaint_ids:
                        id_dupes += 1
                    complaint_ids.add(cid)

                dr = row.get("Date received", "")
                if dr:
                    d = dr[:10]
                    if min_date is None or d < min_date:
                        min_date = d
                    if max_date is None or d > max_date:
                        max_date = d
                    month = d[:7]
                    complaints_by_month[month] += 1
                    if row.get("Consumer complaint narrative", "").strip():
                        narrative_by_month[month] += 1

                z = row.get("ZIP code", "")
                if "X" in z or "x" in z:
                    zip_masked += 1

                for f in ["Product", "Company response to consumer",
                          "Timely response?", "Submitted via", "Tags"]:
                    v = row.get(f, "")
                    if v:
                        value_counts[f][v] += 1

                if row.get("Company response to consumer") == "In progress":
                    company_response_in_progress += 1

                if total % 2_000_000 == 0:
                    print(f"  ... {total:,} rows processed")

    return {
        "total_rows": total,
        "complaint_id_unique_count": len(complaint_ids),
        "complaint_id_duplicate_count": id_dupes,
        "consumer_disputed_field_present": consumer_disputed_present,
        "date_received_min": min_date,
        "date_received_max": max_date,
        "null_counts": dict(null_counts),
        "null_rates_pct": {
            f: round(null_counts[f] / total * 100, 4) for f in FIELDS
        } if total else {},
        "zip_masked_count": zip_masked,
        "zip_masked_rate_pct": round(zip_masked / total * 100, 4) if total else 0,
        "company_response_in_progress_count": company_response_in_progress,
        "company_response_in_progress_rate_pct": (
            round(company_response_in_progress / total * 100, 4) if total else 0
        ),
        "value_distributions": {
            f: dict(c.most_common(25)) for f, c in value_counts.items()
        },
        "complaints_by_month": dict(sorted(complaints_by_month.items())),
        "narrative_by_month": dict(sorted(narrative_by_month.items())),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=os.environ.get("LOCAL_DATA_DIR", "./data"))
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    archive_path = data_dir / "complaints.csv.zip"
    if not archive_path.exists():
        raise SystemExit(f"Archive not found at {archive_path}. Run download_cfpb_data.py first.")

    print(f"Profiling {archive_path} (full archive, streamed)...")
    results = profile(archive_path)
    results["_profiled_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    results["_archive_path"] = str(archive_path)

    out = data_dir / "profile_results.json"
    out.write_text(json.dumps(results, indent=2))

    print()
    print(f"Total rows:              {results['total_rows']:,}")
    print(f"Unique complaint_id:     {results['complaint_id_unique_count']:,}")
    print(f"Duplicate complaint_id:  {results['complaint_id_duplicate_count']:,}")
    print(f"consumer_disputed field present: {results['consumer_disputed_field_present']}")
    print(f"Date coverage:           {results['date_received_min']} to {results['date_received_max']}")
    print(f"ZIP masked rate:         {results['zip_masked_rate_pct']}%")
    print(f"'In progress' rate:      {results['company_response_in_progress_rate_pct']}%")
    print()
    print(f"Full results: {out}")
    print()
    print("Next: python scripts/validate_source_quality.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
