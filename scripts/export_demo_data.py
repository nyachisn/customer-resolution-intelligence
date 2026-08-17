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

# Mirrors dbt_project.yml var publication_lag_window_days. Complaints publish
# before their record is complete, so the trailing N days of any series taper
# as an artifact of publication rather than a real decline. Both the metric
# exports and the application exclude this window from period comparisons.
PUBLICATION_LAG_WINDOW_DAYS = 60


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
    parser.add_argument("--per-group", type=int, default=60,
                         help="Rows kept per priority x recommended-action group. "
                              "A stratified sample, so the committed export shows "
                              "the real spread of decisioning outcomes rather than "
                              "whichever outcome happens to be most recent.")
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
    # The sample deliberately ENDS at the publication-lag boundary rather than
    # at today. Taking the most recent N records returns only rows inside the
    # lag window, where every record is still POLICY_PUBLICATION_LAG /
    # REQUIRE_HUMAN_REVIEW — measured 2026-08-16: 300/300 identical, which
    # made the attention queue look like the decisioning layer had one rule.
    # Sampling from complete records surfaces the real spread (CRITICAL, HIGH,
    # MEDIUM and LOW all present in the same span).
    print(f"Querying agent_case_context via CRI_APP_READER ({args.window_days}d window ending "
          f"{PUBLICATION_LAG_WINDOW_DAYS}d back, sample {args.sample_size})...")
    case_context = run_query(
        args.connection,
        role_prefix +
        "SELECT * FROM CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD.AGENT_CASE_CONTEXT "
        f"WHERE complaint_received_date >= dateadd(day, -{args.window_days}, current_date()) "
        f"  AND complaint_received_date <  dateadd(day, -{PUBLICATION_LAG_WINDOW_DAYS}, current_date()) "
        f"QUALIFY row_number() over ("
        f"  partition by priority, recommended_action "
        f"  order by complaint_received_date desc"
        f") <= {args.per_group} "
        f"ORDER BY complaint_received_date DESC;",
    )
    assert_no_forbidden(case_context, "agent_case_context")
    case_context = filter_columns(case_context, ALLOWED_CASE_CONTEXT_COLUMNS)

    # Same reasoning as above: fct_issue_daily_metrics computes trend status
    # for every historical date (docs/09_supported_vs_unsupported_metrics.md
    # §4.1), so operations_overview_metrics without a window filter is the
    # full 15-year archive — 328,994 rows / 68MB from a single run, nowhere
    # near "tiny." The same window as the case context keeps both exports
    # describing the same period.
    # Also stops at the last COMPLETE calendar month. The current month is
    # only partly published, so its daily counts taper toward zero and a
    # chart that includes them reads as a collapse rather than a month in
    # progress. Ending at the last complete month means every series ends on
    # a real peak instead of an artifact.
    print(f"Querying operations_overview_metrics via CRI_APP_READER (last {args.window_days} days, "
          f"through the last complete month)...")
    metrics = run_query(
        args.connection,
        role_prefix +
        "SELECT * FROM CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD.OPERATIONS_OVERVIEW_METRICS "
        f"WHERE metric_date >= dateadd(day, -{args.window_days}, current_date()) "
        f"  AND (metric_name = 'action_count' "
        f"       OR metric_date < date_trunc('month', current_date()));",
    )
    assert_no_forbidden(metrics, "operations_overview_metrics")
    metrics = filter_columns(metrics, ALLOWED_METRICS_COLUMNS)

    # Mirrors dbt_project.yml var publication_lag_window_days. Recently
    # received complaints are published before their record is complete, so
    # the trailing N days of any volume series taper toward zero as an
    # artifact of publication, not a real decline (measured 2026-08-16: the
    # final day reads ~1.5K against a ~20K daily norm). The application
    # excludes this window from every period-over-period comparison rather
    # than presenting the taper as a trend. Kept here instead of hardcoded
    # in the frontend so the two cannot drift apart.
    meta = {
        "export_version": version,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "publication_lag_window_days": PUBLICATION_LAG_WINDOW_DAYS,
        "case_context_window_days": args.window_days,
        "case_context_row_count": len(case_context),
        "metrics_row_count": len(metrics),
        "source_total_records": source_total_records,
        "source_retrieval_date": source_retrieval_date,
    }

    # Ledger exhibits: eight aggregate-only queries backing the homepage
    # data report. Every row here is a GROUP BY count/percentage over the
    # full 17.1M-record population — never a complaint-level column — so
    # the ALLOWED_*_COLUMNS allowlist regime above doesn't apply; there is
    # no complaint_id, no per-record field, nothing to over-select. Same
    # CRI_APP_READER boundary, same governed marts, just aggregated further.
    print("Querying ledger exhibits (aggregate-only, all-history) via CRI_APP_READER...")
    schema = "CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD"

    totals = run_query(
        args.connection,
        role_prefix +
        f"SELECT COUNT(*) AS TOTAL, MIN(COMPLAINT_RECEIVED_DATE) AS MIN_DATE, "
        f"MAX(COMPLAINT_RECEIVED_DATE) AS MAX_DATE, "
        f"COUNT(DISTINCT PRODUCT) AS DISTINCT_PRODUCTS FROM {schema}.FCT_COMPLAINTS;",
    )

    # Excludes the current, still-in-progress calendar month — an
    # in-progress month reads as a sharp artificial drop on a monthly trend
    # line, not a real decline.
    monthly_volume = run_query(
        args.connection,
        role_prefix +
        f"SELECT DATE_TRUNC('month', METRIC_DATE)::DATE AS MONTH, SUM(DAILY_COMPLAINT_COUNT) AS TOTAL "
        f"FROM {schema}.FCT_ISSUE_DAILY_METRICS WHERE METRIC_DATE >= '2020-01-01' "
        f"AND METRIC_DATE < DATE_TRUNC('month', CURRENT_DATE()) "
        f"GROUP BY 1 ORDER BY 1;",
    )

    products = run_query(
        args.connection,
        role_prefix +
        f"SELECT PRODUCT, COUNT(*) AS CNT FROM {schema}.FCT_COMPLAINTS "
        f"GROUP BY 1 ORDER BY 2 DESC LIMIT 8;",
    )

    priority = run_query(
        args.connection,
        role_prefix +
        f"SELECT PRIORITY, COUNT(*) AS CNT FROM {schema}.RESOLUTION_ACTION_QUEUE GROUP BY 1 ORDER BY 1;",
    )
    confidence = run_query(
        args.connection,
        role_prefix +
        f"SELECT SIGNAL_CONFIDENCE, COUNT(*) AS CNT FROM {schema}.RESOLUTION_ACTION_QUEUE GROUP BY 1 ORDER BY 1;",
    )
    action = run_query(
        args.connection,
        role_prefix +
        f"SELECT RECOMMENDED_ACTION, COUNT(*) AS CNT FROM {schema}.RESOLUTION_ACTION_QUEUE "
        f"GROUP BY 1 ORDER BY 2 DESC;",
    )

    policy_triggers = run_query(
        args.connection,
        role_prefix +
        f"SELECT POLICY_ID, SUM(CASE WHEN TRIGGERED THEN 1 ELSE 0 END) AS TRIGGERED_CNT, "
        f"COUNT(*) AS EVALUATED_CNT FROM {schema}.INT_PRIORITY_POLICY_APPLICATION "
        f"GROUP BY 1 ORDER BY 2 DESC;",
    )

    completeness = run_query(
        args.connection,
        role_prefix +
        f"SELECT DATA_COMPLETENESS_STATUS, COUNT(*) AS CNT FROM {schema}.FCT_COMPLAINTS "
        f"GROUP BY 1 ORDER BY 2 DESC;",
    )
    timely = run_query(
        args.connection,
        role_prefix +
        f"SELECT TIMELY_RESPONSE_STATUS, COUNT(*) AS CNT FROM {schema}.FCT_COMPLAINTS "
        f"GROUP BY 1 ORDER BY 2 DESC;",
    )

    # Most-recent-ten-weeks qualified signals, one row per distinct
    # product x issue pair (its latest qualifying date only) — matches
    # docs/09_supported_vs_unsupported_metrics.md: a signal is read against
    # its own baseline, never against another product.
    emerging_signals = run_query(
        args.connection,
        role_prefix +
        "WITH ranked AS ("
        "  SELECT PRODUCT, ISSUE, METRIC_DATE, VOLUME_CHANGE_PCT, ISSUE_VOLUME_CURRENT, "
        "         ROW_NUMBER() OVER (PARTITION BY PRODUCT, ISSUE ORDER BY METRIC_DATE DESC) AS rn "
        f"  FROM {schema}.INT_ISSUE_TRENDS "
        "  WHERE ISSUE_PATTERN_STATUS = 'QUALIFIED_SIGNAL' AND METRIC_DATE >= DATEADD(WEEK, -10, CURRENT_DATE())"
        ") SELECT PRODUCT, ISSUE, METRIC_DATE, VOLUME_CHANGE_PCT, ISSUE_VOLUME_CURRENT "
        "FROM ranked WHERE rn = 1 ORDER BY VOLUME_CHANGE_PCT DESC LIMIT 8;",
    )

    # Raw complaint counts only — never ranked, never compared as a rate.
    # See docs/adr/ADR-003-no-individual-risk-score.md.
    companies = run_query(
        args.connection,
        role_prefix +
        f"SELECT COMPANY, SUM(COMPLAINT_COUNT) AS TOTAL FROM {schema}.INT_COMPANY_ISSUE_PATTERNS "
        f"GROUP BY 1 ORDER BY 2 DESC LIMIT 8;",
    )

    # ------------------------------------------------------------------
    # Archive explorer — the full published history at month grain.
    #
    # The monthly_volume query above collapses fct_issue_daily_metrics to a
    # single total per month, discarding product and issue. That left the
    # application able to show 15 years of growth OR a product breakdown,
    # never both, so the one chart with a story had nothing to drill into.
    # These three queries keep the dimensions.
    #
    # Every row is a GROUP BY aggregate over the published population. No
    # complaint_id, no per-record field.
    # ------------------------------------------------------------------

    # 1,667 rows at the time of writing (176 months x 21 product labels,
    # sparse). Starts at the archive's true beginning rather than 2020:
    # the whole point is the scale of the rise.
    print("Querying monthly volume by product via CRI_APP_READER...")
    monthly_product = run_query(
        args.connection,
        role_prefix +
        f"SELECT DATE_TRUNC('month', METRIC_DATE)::DATE AS MONTH, PRODUCT, "
        f"SUM(DAILY_COMPLAINT_COUNT) AS TOTAL "
        f"FROM {schema}.FCT_ISSUE_DAILY_METRICS "
        f"WHERE METRIC_DATE < DATE_TRUNC('month', CURRENT_DATE()) "
        f"GROUP BY 1, 2 ORDER BY 1, 2;",
    )

    # Trailing 12 complete months against the 12 before them, per product x
    # issue. This is what answers "what drove this product's change" without
    # exporting a monthly series for all 346 product x issue pairs.
    print("Querying product x issue movement via CRI_APP_READER...")
    issue_movement = run_query(
        args.connection,
        role_prefix +
        f"WITH bounds AS (SELECT DATE_TRUNC('month', CURRENT_DATE()) AS M0) "
        f"SELECT PRODUCT, ISSUE, "
        f"  SUM(CASE WHEN METRIC_DATE >= DATEADD(month, -12, M0) THEN DAILY_COMPLAINT_COUNT ELSE 0 END) AS CURRENT_12M, "
        f"  SUM(CASE WHEN METRIC_DATE >= DATEADD(month, -24, M0) "
        f"            AND METRIC_DATE <  DATEADD(month, -12, M0) THEN DAILY_COMPLAINT_COUNT ELSE 0 END) AS PRIOR_12M "
        f"FROM {schema}.FCT_ISSUE_DAILY_METRICS, bounds "
        f"WHERE METRIC_DATE < M0 "
        f"GROUP BY 1, 2 "
        f"HAVING CURRENT_12M > 0 OR PRIOR_12M > 0 "
        f"ORDER BY CURRENT_12M DESC;",
    )

    # Policy trigger rates per product, so switching a rule off moves a
    # population number rather than only re-filtering a demonstration sample.
    # evaluated_count is the product's whole record count: every record is
    # evaluated against every policy, and only the triggered ones land in
    # policy_ids. Sourced from agent_case_context because it is the one mart
    # carrying product, issue and policy_ids on the same row —
    # int_priority_policy_application and resolution_action_queue are both
    # keyed on complaint_id alone.
    print("Querying policy trigger rates by product via CRI_APP_READER...")
    policy_by_product = run_query(
        args.connection,
        role_prefix +
        f"WITH ev AS ("
        f"  SELECT PRODUCT, COUNT(*) AS EVALUATED_COUNT "
        f"  FROM {schema}.AGENT_CASE_CONTEXT GROUP BY 1"
        f"), tr AS ("
        f"  SELECT a.PRODUCT, f.VALUE::string AS POLICY_ID, COUNT(*) AS TRIGGERED_COUNT "
        f"  FROM {schema}.AGENT_CASE_CONTEXT a, LATERAL FLATTEN(input => a.POLICY_IDS) f "
        f"  GROUP BY 1, 2"
        f") SELECT tr.PRODUCT, tr.POLICY_ID, tr.TRIGGERED_COUNT, ev.EVALUATED_COUNT "
        f"FROM tr JOIN ev ON ev.PRODUCT = tr.PRODUCT "
        f"ORDER BY tr.PRODUCT, tr.POLICY_ID;",
    )

    # Exact policy-set membership, so the rules panel can answer "how many
    # records trip at least one of THESE rules" without double counting.
    # policy_ids partitions the population — the 16 distinct combinations sum
    # to 17,119,581 — so a union over any subset is a sum over the
    # combinations that intersect it. Summing per-policy counts instead, as
    # this dashboard did, inflates the answer by every record that trips two.
    print("Querying policy combinations via CRI_APP_READER...")
    policy_combinations = run_query(
        args.connection,
        role_prefix +
        f"SELECT PRODUCT, ARRAY_TO_STRING(ARRAY_SORT(POLICY_IDS), '|') AS COMBO, COUNT(*) AS CNT "
        f"FROM {schema}.AGENT_CASE_CONTEXT GROUP BY 1, 2 ORDER BY 1, 3 DESC;",
    )

    # Average published volume by weekday. This is the tile that explains why
    # nothing on this dashboard is drawn at daily grain: weekends run at
    # roughly a third of a weekday, so a daily line is mostly a picture of
    # the publishing calendar rather than of complaint behaviour.
    print("Querying publication rhythm via CRI_APP_READER...")
    weekday_rhythm = run_query(
        args.connection,
        role_prefix +
        f"WITH daily AS ("
        f"  SELECT METRIC_DATE, SUM(DAILY_COMPLAINT_COUNT) AS TOTAL "
        f"  FROM {schema}.FCT_ISSUE_DAILY_METRICS "
        f"  WHERE METRIC_DATE >= DATEADD(day, -365, DATE_TRUNC('month', CURRENT_DATE())) "
        f"    AND METRIC_DATE < DATE_TRUNC('month', CURRENT_DATE()) "
        f"  GROUP BY 1"
        f") SELECT DAYOFWEEK(METRIC_DATE) AS DOW, DAYNAME(METRIC_DATE) AS DAY_NAME, "
        f"AVG(TOTAL) AS AVG_TOTAL FROM daily GROUP BY 1, 2 ORDER BY 1;",
    )

    archive = {
        "generated_at_utc": meta["generated_at_utc"],
        "monthly_product_volume": monthly_product,
        "product_issue_movement": issue_movement,
        "policy_by_product": policy_by_product,
        "policy_combinations": policy_combinations,
        "weekday_rhythm": weekday_rhythm,
    }

    ledger = {
        "generated_at_utc": meta["generated_at_utc"],
        "totals": totals[0] if totals else None,
        "monthly_volume": monthly_volume,
        "products": products,
        "priority": priority,
        "confidence": confidence,
        "action": action,
        "policy_triggers": policy_triggers,
        "completeness": completeness,
        "timely": timely,
        "emerging_signals": emerging_signals,
        "companies": companies,
    }

    (out_dir / "agent_case_context.json").write_text(json.dumps(case_context, indent=2, default=str))
    (out_dir / "operations_overview_metrics.json").write_text(json.dumps(metrics, indent=2, default=str))
    (out_dir / "export_meta.json").write_text(json.dumps(meta, indent=2))
    (out_dir / "ledger_exhibits.json").write_text(json.dumps(ledger, indent=2, default=str))
    (out_dir / "archive_explorer.json").write_text(json.dumps(archive, indent=2, default=str))

    print()
    print(f"Wrote {len(case_context)} case-context rows, {len(metrics)} metric rows, "
          f"the ledger exhibits, and the archive explorer "
          f"({len(monthly_product)} month x product, {len(issue_movement)} product x issue, "
          f"{len(policy_by_product)} product x policy) to {out_dir}")
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
