#!/usr/bin/env python3
"""
build_spec_pdf.py — regenerate the Product & Build Specification PDF.

The PDF is a presentation artifact. The Markdown under docs/ is authoritative.
Whenever the docs change materially, re-run this so the PDF does not drift back
into stating assumptions the source audit disproved.

    python scripts/build_spec_pdf.py

Requires reportlab.
"""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer,
    Table, TableStyle, KeepTogether,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "Customer_Resolution_Intelligence_Product_and_Build_Specification.pdf"

VERSION = "1.1"
UPDATED = "August 15, 2026"

INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#5B6470")
ACCENT = colors.HexColor("#0B5FA5")
FLAG = colors.HexColor("#A3341F")
RULE = colors.HexColor("#D4D8DD")
BAND = colors.HexColor("#F0F3F6")

# --------------------------------------------------------------------------- styles

ss = getSampleStyleSheet()


def style(name, **kw):
    base = dict(fontName="Helvetica", fontSize=9.5, leading=13.5,
                textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(name, parent=ss["Normal"], **base)


S = {
    "title": style("title", fontName="Helvetica-Bold", fontSize=26, leading=30),
    "subtitle": style("subtitle", fontSize=13, leading=17, textColor=ACCENT),
    "meta": style("meta", fontSize=9, leading=13, textColor=MUTED),
    "h1": style("h1", fontName="Helvetica-Bold", fontSize=15, leading=19,
                spaceBefore=16, spaceAfter=7),
    "h2": style("h2", fontName="Helvetica-Bold", fontSize=11, leading=15,
                spaceBefore=11, spaceAfter=4),
    "body": style("body", spaceAfter=6),
    "bullet": style("bullet", leftIndent=13, bulletIndent=3, spaceAfter=3),
    "cell": style("cell", fontSize=8.5, leading=11.5),
    "cellb": style("cellb", fontName="Helvetica-Bold", fontSize=8.5, leading=11.5),
    "cellh": style("cellh", fontName="Helvetica-Bold", fontSize=8.5, leading=11.5,
                   textColor=colors.white),
    "flag": style("flag", fontSize=9.5, leading=13.5, textColor=FLAG),
    "quote": style("quote", fontSize=10, leading=14.5, leftIndent=12,
                   textColor=ACCENT, fontName="Helvetica-Oblique"),
}


def P(t, s="body"):
    return Paragraph(t, S[s])


def bullets(items, s="bullet"):
    return [Paragraph(f"•&nbsp;&nbsp;{i}", S[s]) for i in items]


def table(rows, widths, header=True):
    data = []
    for r_i, row in enumerate(rows):
        st = "cellh" if (header and r_i == 0) else "cell"
        data.append([Paragraph(str(c), S[st]) for c in row])
    t = Table(data, colWidths=[w * inch for w in widths], repeatRows=1 if header else 0)
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                 ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BAND])]
    else:
        cmds += [("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, BAND])]
    t.setStyle(TableStyle(cmds))
    return t


def callout(title, body):
    inner = [Paragraph(f"<b>{title}</b>", S["flag"]), Spacer(1, 3),
             Paragraph(body, S["cell"])]
    t = Table([[inner]], colWidths=[6.9 * inch])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, FLAG),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FCF4F2")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


# --------------------------------------------------------------------------- chrome

def decorate(canvas, doc):
    canvas.saveState()
    w, h = LETTER
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.8 * inch, h - 0.55 * inch,
                      "Customer Resolution Intelligence — Product & Build Specification")
    canvas.drawRightString(w - 0.8 * inch, h - 0.55 * inch, f"v{VERSION}")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(0.8 * inch, h - 0.65 * inch, w - 0.8 * inch, h - 0.65 * inch)
    canvas.line(0.8 * inch, 0.72 * inch, w - 0.8 * inch, 0.72 * inch)
    canvas.drawString(0.8 * inch, 0.55 * inch,
                      "Portfolio prototype — not affiliated with CFPB, "
                      "any financial institution, or Twilio")
    canvas.drawRightString(w - 0.8 * inch, 0.55 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build(story):
    doc = BaseDocTemplate(
        str(OUT), pagesize=LETTER,
        leftMargin=0.8 * inch, rightMargin=0.8 * inch,
        topMargin=0.85 * inch, bottomMargin=0.85 * inch,
        title="Customer Resolution Intelligence — Product & Build Specification",
        author="Shem Nyachieo",
        subject="Customer-issue intelligence and decisioning layer — portfolio prototype",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="std", frames=[frame], onPage=decorate)])
    doc.build(story)


