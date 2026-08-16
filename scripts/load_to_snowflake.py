#!/usr/bin/env python3
"""
load_to_snowflake.py — split, stage, and load the CFPB archive into
RAW.CFPB_COMPLAINTS, using the source retrieval record written by
download_cfpb_data.py.

Delegates splitting/upload to split_and_stage.py (see that file's docstring
for why the archive must be pre-split into multiple files rather than staged
as one 9GB CSV), then renders snowflake/02_load/load_cfpb_data.sql's {{ }}
placeholders into literal SQL and executes it.

Usage:
    python scripts/load_to_snowflake.py --connection cri
    python scripts/load_to_snowflake.py --connection cri --skip-split   # chunks already staged
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def run_snow(args: list[str]) -> subprocess.CompletedProcess:
    print(f"$ snow {' '.join(args)}")
    result = subprocess.run(["snow", *args], capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--connection", default="cri")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--skip-split", action="store_true",
                         help="Assume chunks are already staged at @CFPB_STAGE/chunks/.")
    parser.add_argument("--rows-per-chunk", type=int, default=1_000_000)
    args = parser.parse_args()

    data_dir = REPO_ROOT / args.data_dir
    record_path = data_dir / "source_retrieval_record.json"
    if not record_path.exists():
        raise SystemExit(f"{record_path} not found. Run download_cfpb_data.py first.")
    record = json.loads(record_path.read_text())

    load_run_id = str(uuid.uuid4())
    source_retrieved_at = record["retrieval_date_utc"].replace("Z", "")
    source_snapshot_date = record["retrieval_date_utc"][:10]
    source_url = record["source_url"]

    print(f"load_run_id           = {load_run_id}")
    print(f"source_url             = {source_url}")
    print(f"source_retrieved_at    = {source_retrieved_at}")
    print(f"source_snapshot_date   = {source_snapshot_date}")
    print()

    if not args.skip_split:
        split = subprocess.run([
            sys.executable, str(REPO_ROOT / "scripts/split_and_stage.py"),
            "--connection", args.connection,
            "--data-dir", args.data_dir,
            "--rows-per-chunk", str(args.rows_per_chunk),
        ])
        if split.returncode != 0:
            raise SystemExit("Split and stage failed.")

    template = (REPO_ROOT / "snowflake/02_load/load_cfpb_data.sql").read_text()
    rendered = (
        template
        .replace("{{ source_url }}", source_url)
        .replace("{{ source_retrieved_at }}", source_retrieved_at)
        .replace("{{ source_snapshot_date }}", source_snapshot_date)
        .replace("{{ load_run_id }}", load_run_id)
    )
    rendered_path = data_dir / "_rendered_load.sql"
    rendered_path.write_text(rendered)

    print()
    print("Running COPY INTO across staged chunks...")
    load = run_snow(["sql", "-c", args.connection, "-f", str(rendered_path)])
    if load.returncode != 0:
        raise SystemExit("Load failed.")

    rendered_path.unlink()
    print(f"Load complete. load_run_id={load_run_id}")
    print("Next: python scripts/validate_raw_load.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
