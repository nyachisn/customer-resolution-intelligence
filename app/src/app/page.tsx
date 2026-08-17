/**
 * Overview — the problem, the product, and one worked example.
 *
 * Every figure is read from the curated export at request time. The two
 * record counts are deliberately kept distinct: 17,119,581 published records
 * are modelled, and 16,896,978 of those fall inside complete calendar months,
 * which is what the analytical experience reads. Collapsing them into one
 * number would misstate both.
 */

import Link from "next/link";
import { Sparkline } from "@/components/ui/Sparkline";
import { loadArchiveExplorer, loadLedgerExhibits } from "@/lib/demo-data";
import { archiveMonths, archiveTotals, familySeries } from "@/lib/archive-analytics";
import { formatCompact, formatMonth, formatPct } from "@/lib/analytics";
import { WAREHOUSE } from "@/lib/pipeline";

const PIPELINE_STEPS = [
  { name: "Source", detail: "A published CFPB complaint" },
  { name: "Clean", detail: "Standardize and validate" },
  { name: "Measure", detail: "Daily volume by product and issue" },
  { name: "Compare", detail: "Measure against the issue's own history" },
  { name: "Prioritize", detail: "Apply the decision policies" },
  { name: "Review", detail: "Investigate what stands out" },
];

export default async function OverviewPage() {
  const [ledger, archive] = await Promise.all([loadLedgerExhibits(), loadArchiveExplorer()]);

  const rows = archive?.monthlyProductVolume ?? [];
  const months = archiveMonths(rows);
  const totals = archiveTotals(rows, months);
  const families = familySeries(rows, months);

  const modelled = ledger?.totalRecords ?? WAREHOUSE.modelledRows;
  const inMonths = rows.reduce((s, r) => s + r.total, 0);

  // The demonstration for "totals hide movement". Picking the fastest-growing
  // small category would not make the point here: the archive total is itself
  // up 56%, so a category growing at a similar rate proves nothing. The
  // category that *diverges* most from the total does — and in this data it
  // moves in the opposite direction entirely.
  const overall = families.length > 0 ? familyChange(totals) : null;
  const hidden =
    overall?.changePct == null
      ? undefined
      : families
          .filter((f) => f.share < 0.05 && f.changePct != null && f.recent12m > 1000)
          .sort(
            (a, b) =>
              Math.abs((b.changePct ?? 0) - overall.changePct!) -
              Math.abs((a.changePct ?? 0) - overall.changePct!),
          )[0];

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="band wash">
        <div className="hero container">
          <h1>From millions of complaints to signals worth investigating</h1>
          <p className="hero-sub">
            Explore patterns across the CFPB Consumer Complaint Database, compare changes over
            time, and identify issues that have moved enough to warrant investigation.
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

      {/* ---------------- the dataset ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>What you are looking at</h2>
            <p>
              Every complaint the CFPB has published since December 2011, modeled so that a
              category, an issue or a month can be compared against its own history rather than
              against the total.
            </p>
          </div>
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
              <span className="figure-value">{families.length}</span>
              <span className="figure-label">
                Product categories, from {WAREHOUSE.publishedProducts} published labels
              </span>
            </div>
            <div className="figure">
              <span className="figure-value">{WAREHOUSE.issueAreas}</span>
              <span className="figure-label">Issue areas</span>
            </div>
            <div className="figure">
              <span className="figure-value">{months.length}</span>
              <span className="figure-label">
                Complete months
                {months.length > 0 &&
                  `, ${formatMonth(`${months[0]}-01`)} – ${formatMonth(`${months[months.length - 1]}-01`)}`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- why totals aren't enough ---------------- */}
      {overall && hidden && (
        <section className="band band-tint section">
          <div className="container">
            <div className="section-head">
              <h2>Why totals are not enough</h2>
              <p>
                One category accounts for most of the file, so the headline number mostly tracks
                that category. Smaller ones can be moving at a different rate — or in the opposite
                direction — without registering in the total at all.
              </p>
            </div>
            <div className="compare-pair">
              <article className="compare">
                <h3>Every category</h3>
                <p className="compare-figure">
                  {formatCompact(overall.recent)}
                  <span className="compare-unit">complaints</span>
                  <span className={`compare-delta is-${overall.dir}`}>
                    {formatPct(overall.changePct, { signed: true })}
                  </span>
                </p>
                <p className="compare-note">
                  Last 12 months against the 12 before. {families[0].family.label} is{" "}
                  {formatPct(families[0].share)} of the file, so this mostly tracks it.
                </p>
                <Sparkline points={totals.map((p) => p.value)} />
              </article>
              <article className="compare is-accent">
                <h3>{hidden.family.label}</h3>
                <p className="compare-figure">
                  {formatCompact(hidden.recent12m)}
                  <span className="compare-unit">complaints</span>
                  <span
                    className={`compare-delta is-${
                      (hidden.changePct ?? 0) > 0.02 ? "up" : (hidden.changePct ?? 0) < -0.02 ? "down" : "flat"
                    }`}
                  >
                    {formatPct(hidden.changePct, { signed: true })}
                  </span>
                </p>
                <p className="compare-note">
                  {formatPct(hidden.share)} of all complaints, moving{" "}
                  {hidden.changePct != null && overall.changePct != null
                    ? `${Math.abs((hidden.changePct - overall.changePct) * 100).toFixed(0)} points`
                    : "differently"}{" "}
                  from the total
                </p>
                <Sparkline points={hidden.points.map((p) => p.value)} accent />
              </article>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- from record to signal ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>What the pipeline does with each complaint</h2>
          </div>
          <Link href="/data-story" className="steps-link">
            <ol className="steps">
              {PIPELINE_STEPS.map((step) => (
                <li className="step" key={step.name}>
                  <span className="step-name">{step.name}</span>
                  <span className="step-detail">{step.detail}</span>
                </li>
              ))}
            </ol>
            <span className="steps-cta">See how it&rsquo;s built →</span>
          </Link>
        </div>
      </section>

      {/* ---------------- foundation ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>What it runs on</h2>
          </div>
          <dl className="stack-roles">
            <div className="stack-role">
              <dt>Snowflake</dt>
              <dd>Analytical warehouse</dd>
            </div>
            <div className="stack-role">
              <dt>dbt</dt>
              <dd>{WAREHOUSE.models} version-controlled models</dd>
            </div>
            <div className="stack-role">
              <dt>{WAREHOUSE.tests} tests</dt>
              <dd>Automated data quality</dd>
            </div>
            <div className="stack-role">
              <dt>dbt Cloud</dt>
              <dd>Production orchestration</dd>
            </div>
            <div className="stack-role">
              <dt>Next.js</dt>
              <dd>Analytical product experience</dd>
            </div>
          </dl>
        </div>
      </section>

    </>
  );
}

/** Last 12 complete months against the 12 before them. */
function familyChange(points: { value: number }[]) {
  const recent = points.slice(-12).reduce((s, p) => s + p.value, 0);
  const prior = points.slice(-24, -12).reduce((s, p) => s + p.value, 0);
  const changePct = prior > 0 ? (recent - prior) / prior : null;
  return {
    recent,
    prior,
    changePct,
    dir: changePct == null ? "flat" : changePct > 0.02 ? "up" : changePct < -0.02 ? "down" : "flat",
  };
}
