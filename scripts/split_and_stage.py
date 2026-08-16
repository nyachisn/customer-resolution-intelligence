#!/usr/bin/env python3
"""
split_and_stage.py — split the bulk CSV archive into row-aligned gzip chunks
and upload them to the Snowflake internal stage.

WHY THIS EXISTS

Loading the 9GB uncompressed complaints.csv as a single staged file fails
partway through with a field-delimiter parse error. Diagnosis (2026-08-16):
Python's own csv module, in strict mode, parses all 17.1M rows without a
single anomaly — the file is valid CSV. A 50,000-row extract loads into
Snowflake with zero errors. This isolates the fault to Snowflake's internal
parallel byte-range scanning of one very large uncompressed file: for
performance, Snowflake splits a large single file into byte ranges and scans
them concurrently, and that split can land inside a quoted multi-line field
(the narrative column legitimately contains embedded newlines), corrupting
the parse from that point forward.

Snowflake's own documented mitigation is exactly this: stage multiple
moderately-sized files instead of one large one, so record boundaries are
never ambiguous. Splitting here is done with Python's csv module, which
already proved correct over the full file, so no chunk boundary can fall
inside a quoted field.

Usage:
    python scripts/split_and_stage.py --connection cri
    python scripts/split_and_stage.py --rows-per-chunk 1000000 --keep-local
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def split_archive(archive_path: Path, chunk_dir: Path, rows_per_chunk: int) -> list[Path]:
    chunk_dir.mkdir(parents=True, exist_ok=True)
    chunk_paths: list[Path] = []

    with zipfile.ZipFile(archive_path) as zf:
        member = zf.infolist()[0]
        with zf.open(member) as raw:
            wrapped = io.TextIOWrapper(raw, encoding="utf-8", newline="")
            reader = csv.reader(wrapped)
            header = next(reader)

            chunk_idx = 0
            row_in_chunk = 0
            writer = None
            out_f = None

            def open_new_chunk():
                nonlocal chunk_idx, writer, out_f, row_in_chunk
                if out_f is not None:
                    out_f.close()
                chunk_idx += 1
                row_in_chunk = 0
                path = chunk_dir / f"complaints_{chunk_idx:04d}.csv.gz"
                out_f = gzip.open(path, "wt", encoding="utf-8", newline="")
                writer = csv.writer(out_f)
                writer.writerow(header)  # each chunk is independently valid — SKIP_HEADER=1 per file
                chunk_paths.append(path)
                return writer

            writer = open_new_chunk()
            for row in reader:
                writer.writerow(row)
                row_in_chunk += 1
                if row_in_chunk >= rows_per_chunk:
                    writer = open_new_chunk()

            if out_f is not None:
                out_f.close()

    return chunk_paths


def upload_chunks(chunk_dir: Path, connection: str) -> None:
    print(f"Uploading {len(list(chunk_dir.glob('*.csv.gz')))} chunk files to @CFPB_STAGE ...")
    result = subprocess.run(
        [
            "snow", "sql", "-c", connection, "-q",
            "USE ROLE CRI_LOADER; USE DATABASE CUSTOMER_RESOLUTION_INTELLIGENCE; "
            "USE SCHEMA RAW; "
            f"PUT 'file://{chunk_dir.resolve()}/*.csv.gz' @CFPB_STAGE/chunks/ "
            "OVERWRITE=TRUE PARALLEL=8;",
        ],
        capture_output=True, text=True,
    )
    print(result.stdout[-4000:])
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise SystemExit("Chunk upload failed.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--connection", default="cri")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--rows-per-chunk", type=int, default=1_000_000)
    parser.add_argument("--keep-local", action="store_true",
                         help="Do not delete local chunk files after upload.")
    args = parser.parse_args()

    data_dir = REPO_ROOT / args.data_dir
    archive_path = data_dir / "complaints.csv.zip"
    chunk_dir = data_dir / "_chunks"

    if not archive_path.exists():
        raise SystemExit(f"{archive_path} not found. Run download_cfpb_data.py first.")

    print(f"Splitting {archive_path} into ~{args.rows_per_chunk:,}-row gzip chunks...")
    chunks = split_archive(archive_path, chunk_dir, args.rows_per_chunk)
    total_size = sum(p.stat().st_size for p in chunks)
    print(f"Wrote {len(chunks)} chunks, {total_size / 1e6:.0f} MB total (gzip compressed).")

    upload_chunks(chunk_dir, args.connection)

    if not args.keep_local:
        shutil.rmtree(chunk_dir)
        print(f"Removed local chunk directory {chunk_dir}.")

    print()
    print(f"{len(chunks)} files staged at @CFPB_STAGE/chunks/")
    print("Next: python scripts/load_to_snowflake.py --from-stage-chunks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
