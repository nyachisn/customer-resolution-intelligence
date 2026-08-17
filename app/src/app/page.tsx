/**
 * What — the dataset this product is built on.
 *
 * Deliberately about the data and nothing else: what the CFPB publishes,
 * how much of it there is, and what one record contains. How it is
 * transformed belongs on the next route.
 *
 * The two record counts stay distinct: 17,119,581 published records are
 * modeled, and 16,896,978 of those fall inside complete calendar months,
 * which is what the analytical views read.
 */

import Link from "next/link";
import { loadArchiveExplorer, loadLedgerExhibits } from "@/lib/demo-data";
import { archiveMonths, dimensionMix, familySeries } from "@/lib/archive-analytics";
import { formatCompact, formatMonth, formatPct } from "@/lib/analytics";
import { WAREHOUSE } from "@/lib/pipeline";

/** The published outcome strings, shortened so they read in a narrow row. */
const OUTCOME_LABEL: Record<string, string> = {
  "Closed with explanation": "Explanation given",
  "Closed with monetary relief": "Money returned",
  "Closed with non-monetary relief": "Non-monetary fix",
  "Closed without relief": "Closed, no relief",
  "Closed with relief": "Relief given",
  "Untimely response": "Missed the standard",
  "In progress": "Still open",
};

/** The fields the CFPB publishes on each complaint, as the models see them. */
const RECORD_FIELDS = [
  { name: "Product", detail: "The financial product the complaint is about" },
  { name: "Issue", detail: "What went wrong, from a published taxonomy" },
  { name: "Company response", detail: "How the company closed it" },
  { name: "Timeliness", detail: "Whether the company met the reporting standard" },
  { name: "Date received", detail: "When the complaint was submitted" },
  { name: "State", detail: "The consumer's state" },
  { name: "Submitted via", detail: "Web, phone, referral, mail, fax or email" },
];

export default async function WhatPage() {
  const [ledger, archive] = await Promise.all([loadLedgerExhibits(), loadArchiveExplorer()]);

  const rows = archive?.monthlyProductVolume ?? [];
  const months = archiveMonths(rows);
  const families = familySeries(rows, months);
  const modelled = ledger?.totalRecords ?? WAREHOUSE.modelledRows;
  const inMonths = rows.reduce((s, r) => s + r.total, 0);

  const outcomes = dimensionMix(archive?.responseByProduct ?? [], null, 5);
  const channels = dimensionMix(archive?.channelByProduct ?? [], null, 4);
  const states = dimensionMix(archive?.stateByProduct ?? [], null, 5);

  const first = months[0];
  const last = months[months.length - 1];

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="band wash">
        <div className="hero container">
          <h1>What you are looking at</h1>
          <p className="hero-sub">
            Every complaint the CFPB has published since December 2011 — {modelled.toLocaleString()}{" "}
            records covering {families.length} product categories and {WAREHOUSE.issueAreas} issue
            areas, modeled so any part of it can be compared against its own history.
          </p>
          <div className="hero-actions">
            <Link href="/explore" className="btn">
              Explore the data
            </Link>
            <Link href="/data-story" className="btn btn-ghost">
              See how it&rsquo;s built
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- the dataset in numbers ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="figures">
            <div className="figure">
              <span className="figure-value">{formatCompact(modelled)}</span>
              <span className="figure-label">Published complaint records modeled</span>
            </div>
            <div className="figure">
              <span className="figure-value">{formatCompact(inMonths)}</span>
              <span className="figure-label">Inside complete months, read by the product</span>
            </div>
            <div className="figure">
              <span className="figure-value">{months.length}</span>
              <span className="figure-label">
                {first && last
                  ? `Complete months, ${formatMonth(`${first}-01`)} – ${formatMonth(`${last}-01`)}`
                  : "Complete months"}
              </span>
            </div>
            <div className="figure">
              <span className="figure-value">{families.length}</span>
              <span className="figure-label">
                Product categories, from {WAREHOUSE.publishedProducts} published labels
              </span>
            </div>
            <div className="figure">
              <span className="figure-value">{WAREHOUSE.issueAreas}</span>
              <span className="figure-label">Issue areas</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- what a record contains ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>What one complaint record holds</h2>
            <p>
              The CFPB publishes a structured record for each complaint. These are the fields the
              models work from — no narrative text and no consumer identifiers.
            </p>
          </div>
          <dl className="field-grid">
            {RECORD_FIELDS.map((f) => (
              <div className="field" key={f.name}>
                <dt>{f.name}</dt>
                <dd>{f.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------- the shape of it ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>How the dataset breaks down</h2>
            <p>Across every complaint published since 2011.</p>
          </div>
          <div className="breakdown-grid">
            <div className="breakdown">
              <h3>Largest categories</h3>
              {families.slice(0, 5).map((f) => (
                <div className="bd-row" key={f.family.id}>
                  <span className="bd-label">{f.family.label}</span>
                  <span className="bd-bar">
                    <span className="bd-fill" style={{ width: `${f.share * 100}%` }} />
                  </span>
                  <span className="bd-value">{formatPct(f.share)}</span>
                </div>
              ))}
            </div>
            <div className="breakdown">
              <h3>How companies closed them</h3>
              {outcomes.map((o) => (
                <div className="bd-row" key={o.value}>
                  <span className="bd-label">{OUTCOME_LABEL[o.value] ?? o.value}</span>
                  <span className="bd-bar">
                    <span className="bd-fill" style={{ width: `${o.share * 100}%` }} />
                  </span>
                  <span className="bd-value">{formatPct(o.share)}</span>
                </div>
              ))}
            </div>
            <div className="breakdown">
              <h3>How they arrived</h3>
              {channels.map((c) => (
                <div className="bd-row" key={c.value}>
                  <span className="bd-label">{c.value}</span>
                  <span className="bd-bar">
                    <span className="bd-fill" style={{ width: `${c.share * 100}%` }} />
                  </span>
                  <span className="bd-value">{formatPct(c.share)}</span>
                </div>
              ))}
            </div>
            <div className="breakdown">
              <h3>Where they came from</h3>
              {states.map((st) => (
                <div className="bd-row" key={st.value}>
                  <span className="bd-label">{st.value}</span>
                  <span className="bd-bar">
                    <span className="bd-fill" style={{ width: `${st.share * 100}%` }} />
                  </span>
                  <span className="bd-value">{formatPct(st.share)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- next ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>Where to go next</h2>
          </div>
          <div className="next-pair">
            <Link href="/explore" className="next-card">
              <h3>Explore the data</h3>
              <p>
                Filter by category, compare a period against the one before it, and open a month
                to see which issues moved inside it.
              </p>
              <span className="next-cta">Open Explore →</span>
            </Link>
            <Link href="/data-story" className="next-card">
              <h3>See how it&rsquo;s built</h3>
              <p>
                The pipeline that loads this data into Snowflake, the {WAREHOUSE.models} dbt models
                that transform it, and the {WAREHOUSE.tests} tests that check it.
              </p>
              <span className="next-cta">Open How →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
