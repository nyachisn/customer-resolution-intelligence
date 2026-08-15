#!/usr/bin/env python3
"""
download_cfpb_data.py — retrieve the official CFPB bulk CSV archive

Downloads https://files.consumerfinance.gov/ccdb/complaints.csv.zip into
LOCAL_DATA_DIR (git-ignored) and writes the source retrieval record required by
docs/02_data_provenance.md §2.2.

Does NOT use the filtered API export: it is capped at ~100,000 rows and returns
HTTP 400 with body 'size' above that. Treat that response as window-too-large,
not a transient error. See ADR-005.

STATUS: NOT IMPLEMENTED. Phase 0 scaffold.
Implementation is gated on docs/00_project_charter.md §11.

Contract: scripts/README.md
"""

if __name__ == "__main__":
    raise SystemExit("download_cfpb_data.py is not implemented yet (Phase 0 scaffold).")
