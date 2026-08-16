#!/usr/bin/env python3
"""
download_cfpb_data.py — retrieve the official CFPB bulk CSV archive.

Downloads https://files.consumerfinance.gov/ccdb/complaints.csv.zip into
LOCAL_DATA_DIR (git-ignored) and writes the source retrieval record required
by docs/02_data_provenance.md §2.2.

Does NOT use the filtered API export: it is capped at ~100,000 rows and
returns HTTP 400 with body 'size' above that. See ADR-005.

Usage:
    python scripts/download_cfpb_data.py
    python scripts/download_cfpb_data.py --data-dir ./data --force
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import requests

ARCHIVE_URL = "https://files.consumerfinance.gov/ccdb/complaints.csv.zip"
META_URL = (
    "https://www.consumerfinance.gov/data-research/consumer-complaints/"
    "search/api/v1/?field=all&size=0&no_aggs=true"
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_reconciliation_meta() -> dict:
    """Independent freshness check against the search API's _meta block.

    Secondary use only, per ADR-005 — never the ingestion path itself.
    """
    try:
        resp = requests.get(META_URL, timeout=30)
        resp.raise_for_status()
        return resp.json().get("_meta", {})
    except Exception as exc:  # noqa: BLE001 — reconciliation is best-effort
        return {"error": str(exc)}


def download_archive(dest: Path, force: bool) -> dict:
    if dest.exists() and not force:
        print(f"Archive already present at {dest} ({dest.stat().st_size:,} bytes). "
              f"Use --force to re-download.")
    else:
        print(f"Downloading {ARCHIVE_URL}")
        with requests.get(ARCHIVE_URL, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0))
            written = 0
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8 * 1024 * 1024):
                    f.write(chunk)
                    written += len(chunk)
                    if total:
                        pct = written / total * 100
                        print(f"\r  {written:,} / {total:,} bytes ({pct:5.1f}%)",
                              end="", flush=True)
            print()

    if not zipfile.is_zipfile(dest):
        raise SystemExit(f"Downloaded file at {dest} is not a valid ZIP archive.")

    with zipfile.ZipFile(dest) as zf:
        members = zf.infolist()
        if len(members) != 1:
            raise SystemExit(
                f"Expected exactly 1 member in the archive, found {len(members)}: "
                f"{[m.filename for m in members]}. This is source drift — see "
                f"docs/07_runbook.md §9."
            )
        member = members[0]

    return {
        "archive_path": str(dest),
        "archive_size_bytes": dest.stat().st_size,
        "member_file_name": member.filename,
        "member_size_bytes": member.file_size,
    }


def write_retrieval_record(data_dir: Path, archive_info: dict, meta: dict) -> Path:
    """Emit the source retrieval record required by
    docs/02_data_provenance.md §2.2. A load that cannot populate every field
    must not proceed — this file is that gate, made concrete.
    """
    record = {
        "publisher": "U.S. Consumer Financial Protection Bureau (CFPB)",
        "source_url": ARCHIVE_URL,
        "retrieval_date_utc": utc_now_iso(),
        "file_type": "ZIP archive containing one UTF-8 CSV",
        "archive_size_bytes": archive_info["archive_size_bytes"],
        "csv_member_file_name": archive_info["member_file_name"],
        "csv_member_size_bytes": archive_info["member_size_bytes"],
        "reconciliation_source": META_URL,
        "reconciliation_meta": meta,
        "known_limitations_ref": "docs/06_known_limitations.md",
        "schema_ref": "docs/03_data_dictionary.md §4",
    }

    out = data_dir / "source_retrieval_record.json"
    out.write_text(json.dumps(record, indent=2))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("LOCAL_DATA_DIR", "./data"),
        help="Directory to download into (git-ignored). Default: LOCAL_DATA_DIR or ./data",
    )
    parser.add_argument("--force", action="store_true", help="Re-download even if present.")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    dest = data_dir / "complaints.csv.zip"

    archive_info = download_archive(dest, args.force)
    print(f"Archive OK: {archive_info['member_file_name']} "
          f"({archive_info['member_size_bytes']:,} bytes uncompressed)")

    print("Reconciling freshness against the search API _meta block...")
    meta = fetch_reconciliation_meta()
    if meta.get("has_data_issue") or meta.get("is_data_stale"):
        print(f"WARNING: source reports data issue or staleness: {meta}", file=sys.stderr)
    else:
        print(f"  last_updated={meta.get('last_updated')} "
              f"total_record_count={meta.get('total_record_count')} "
              f"is_data_stale={meta.get('is_data_stale')}")

    record_path = write_retrieval_record(data_dir, archive_info, meta)
    print(f"Source retrieval record written: {record_path}")
    print()
    print("Next: python scripts/validate_source_schema.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
