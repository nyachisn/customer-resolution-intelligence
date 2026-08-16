"""
Customer Resolution Intelligence — Operations Console

Internal operational intelligence powered by governed Snowflake data.
Reads exclusively from ANALYTICS_PROD via CRI_APP_READER boundary.
"""
import streamlit as st
import pandas as pd
from snowflake.snowpark.context import get_active_session

st.set_page_config(
    page_title="CRI Operations Console",
    page_icon="◆",
    layout="wide",
    initial_sidebar_state="collapsed",
)

SCHEMA = "CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD"

session = get_active_session()


@st.cache_data(ttl=300)
def query(sql):
    return session.sql(sql).to_pandas()


# ─── HEADER ───────────────────────────────────────────────────────────────────

st.markdown(
    """
    <div style="border-bottom: 1px solid #333; padding-bottom: 0.5rem; margin-bottom: 1.5rem;">
        <h1 style="margin:0; font-size:1.6rem; font-weight:600; letter-spacing:-0.02em;">
            ◆ Customer Resolution Intelligence
        </h1>
        <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:#999;">
            Internal operations console · Governed Snowflake data · dbt-produced analytical models
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

# ─── PROVENANCE (single authoritative source, read once) ─────────────────────
# FCT_COMPLAINTS carries source_snapshot_date/source_retrieved_at as propagated
# from staging (fixed ingestion-time facts). RESOLUTION_ACTION_QUEUE previously
# supplied a same-named field computed as current_date() at dbt build time,
# which drifts independently every rebuild and produced two different-looking
# "date" values on this page for what a reader would assume was one fact.
# Reading it once, from the authoritative table, and reusing it everywhere
# fixes both the record-count and the date-inconsistency issues at once.
with st.spinner("Loading provenance..."):
    gov_data = query(f"""
        SELECT SOURCE_SYSTEM, SOURCE_URL, SOURCE_RETRIEVED_AT, SOURCE_SNAPSHOT_DATE,
               COUNT(*) AS RECORD_COUNT
        FROM {SCHEMA}.FCT_COMPLAINTS
        GROUP BY 1, 2, 3, 4
    """)

total_records = int(gov_data["RECORD_COUNT"].sum())
source_date = gov_data["SOURCE_SNAPSHOT_DATE"].iloc[0]

# ─── SECTION 1: OPERATIONS SUMMARY ───────────────────────────────────────────

st.markdown("### Operations Summary")

with st.spinner("Loading operations data..."):
    summary_data = query(f"""
        SELECT PRIORITY, SIGNAL_CONFIDENCE, RECOMMENDED_ACTION,
               POLICY_VERSION, MODEL_VERSION,
               COUNT(*) AS CNT
        FROM {SCHEMA}.RESOLUTION_ACTION_QUEUE
        GROUP BY 1, 2, 3, 4, 5
    """)

    taxonomy_count = query(f"SELECT COUNT(*) AS CNT FROM {SCHEMA}.DIM_ISSUE_TAXONOMY")

policy_ver = summary_data["POLICY_VERSION"].iloc[0]
model_ver = summary_data["MODEL_VERSION"].iloc[0]
issue_categories = int(taxonomy_count["CNT"].iloc[0])

col1, col2, col3, col4, col5, col6 = st.columns(6)
col1.metric("Total Records", f"{total_records:,}")
col2.metric("Source Date", str(source_date))
col3.metric("Issue Categories", f"{issue_categories:,}")
col4.metric("Priority Levels", str(summary_data["PRIORITY"].nunique()))
col5.metric("Policy Version", policy_ver)
col6.metric("Model Version", model_ver)

st.markdown("")

# Priority and action distributions side by side
pcol1, pcol2, pcol3 = st.columns(3)

with pcol1:
    st.markdown("**Priority Distribution**")
    priority_dist = summary_data.groupby("PRIORITY")["CNT"].sum().reset_index()
    priority_dist["PCT"] = (priority_dist["CNT"] / priority_dist["CNT"].sum() * 100).round(1)
    priority_dist = priority_dist.sort_values("CNT", ascending=False)
    st.dataframe(
        priority_dist.rename(columns={"CNT": "Count", "PCT": "%"}),
        hide_index=True,
        use_container_width=True,
    )

with pcol2:
    st.markdown("**Confidence Distribution**")
    conf_dist = summary_data.groupby("SIGNAL_CONFIDENCE")["CNT"].sum().reset_index()
    conf_dist["PCT"] = (conf_dist["CNT"] / conf_dist["CNT"].sum() * 100).round(1)
    conf_dist = conf_dist.sort_values("CNT", ascending=False)
    st.dataframe(
        conf_dist.rename(columns={"SIGNAL_CONFIDENCE": "Confidence", "CNT": "Count", "PCT": "%"}),
        hide_index=True,
        use_container_width=True,
    )

with pcol3:
    st.markdown("**Action Queue Distribution**")
    action_dist = summary_data.groupby("RECOMMENDED_ACTION")["CNT"].sum().reset_index()
    action_dist["PCT"] = (action_dist["CNT"] / action_dist["CNT"].sum() * 100).round(1)
    action_dist = action_dist.sort_values("CNT", ascending=False)
    st.dataframe(
        action_dist.rename(columns={"RECOMMENDED_ACTION": "Action", "CNT": "Count", "PCT": "%"}),
        hide_index=True,
        use_container_width=True,
    )

st.divider()

# ─── SECTION 2: ISSUE TRENDS ─────────────────────────────────────────────────

st.markdown("### Issue Trends")

tcol1, tcol2 = st.columns([1, 3])

with tcol1:
    date_range = st.selectbox(
        "Time range",
        ["Last 90 days", "Last 180 days", "Last 365 days", "All time"],
        index=0,
    )
    day_map = {"Last 90 days": 90, "Last 180 days": 180, "Last 365 days": 365, "All time": 9999}
    days = day_map[date_range]

with st.spinner("Loading trend data..."):
    trend_data = query(f"""
        SELECT METRIC_DATE, PRODUCT, ISSUE, ISSUE_VOLUME_CURRENT, ISSUE_PATTERN_STATUS
        FROM {SCHEMA}.FCT_ISSUE_DAILY_METRICS
        WHERE METRIC_DATE >= DATEADD(DAY, -{days}, CURRENT_DATE())
        ORDER BY METRIC_DATE
    """)

with tcol2:
    if not trend_data.empty:
        daily_volume = trend_data.groupby("METRIC_DATE")["ISSUE_VOLUME_CURRENT"].sum().reset_index()
        st.line_chart(daily_volume, x="METRIC_DATE", y="ISSUE_VOLUME_CURRENT", height=250)

# Top issue categories and emerging patterns
tcol3, tcol4 = st.columns(2)

with tcol3:
    st.markdown("**Top Issue Categories (by volume)**")
    top_issues = (
        trend_data.groupby("PRODUCT")["ISSUE_VOLUME_CURRENT"]
        .sum()
        .reset_index()
        .sort_values("ISSUE_VOLUME_CURRENT", ascending=False)
        .head(10)
    )
    top_issues["ISSUE_VOLUME_CURRENT"] = top_issues["ISSUE_VOLUME_CURRENT"].apply(lambda x: f"{x:,}")
    st.dataframe(
        top_issues.rename(columns={"PRODUCT": "Product", "ISSUE_VOLUME_CURRENT": "Volume"}),
        hide_index=True,
        use_container_width=True,
    )

with tcol4:
    st.markdown("**Emerging Patterns (QUALIFIED_SIGNAL)**")
    emerging = trend_data[trend_data["ISSUE_PATTERN_STATUS"] == "QUALIFIED_SIGNAL"]
    if not emerging.empty:
        emerging_summary = (
            emerging.groupby(["PRODUCT", "ISSUE"])["ISSUE_VOLUME_CURRENT"]
            .sum()
            .reset_index()
            .sort_values("ISSUE_VOLUME_CURRENT", ascending=False)
            .head(10)
        )
        st.dataframe(
            emerging_summary.rename(
                columns={"PRODUCT": "Product", "ISSUE": "Issue", "ISSUE_VOLUME_CURRENT": "Volume"}
            ),
            hide_index=True,
            use_container_width=True,
        )
    else:
        st.info("No qualified emerging signals in the selected time range.")

st.divider()

# ─── SECTION 3: PRIORITY / ACTION QUEUE ───────────────────────────────────────

st.markdown("### Priority & Action Queue")
st.caption(
    "Priority reflects operational urgency from policy rules. "
    "Confidence reflects data completeness and signal strength. "
    "These are distinct dimensions — high priority does not imply high confidence."
)

qcol1, qcol2 = st.columns(2)

with qcol1:
    st.markdown("**Priority × Confidence**")
    pivot = summary_data.pivot_table(index="PRIORITY", columns="SIGNAL_CONFIDENCE", values="CNT", aggfunc="sum", fill_value=0)
    st.dataframe(pivot, use_container_width=True)

with qcol2:
    st.markdown("**Priority × Recommended Action**")
    pivot2 = summary_data.pivot_table(index="PRIORITY", columns="RECOMMENDED_ACTION", values="CNT", aggfunc="sum", fill_value=0)
    st.dataframe(pivot2, use_container_width=True)

# Reason codes
st.markdown("**Reason Code Distribution**")
reason_data = query(f"""
    SELECT f.value::STRING AS REASON_CODE, COUNT(*) AS CNT
    FROM {SCHEMA}.RESOLUTION_ACTION_QUEUE,
         LATERAL FLATTEN(input => REASON_CODES) f
    GROUP BY 1
    ORDER BY CNT DESC
""")
if not reason_data.empty:
    reason_data["PCT"] = (reason_data["CNT"] / reason_data["CNT"].sum() * 100).round(1)
    st.dataframe(
        reason_data.rename(columns={"REASON_CODE": "Reason Code", "CNT": "Occurrences", "PCT": "%"}),
        hide_index=True,
        use_container_width=True,
    )

st.divider()

# ─── SECTION 4: ISSUE INVESTIGATION ──────────────────────────────────────────

st.markdown("### Issue Investigation")

products = query(f"SELECT DISTINCT PRODUCT FROM {SCHEMA}.DIM_ISSUE_TAXONOMY ORDER BY PRODUCT")
selected_product = st.selectbox("Select product category", products["PRODUCT"].tolist())

if selected_product:
    issues_for_product = query(f"""
        SELECT DISTINCT ISSUE FROM {SCHEMA}.DIM_ISSUE_TAXONOMY
        WHERE PRODUCT = '{selected_product.replace("'", "''")}'
        ORDER BY ISSUE
    """)
    selected_issue = st.selectbox("Select issue", issues_for_product["ISSUE"].tolist())

    if selected_issue:
        # Full available history for the selected product/issue, not a fixed
        # trailing window. DIM_ISSUE_TAXONOMY lists every CFPB taxonomy entry
        # (2,642), but FCT_ISSUE_DAILY_METRICS only has rows for combinations
        # that cleared the volume threshold to compute a trend (346) - and for
        # most of those, the most recent qualifying date is not within the
        # last 180 days. A fixed CURRENT_DATE()-180 filter therefore hid real,
        # existing history for the majority of selectable issues. Removing it
        # does not invent data - it just stops discarding data that exists.
        investigation = query(f"""
            SELECT METRIC_DATE, ISSUE_VOLUME_CURRENT, BASELINE_VOLUME,
                   VOLUME_CHANGE_PCT, OBSERVED_SHARE_PCT, ISSUE_PATTERN_STATUS
            FROM {SCHEMA}.FCT_ISSUE_DAILY_METRICS
            WHERE PRODUCT = '{selected_product.replace("'", "''")}'
              AND ISSUE = '{selected_issue.replace("'", "''")}'
            ORDER BY METRIC_DATE
        """)

        if not investigation.empty:
            latest = investigation.iloc[-1]
            icol1, icol2, icol3, icol4, icol5 = st.columns(5)
            icol1.metric("Latest Volume", f"{int(latest['ISSUE_VOLUME_CURRENT']):,}")
            icol2.metric("Baseline", f"{latest['BASELINE_VOLUME']:,.0f}" if pd.notna(latest["BASELINE_VOLUME"]) else "—")
            icol3.metric("Change %", f"{latest['VOLUME_CHANGE_PCT']:.1f}%" if pd.notna(latest["VOLUME_CHANGE_PCT"]) else "—")
            icol4.metric("Share %", f"{latest['OBSERVED_SHARE_PCT']:.2f}%" if pd.notna(latest["OBSERVED_SHARE_PCT"]) else "—")
            icol5.metric("Pattern Status", latest["ISSUE_PATTERN_STATUS"])
            st.caption(f"Most recent qualifying date for this issue: {latest['METRIC_DATE']}")

            st.line_chart(investigation, x="METRIC_DATE", y="ISSUE_VOLUME_CURRENT", height=200)

            # Action queue for this product/issue
            queue_detail = query(f"""
                SELECT PRIORITY, RECOMMENDED_ACTION, SIGNAL_CONFIDENCE,
                       ARRAY_TO_STRING(REASON_CODES, ', ') AS REASONS, COUNT(*) AS CNT
                FROM {SCHEMA}.RESOLUTION_ACTION_QUEUE raq
                JOIN {SCHEMA}.FCT_COMPLAINTS fc ON raq.COMPLAINT_ID = fc.COMPLAINT_ID
                WHERE fc.PRODUCT = '{selected_product.replace("'", "''")}'
                  AND fc.ISSUE = '{selected_issue.replace("'", "''")}'
                GROUP BY 1, 2, 3, 4
                ORDER BY CNT DESC
                LIMIT 10
            """)
            if not queue_detail.empty:
                st.markdown("**Action Queue for this Issue**")
                st.dataframe(
                    queue_detail.rename(columns={
                        "PRIORITY": "Priority",
                        "RECOMMENDED_ACTION": "Action",
                        "SIGNAL_CONFIDENCE": "Confidence",
                        "REASONS": "Reason Codes",
                        "CNT": "Count",
                    }),
                    hide_index=True,
                    use_container_width=True,
                )
        else:
            st.info(
                "No qualified trend data exists for this issue. This product/issue "
                "combination did not reach the minimum volume threshold to produce "
                "a computed trend record — see docs/04_decisioning_policy.md."
            )

st.divider()

# ─── SECTION 5: DATA QUALITY & GOVERNANCE ─────────────────────────────────────

st.markdown("### Data Quality & Governance")

gcol1, gcol2 = st.columns(2)

with gcol1:
    st.markdown("**Source Provenance**")
    if not gov_data.empty:
        st.markdown(f"- **Source:** {gov_data['SOURCE_SYSTEM'].iloc[0]}")
        st.markdown(f"- **Source URL:** {gov_data['SOURCE_URL'].iloc[0]}")
        st.markdown(f"- **Retrieved:** {gov_data['SOURCE_RETRIEVED_AT'].iloc[0]}")
        st.markdown(f"- **Snapshot Date:** {gov_data['SOURCE_SNAPSHOT_DATE'].iloc[0]}")
        st.markdown(f"- **Analytical Records:** {total_records:,}")

with gcol2:
    st.markdown("**Architecture & Governance**")
    st.markdown(f"- **Database:** CUSTOMER_RESOLUTION_INTELLIGENCE")
    st.markdown(f"- **Analytical Layer:** ANALYTICS_PROD")
    st.markdown(f"- **Transformation Engine:** dbt 1.12.2")
    st.markdown(f"- **Policy Version:** {policy_ver}")
    st.markdown(f"- **Model Version:** {model_ver}")
    st.markdown(f"- **Access Boundary:** CRI_APP_READER (SELECT-only)")
    st.markdown(f"- **Warehouse:** CRI_TRANSFORM_WH (XS, 60s auto-suspend)")

st.markdown("")
st.markdown("**Known Limitations**")
st.markdown(
    """
    - Source data is public CFPB Consumer Complaint Database — not individual customer data
    - 30 malformed RFC 4180 source records excluded at ingestion (documented, bounded by dbt test)
    - Pattern detection requires sufficient baseline history; new issue categories show INSUFFICIENT_BASELINE
    - Publication lag between complaint receipt and CFPB publication affects recency of most recent records
    - This console reads pre-computed dbt models — no independent business logic is executed here
    """
)

st.markdown("")
st.caption(
    "This application reads governed, dbt-produced analytical models from "
    "CUSTOMER_RESOLUTION_INTELLIGENCE.ANALYTICS_PROD. No RAW data, complaint narratives, "
    "or individual consumer information is accessible through this interface. "
    "All decisioning logic resides in dbt transformations, not in this application layer."
)
