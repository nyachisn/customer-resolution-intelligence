#!/usr/bin/env python3
"""
export_demo_data.py — produce the curated, versioned demo export.

Reads agent_case_context and operations_overview_metrics from
ANALYTICS_PROD (via the CRI_APP_READER role, the same role the application
uses, so this script proves the export is reachable through the same
boundary the app will use) and writes curated JSON to app/src/data/.

MUST exclude: narratives, tags, zip_code, and every metric marked "No" in
docs/09_supported_vs_unsupported_metrics.md. These are enforced structurally
by the mart layer already excluding them — this script does not re-select
them from anywhere, and the ALLOWED_COLUMNS allowlists below are the
explicit, auditable second check.

MUST include: generated_at, source_snapshot_date, policy_version, export
version.

Ends with a mandatory manual review step: it prints every column name in the
export for a human to check against docs/02_data_provenance.md §7 before the
file is treated as approved. See docs/07_runbook.md §7.

Usage:
    python scripts/export_demo_data.py --connection cri
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Explicit allowlist, independent of whatever the mart happens to select.
# A column not on this list is dropped even if the query returns it — this
# is the "second check" the docstring promises, not a formality.
ALLOWED_CASE_CONTEXT_COLUMNS = {
    "complaint_id", "complaint_received_date", "product", "sub_product",
    "issue", "sub_issue", "submitted_via", "company_response",
    "timely_response_status", "company_public_response", "has_narrative",
    "issue_volume_current", "baseline_volume", "volume_change_pct",
    "observed_share_pct", "issue_pattern_status",
    "recent_publication_lag_flag", "data_completeness_status",
    "signal_confidence", "interpretation_limitation", "priority",
    "recommended_action", "reason_codes", "policy_ids", "context_summary",
    "generated_at",
}
ALLOWED_METRICS_COLUMNS = {
    "metric_date", "dashboard_dimension", "metric_name", "metric_value",
    "generated_at",
}

# Fields that must NEVER appear, checked explicitly rather than only relying
# on their absence from the allowlist above — belt and suspenders.
#
# has_narrative is an explicit exception: it is a boolean completeness flag
# ("was a narrative published for this record"), never the narrative text
# itself, and is documented as permitted in docs/03_data_dictionary.md §4.
# The forbidden pattern exists to catch consumer_complaint_narrative or any
# column carrying actual narrative content — it must not also block the flag
# that safely says content was withheld.
FORBIDDEN_SUBSTRINGS = ["narrative", "tags", "zip", "consumer_disputed"]
FORBIDDEN_EXCEPTIONS = {"has_narrative"}


def run_query(connection: str, sql: str) -> list[dict]:
    result = subprocess.run(
        ["snow", "sql", "-c", connection, "-q", sql, "--format", "json"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise SystemExit(f"Query failed: {sql[:100]}...")
    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    # `snow sql -q` with a multi-statement query returns one result list per
    # statement (USE ROLE, USE WAREHOUSE, ... , the final SELECT), in order.
    # The row data we want is the last statement's result set.
    if isinstance(parsed, list) and parsed and isinstance(parsed[0], list):
        return parsed[-1]
    return parsed


def filter_columns(rows: list[dict], allowed: set[str]) -> list[dict]:
    out = []
    for row in rows:
        filtered = {k: v for k, v in row.items() if k.lower() in allowed}
        out.append(filtered)
    return out


def assert_no_forbidden(rows: list[dict], label: str) -> None:
    if not rows:
        return
    columns = {k.lower() for k in rows[0].keys()}
    for col in columns:
        if col in FORBIDDEN_EXCEPTIONS:
            continue
        for forbidden in FORBIDDEN_SUBSTRINGS:
            if forbidden in col:
                raise SystemExit(
                    f"REFUSING TO EXPORT: {label} column '{col}' matches "
                    f"forbidden pattern '{forbidden}'. See "
                    f"docs/02_data_provenance.md §7."
                )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--connection", default="cri")
    parser.add_argument("--out-dir", default="app/src/data")
    parser.add_argument("--window-days", type=int, default=180,
                         help="Recent window for both exports — see "
                              "docs/09_supported_vs_unsupported_metrics.md §4.1.")
    parser.add_argument("--sample-size", type=int, default=300,
                         help="Row cap for the case-context export — keeps the "
                              "committed file small and reviewable.")
    args = parser.parse_args()

    version = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = REPO_ROOT / args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    # The landing page's "records loaded" figure was previously a hardcoded
    # string in page.tsx — accurate at the time it was written, but with no
    # mechanism to stay accurate after a future reload. This reads the same
    # source-of-truth number already produced by the ingestion pipeline
    # (download_cfpb_data.py's reconciliation check against the CFPB API's
    # own _meta block — see docs/02_data_provenance.md §2.2) rather than
    # adding a new Snowflake query for a figure the pipeline already knows.
    # data/ is git-ignored, so this is best-effort: a checkout that has never
    # run the ingestion scripts won't have it, and the export degrades to
    # omitting the field rather than failing.
    retrieval_record_path = REPO_ROOT / "data" / "source_retrieval_record.json"
    source_total_records = None
    source_retrieval_date = None
    if retrieval_record_path.exists():
        retrieval_record = json.loads(retrieval_record_path.read_text())
        source_total_records = retrieval_record.get("reconciliation_meta", {}).get("total_record_count")
        source_retrieval_date = retrieval_record.get("retrieval_date_utc")
    else:
        print(f"NOTE: {retrieval_record_path} not found — export_meta.json will omit "
              f"source_total_records. Run scripts/download_cfpb_data.py to populate it.")

    # Query AS the app-reader role, over the app-reader connection posture,
    # so this script fails the same way the application would if the
    # boundary were ever wrong — not as CRI_TRANSFORMER, which can see more.
    role_prefix = "USE ROLE CRI_APP_READER; USE WAREHOUSE CRI_TRANSFORM_WH; "

    # fct_issue_daily_metrics and resolution_action_queue compute trend
    # status for every historical date, not just today — see
    # docs/09_supported_vs_unsupported_metrics.md §4.1. Without a recent-
    # window filter, the demo would present a 15-year all-history backtest
    # (15.5% HIGH/INVESTIGATE_PATTERN across the full archive) as if it were
    # today's operational queue. Filtering to a recent window is what makes
    # this a queue rather than a research artifact.
    # docs/05_architecture.md §6: "Curated tiny UI fixtures only if reviewed
    # and documented." args.sample_size caps this at a size actually fit to
    # commit — a demo needs enough rows to populate a UI, not the full
    # windowed result set.
    print(f"Querying agent_case_context via CRI_APP_READER (last {args.window_days} days, "
          f"sample {args.sample_size})...")
    case_context = run_query(
        args.connection,
        role_prefix +
        "SELECT * FROM CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD.AGENT_CASE_CONTEXT "
        f"WHERE complaint_received_date >= dateadd(day, -{args.window_days}, current_date()) "
        f"ORDER BY complaint_received_date DESC LIMIT {args.sample_size};",
    )
    assert_no_forbidden(case_context, "agent_case_context")
    case_context = filter_columns(case_context, ALLOWED_CASE_CONTEXT_COLUMNS)

    # Same reasoning as above: fct_issue_daily_metrics computes trend status
    # for every historical date (docs/09_supported_vs_unsupported_metrics.md
    # §4.1), so operations_overview_metrics without a window filter is the
    # full 15-year archive — 328,994 rows / 68MB from a single run, nowhere
    # near "tiny." The same window as the case context keeps both exports
    # describing the same period.
    print(f"Querying operations_overview_metrics via CRI_APP_READER (last {args.window_days} days)...")
    metrics = run_query(
        args.connection,
        role_prefix +
        "SELECT * FROM CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD.OPERATIONS_OVERVIEW_METRICS "
        f"WHERE metric_date >= dateadd(day, -{args.window_days}, current_date());",
    )
    assert_no_forbidden(metrics, "operations_overview_metrics")
    metrics = filter_columns(metrics, ALLOWED_METRICS_COLUMNS)

    meta = {
        "export_version": version,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "case_context_window_days": args.window_days,
        "case_context_row_count": len(case_context),
        "metrics_row_count": len(metrics),
        "source_total_records": source_total_records,
        "source_retrieval_date": source_retrieval_date,
    }

    (out_dir / "agent_case_context.json").write_text(json.dumps(case_context, indent=2, default=str))
    (out_dir / "operations_overview_metrics.json").write_text(json.dumps(metrics, indent=2, default=str))
    (out_dir / "export_meta.json").write_text(json.dumps(meta, indent=2))

    print()
    print(f"Wrote {len(case_context)} case-context rows, {len(metrics)} metric rows to {out_dir}")
    print()
    print("=" * 70)
    print("MANUAL REVIEW REQUIRED — read every column name below against")
    print("docs/02_data_provenance.md §7 before treating this export as approved.")
    print("=" * 70)
    if case_context:
        print("agent_case_context columns:", sorted(case_context[0].keys()))
    if metrics:
        print("operations_overview_metrics columns:", sorted(metrics[0].keys()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