# --------------------------------------------------------------------------- content

def content():
    s = []

    # ---- cover
    s += [Spacer(1, 1.1 * inch),
          P("Customer Resolution Intelligence", "title"), Spacer(1, 6),
          P("A trusted decision layer for customer-issue operations", "subtitle"),
          Spacer(1, 18),
          P("Customer signal &#187; Context &#187; Pattern &#187; Priority &#187; Action", "quote"),
          Spacer(1, 22),
          P("Product management and technical build specification. Portfolio prototype "
            "demonstrating a governed data foundation on public CFPB data, built with "
            "Snowflake, dbt, and Vercel.", "body"),
          Spacer(1, 16),
          table([
              ["Version", f"{VERSION} — reconciled against verified source audit"],
              ["Last updated", UPDATED],
              ["Owner", "Shem Nyachieo"],
              ["Status", "Phase 0 — product contract. No implementation code written."],
              ["Authority", "The Markdown documents under docs/ are authoritative. "
                            "This PDF is a presentation artifact regenerated from them."],
          ], [1.3, 5.6], header=False),
          Spacer(1, 20),
          callout(
              "What changed in v1.1",
              "An independent audit of the live CFPB source on August 15, 2026 disproved "
              "several assumptions in v1.0. The public dataset contains <b>no company "
              "response timestamp</b>, and the <b>Consumer disputed?</b> field was removed "
              "from CFPB exports in June 2026. The response-duration metric and the entire "
              "dispute policy were removed rather than relabelled. "
              "See ADR-004 and docs/09_supported_vs_unsupported_metrics.md."),
          ]

    # ---- 1. positioning
    s += [P("1. Executive positioning", "h1"),
          P("Customer Resolution Intelligence is a <b>trusted decision layer for customer-issue "
            "operations</b>. It transforms published complaint records into governed issue "
            "context, emerging-pattern signals, explainable priority, and recommended "
            "investigation or action — each carrying its supporting evidence and its "
            "stated limitations."),
          P("The prototype uses the public CFPB Consumer Complaint Database. In a real "
            "deployment, an organization would connect its own authorized case-management, "
            "CRM, knowledge-base, and interaction data."),
          Spacer(1, 4),
          P("Hero statement: <b>Turn customer signals into the next best action.</b>"),
          Spacer(1, 6),
          P("What it is not", "h2")]
    s += bullets([
        "Not complaint-management software.",
        "Not a complaint-resolution prediction engine.",
        "Not a production financial-services decision engine.",
        "Not a credit, underwriting, fraud, eligibility, or regulatory decision system.",
        "Not a consumer scoring system, and not a company performance ranking.",
        "Not an integration with CFPB, any financial institution, or Twilio.",
    ])
    s += [Spacer(1, 8), P("Why this is Twilio-adjacent", "h2"),
          P("Twilio frames agent productivity around unifying channels and carrying context "
            "across AI and human agents. This project works the layer beneath: what is known "
            "about an issue, what pattern it belongs to, what is uncertain, and what should "
            "happen next. Communications and agents are only as useful as the context behind "
            "them. The prototype is <i>activation-ready</i>, not activated.")]

    # ---- 2. source reality
    s += [P("2. Source reality — verified, not assumed", "h1"),
          P("Retrieved and verified August 15, 2026 against the CFPB field reference, release "
            "notes, OpenAPI specification, live search API, and bulk CSV archive."),
          Spacer(1, 6),
          table([
              ["Property", "Verified finding"],
              ["Records", "17,119,590 published complaint records"],
              ["Coverage", "2011-12-01 through 2026-08-15"],
              ["Schema", "Exactly 16 fields. No seventeenth field exists."],
              ["Update cadence", "Daily (CSV archive). The bulk <b>JSON</b> archive lags — do not use."],
              ["License", "CC0"],
              ["Ingestion", "Bulk CSV archive. The filtered API export caps at ~100,000 rows."],
          ], [1.35, 5.55]),
          Spacer(1, 10),
          callout(
              "There is no company response timestamp",
              "The dataset publishes <b>date_received</b> (when CFPB received the complaint) "
              "and <b>date_sent_to_company</b> — the date CFPB <i>routed</i> the complaint "
              "to the company. There is no third date. Nothing records when a company received, "
              "opened, responded to, or resolved anything.<br/><br/>"
              "For modern web-submitted complaints the two dates are separated by "
              "<b>seconds</b> (observed: 23s, 25s, 13min). A duration derived from them would "
              "measure CFPB routing automation while being labelled company responsiveness. "
              "The specified <b>response_days_calendar</b> metric was removed, and no "
              "replacement duration field is permitted."),
          Spacer(1, 10),
          P("Fields that do not exist", "h2"),
          table([
              ["Field", "Status"],
              ["Consumer disputed?", "Discontinued as a filter Nov 2017; <b>removed from exports "
                                     "June 2026</b>. Absent from the field reference, both retrieval "
                                     "surfaces, and the OpenAPI schema."],
              ["Consumer consent provided", "Removed from exports June 2026."],
              ["Company response date", "Has never existed in the public dataset."],
              ["Satisfaction / sentiment", "Does not exist in any form."],
              ["Company size or denominator", "Not published — no rate or comparison is computable."],
          ], [1.55, 5.35])]

    # ---- 3. what it can and cannot measure
    s += [P("3. What the product may and may not measure", "h1"),
          P("This register is binding and test-enforced. No model, export, or interface may "
            "publish a metric marked <b>No</b>. Full version with evidence: "
            "docs/09_supported_vs_unsupported_metrics.md."),
          Spacer(1, 6),
          table([
              ["Metric", "Supported?", "Caveat"],
              ["Complaint volume", "<b>Yes</b>", "A count of published complaints, not of customer issues"],
              ["Issue trends", "<b>Yes</b>, qualified", "Legacy labels versioned, not merged"],
              ["Product trends", "<b>Yes</b>, qualified", "Evaluated within category — ~81% is credit reporting"],
              ["Channel trends", "<b>Yes</b>, low info", "96.3% is Web"],
              ["Published timely response", "<b>Yes</b>, as category", "Not an interval. 99.38% Yes"],
              ["Emerging issue detection", "<b>Yes</b>, qualified", "Never evidence of a market incident"],
              ["Consumer disputed signal", "<font color='#A3341F'><b>No</b></font>", "Field does not exist"],
              ["Actual response duration", "<font color='#A3341F'><b>No</b></font>", "No response timestamp exists"],
              ["Resolution duration", "<font color='#A3341F'><b>No</b></font>", "Same"],
              ["Customer satisfaction", "<font color='#A3341F'><b>No</b></font>", "No such field"],
              ["Root cause", "<font color='#A3341F'><b>No</b></font>", "Categories are not causal analysis"],
              ["Customer lifetime value", "<font color='#A3341F'><b>No</b></font>", "No customer identity or account data"],
              ["Individual customer risk", "<font color='#A3341F'><b>No</b></font>", "Prohibited product boundary"],
              ["Market-wide complaint rate", "<font color='#A3341F'><b>No</b></font>", "No denominator exists"],
          ], [1.85, 1.15, 3.9]),
          Spacer(1, 10),
          P("Signal confidence domain", "h2"),
          P("Every derived signal carries one of four values. This is a <b>qualitative "
            "interpretation status</b>, not a statistical measure — no numerical "
            "confidence intervals are manufactured."),
          table([
              ["Value", "Meaning"],
              ["HIGH", "Directly observed source field"],
              ["MEDIUM", "Deterministic derived signal with documented methodology"],
              ["LIMITED", "Affected by coverage, publication lag, or denominator limits"],
              ["NOT_SUPPORTED", "A conclusion the public data cannot defensibly establish"],
          ], [1.35, 5.55])]

    # ---- 4. interpretation controls
    s += [P("4. Interpretation controls", "h1"),
          P("Three measured properties of the source would produce misleading output if left "
            "uncontrolled. Each has a named control."),
          Spacer(1, 6),
          P("Publication lag", "h2"),
          P("Complaints are published before the company response is necessarily recorded."),
          table([
              ["Window (by date_received)", "Still 'In progress'"],
              ["Last 7 days", "<b>88.52%</b>"],
              ["30–60 days prior", "<b>33.94%</b>"],
              ["~12 months prior", "0.00%"],
              ["Whole database", "3.55%"],
          ], [3.45, 3.45]),
          Spacer(1, 5),
          P("<b>Control:</b> <b>recent_publication_lag_flag</b> — set on records within a "
            "seed-configured trailing <b>60-day</b> window, or with response status "
            "<i>In progress</i> at any age. The window is set from measurement: a third of "
            "complaints remain unresolved one to two months after receipt. A high count of "
            "<i>In progress</i> records is evidence of publication timing, "
            "<b>never</b> of poor company performance."),
          Spacer(1, 8),
          P("Category concentration", "h2"),
          P("Credit-reporting categories account for roughly <b>81%</b> of all records. In "
            "June 2026 the CFPB stated it “cannot rely upon the consumer complaint portal "
            "data as a reliable reflection of actual market conditions” absent announced "
            "corrections, attributing part of the rise to credit repair organizations misusing "
            "the complaint process."),
          P("<b>Control:</b> trends evaluate <i>within</i> product category, require a minimum "
            "baseline volume, and publish <b>observed_share_pct</b> alongside percentage change. "
            "A large percentage increase is never surfaced as evidence of a market incident."),
          Spacer(1, 8),
          P("Observed, not representative", "h2"),
          P("The database is an <b>observed public complaint dataset</b> — complaints that "
            "met publication criteria. Referred complaints and small depository institutions are "
            "structurally absent. It is not a sample of consumer experience, and no output may "
            "imply market-wide prevalence, harm, or dissatisfaction.")]

    # ---- 5. architecture
    s += [P("5. Architecture", "h1"),
          P("Raw public records are immutable; dbt owns transformations; policy is data-driven "
            "through seeds; final models are explainable; the application reads a curated "
            "read-only export — never raw tables."),
          Spacer(1, 6),
          table([
              ["Stage", "Detail"],
              ["Ingestion", "Official bulk CSV archive &#187; schema validation (exactly 16 columns) "
                            "&#187; source retrieval record"],
              ["Storage", "Snowflake: RAW, ANALYTICS_DEV, ANALYTICS_PROD, GOVERNANCE"],
              ["Transformation", "dbt: sources &#187; staging &#187; intermediate &#187; marts"],
              ["Policy", "Version-controlled seeds — thresholds never buried in SQL"],
              ["Delivery", "Curated versioned export &#187; Next.js on Vercel"],
          ], [1.35, 5.55]),
          Spacer(1, 8),
          P("Final marts", "h2"),
          table([
              ["Model", "Grain", "Purpose"],
              ["fct_complaints", "Complaint record", "Canonical record with lineage"],
              ["fct_issue_daily_metrics", "Date × approved dimensions", "Trusted daily metric layer"],
              ["agent_case_context", "Complaint record", "Agent-safe context, signals, confidence"],
              ["resolution_action_queue", "Record × recommendation run", "Auditable priority queue"],
              ["operations_overview_metrics", "Date × dashboard dimension", "Curated aggregate display"],
          ], [2.0, 2.0, 2.9]),
          Spacer(1, 8),
          P("Models revised by the source audit", "h2"),
          table([
              ["Model", "Change"],
              ["int_complaint_lifecycle", "<b>Renamed</b> int_complaint_status_context; all timing "
                                          "derivation removed"],
              ["stg_cfpb_complaints", "Null normalization, string complaint_id, masked-ZIP handling, "
                                      "publication-lag flag"],
              ["int_issue_trends", "Baseline volume, observed share, pattern status, within-category "
                                   "evaluation"],
              ["int_priority_policy_application", "Dispute policy removed; publication-lag policy added; "
                                                  "confidence propagation"],
              ["int_company_issue_patterns", "Retained but constrained — LIMITED confidence and a "
                                             "denominator limitation on every row"],
              ["Any duration model", "<font color='#A3341F'><b>Must never be created</b></font>"],
          ], [2.0, 4.9])]

    # ---- 6. decisioning
    s += [P("6. Decisioning policy", "h1"),
          P("Prioritize service cases and issue patterns, not people. Every recommendation "
            "carries a policy ID, action, priority, at least one reason code, its evidence "
            "fields, a confidence value, and a limitation where one applies. "
            "<b>“No action” remains a valid outcome.</b>"),
          Spacer(1, 6),
          table([
              ["Policy", "Trigger", "Priority", "Action"],
              ["POLICY_UNTIMELY_RESPONSE", "Published timeliness = No", "HIGH", "ESCALATE_REVIEW"],
              ["POLICY_EMERGING_ISSUE", "Threshold met + all qualification conditions", "HIGH", "INVESTIGATE_PATTERN"],
              ["POLICY_PUBLICATION_LAG", "Record flagged for publication lag", "MEDIUM", "REQUIRE_HUMAN_REVIEW"],
              ["POLICY_INCOMPLETE_CONTEXT", "Decision-critical field missing", "MEDIUM", "REQUIRE_HUMAN_REVIEW"],
              ["POLICY_STABLE_PATTERN", "No trigger active, data sufficient", "LOW", "STANDARD_HANDLING"],
              ["POLICY_CRITICAL_COMBINATION", "Two or more qualified HIGH triggers converge", "CRITICAL", "ESCALATE_REVIEW"],
          ], [2.05, 2.4, 0.85, 1.6]),
          Spacer(1, 8),
          P("Escalation to CRITICAL", "h2"),
          P("Removing the dispute policy removed the only single rule producing CRITICAL. Rather "
            "than retire the level or attach it arbitrarily, CRITICAL is now an explicit "
            "<b>combination</b> outcome — the more defensible design. All four conditions "
            "must hold:"),
          ] + bullets([
        "Two or more distinct HIGH policies triggered on the same record.",
        "data_completeness_status = COMPLETE.",
        "recent_publication_lag_flag = FALSE — publication lag can never escalate to CRITICAL.",
        "The contributing pattern signal is a QUALIFIED_SIGNAL.",
    ]) + [
        Spacer(1, 4),
        P("The intersection is expected to be <b>rare</b>, which is the intended behavior. A "
          "CRITICAL volume that is not rare indicates a configuration error, not a surge. "
          "Five tests enforce this."),
        Spacer(1, 8),
        P("Removed in v1.1", "h2"),
        P("<b>POLICY_DISPUTED_RESPONSE</b> — its trigger field does not exist in the "
          "source. No proxy or substitute dispute signal may be constructed. "
          "<b>POLICY_LATE_RESPONSE</b> was renamed <b>POLICY_UNTIMELY_RESPONSE</b>, and its "
          "reason code renamed <b>PUBLISHED_UNTIMELY_RESPONSE</b>, so neither can be read as "
          "a measured delay.")]

    # ---- 7. governance
    s += [P("7. Governance and required disclosures", "h1")]
    s += bullets([
        "“Portfolio prototype built with publicly available CFPB Consumer Complaint "
        "Database data.”",
        "“The prototype does not identify consumers, contact consumers, make financial "
        "decisions, or determine complaint outcomes.”",
        "“Complaint counts are not representative of all consumer experiences and must be "
        "interpreted with relevant context, including company size and market share.”",
        "“Complaint narratives are excluded.”",
        "“Independent project; not affiliated with or endorsed by CFPB, any financial "
        "institution, or Twilio.”",
    ])
    s += [Spacer(1, 8),
          P("Deliberate exclusions", "h2"),
          table([
              ["Excluded", "Reason"],
              ["Complaint narratives", "Opt-in, unverified, revocable consent — a snapshot is "
                                       "not reproducible. No NLP, sentiment, or LLM processing."],
              ["tags (Older American, Servicemember)", "Protected/vulnerable-population attribute. "
                                                       "Governance decision, not oversight."],
              ["zip_code", "Re-identification surface with no MVP requirement; ~5.7% are masks."],
              ["Raw source files in Git", "1.4 GB and freely re-downloadable. Committing them would "
                                          "defeat the provenance model."],
          ], [2.0, 4.9]),
          Spacer(1, 8),
          P("Type and null handling", "h2")]
    s += bullets([
        "<b>complaint_id is a string</b>, not an integer — the OpenAPI spec says int64, the "
        "live API returns a string.",
        "<b>Masked ZIP values containing X</b> are privacy masks, never real postal codes. "
        "Never cast, parse, or geocode them.",
        "<b>Literal “None”</b> in CSV exports must become null — never a "
        "legitimate taxonomy category.",
        "<b>Unknown values stay unknown.</b> Never default to a favorable or unfavorable state.",
    ])

    # ---- 8. build sequence
    s += [P("8. Build sequence", "h1"),
          table([
              ["Milestone", "Deliverable", "Human verification gate"],
              ["1. Charter", "Product contract, provenance, dictionary, policy, architecture, "
                             "limitations, metric register, ADRs", "Confirm scope, disclosures, "
                             "and that no unsupported metric survives"],
              ["2. Data foundation", "Snowflake bootstrap, tested raw load, schema validation",
               "Validate the first download, field names, and retrieval record"],
              ["3. dbt core", "Staging, fct_complaints, taxonomy, tests, docs",
               "Review grain and source-field mapping before build"],
              ["4. Intelligence", "Trend and policy models, agent context, action queue, seeds",
               "Spot-check aggregates against independent SQL"],
              ["5. Product surface", "Curated export, Vercel site, methodology and limitation pages",
               "Review every exposed column against the register"],
              ["6. Proof", "CI, dbt docs, screenshots, demo script, case study",
               "Rehearse the explanation of limitations and tradeoffs"],
          ], [1.15, 2.85, 2.9]),
          Spacer(1, 10),
          P("Success measures", "h2"),
          table([
              ["Area", "Portfolio measure"],
              ["Data trust", "100% of final actions carry policy ID, reason code, and confidence"],
              ["Usability", "A reviewer understands source, logic, limitations, and action in "
                            "under five minutes"],
              ["Product quality", "No prohibited claims; no direct PII; transparent caveats"],
              ["Operational signal", "Emerging patterns visible with documented thresholds and "
                                     "qualification"],
              ["Technical rigor", "Reproducible load &#187; dbt build &#187; demo export path"],
          ], [1.35, 5.55])]

    # ---- 9. positioning close
    s += [P("9. Final positioning", "h1"),
          table([
              ["Product", "Customer Resolution Intelligence"],
              ["Category", "Customer-issue intelligence and decisioning layer"],
              ["Core flow", "Customer signal &#187; Context &#187; Pattern &#187; Priority &#187; Action"],
              ["Tagline", "Turn customer signals into the next best action."],
          ], [1.15, 5.75], header=False),
          Spacer(1, 12),
          P("“I built Customer Resolution Intelligence, a Snowflake and dbt decision layer that "
            "converts public CFPB complaint records into governed issue context, "
            "emerging-pattern signals, and explainable operational next-best actions. It is "
            "intentionally not a complaint-management system or a financial decision engine. "
            "It demonstrates the trusted data foundation AI and human agents need to resolve "
            "customer issues with more context and consistency.”", "quote"),
          Spacer(1, 14),
          callout(
              "The constraints are the deliverable",
              "This project's premise is that a data product is only as good as the claims it "
              "refuses to make. An independent source audit disproved several of its own "
              "founding assumptions, and the response was to remove capabilities rather than "
              "soften language — a response-time metric that would have measured a "
              "government API's routing speed, and a policy built on a field that no longer "
              "exists. What remains is defensible end to end."),
          Spacer(1, 16),
          P("Source links", "h2"),
          table([
              ["CFPB Consumer Complaint Database",
               "consumerfinance.gov/data-research/consumer-complaints/"],
              ["Field reference", "cfpb.github.io/api/ccdb/fields.html"],
              ["Release notes", "cfpb.github.io/api/ccdb/release-notes.html"],
              ["Bulk CSV archive", "files.consumerfinance.gov/ccdb/complaints.csv.zip"],
              ["Twilio agent productivity", "twilio.com/en-us/solutions/agent-productivity"],
          ], [2.0, 4.9], header=False),
          Spacer(1, 10),
          P(f"Generated {date.today():%B %d, %Y} from docs/ by scripts/build_spec_pdf.py. "
            "The Markdown documents under docs/ are authoritative.", "meta")]

    return s


if __name__ == "__main__":
    build(content())
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
