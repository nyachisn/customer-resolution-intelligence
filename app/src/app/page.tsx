/**
 * Overview — an introduction to the data this product is built on, before
 * any analysis is asked of the reader.
 *
 * Every figure comes from the curated export. Nothing is hardcoded: a cell
 * whose value is unavailable is not rendered.
 */

import Link from "next/link";
import { MetricCell } from "@/components/ui/Primitives";
import { PipelineDiagram } from "@/components/ui/PipelineDiagram";
import {
  loadDemoMeta,
  loadLedgerExhibits,
  loadMetricBundle,
  loadOperationsMetrics,
} from "@/lib/demo-data";
import {
  comparePeriods,
  seriesPoints,
  datesFor,
  dimensionsFor,
  formatCompact,
  formatDate,
  formatPct,
} from "@/lib/analytics";

export default async function OverviewPage() {
  const [meta, ledger, metrics, bundle] = await Promise.all([
    loadDemoMeta(),
    loadLedgerExhibits(),
    loadOperationsMetrics(),
    loadMetricBundle(),
  ]);

  const lag = meta.publication_lag_window_days;
  const volume = seriesPoints(bundle.complaint_volume, null);
  const analysed = lag > 0 ? volume.slice(0, -lag) : volume;
  const comparison = comparePeriods(analysed, 28);
  const issueCount = dimensionsFor(metrics, "emerging_issue_count").length;
  const dates = datesFor(metrics, "complaint_volume");

  const stages = [
    {
      name: "Source",
      meta: "CFPB",
      detail:
        "Complaint records published by the Consumer Financial Protection Bureau, downloaded from their public bulk archive. Official, free to use, and updated daily.",
    },
    {
      name: "Ingest",
      meta: "Loaded as-is",
      detail:
        "The archive is split into row-aligned chunks and loaded into a raw layer exactly as published — no edits, no interpretation — so any later number can be traced back to its original record.",
    },
    {
      name: "Transform",
      meta: "Typed and enriched",
      detail:
        "Fields are typed consistently, categories preserved as published rather than merged, and records missing anything decision-critical are set aside instead of quietly filled in.",
    },
    {
      name: "Analyze",
      meta: "Trends computed",
      detail:
        "Daily volume, baseline, rate of change and emerging-pattern status are computed for each product and issue — always against that pattern's own history, never another product's scale.",
    },
    {
      name: "Prioritize",
      meta: "Rules applied",
      detail:
        "Six policy rules run over every record and assign one recommended action, carrying its reason and confidence. Most records need nothing, and that is a real outcome.",
    },
    {
      name: "Explore",
      meta: "Ask questions",
      detail:
        "The result is a working surface: filter by product and period, switch policies on and off, and follow any signal down to the pattern behind it.",
    },
  ];

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="band wash">
        <div className="container hero">
          <h1>
            Millions of complaints. <em>A few</em> that matter.
          </h1>
          <p className="hero-sub">
            This is a working analysis of the public U.S. consumer complaint
            record — what people actually reported, which patterns are moving,
            and which ones are worth someone&apos;s time this week.
          </p>
          <div className="hero-actions">
            <Link href="/explore" className="btn">
              Explore the data
            </Link>
            <Link href="/data-story" className="btn btn-ghost">
              See how it is built
            </Link>
          </div>
        </div>

        <div className="container">
          <div className="split">
            <div>
              <h3>Where the data comes from</h3>
              <p>
                The Consumer Financial Protection Bureau publishes every
                complaint it receives about banks, lenders, credit bureaus and
                other financial companies. It is downloaded directly from their{" "}
                <a href="https://www.consumerfinance.gov/data-research/consumer-complaints/">
                  public database
                </a>{" "}
                — no private customer data is involved, and every figure here
                traces back to a published record.
              </p>
            </div>
            <div>
              <h3>Why it is hard to read</h3>
              <p>
                Records arrive continuously across {ledger?.distinctProducts ?? "dozens of"}{" "}
                product categories. Totals hide the movements that matter: a
                small category doubling disappears next to a large one drifting,
                and the most recent weeks always look like a decline simply
                because those records are still being published.
              </p>
            </div>
            <div>
              <h3>What this does about it</h3>
              <p>
                Every product and issue is measured against its own history.
                Something only surfaces when its volume, its baseline and its
                rate of change all clear threshold together — so what you see is
                genuinely unusual, not just large.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- the numbers ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>What sits behind every number</h2>
            <p>
              The full evidence base available to this product, measured rather
              than asserted.
            </p>
          </div>

          <div className="metric-strip">
            {ledger && (
              <MetricCell
                label="Complaints analyzed"
                value={ledger.totalRecords.toLocaleString()}
                foot={`${ledger.minDate.slice(0, 4)} to ${ledger.maxDate.slice(0, 4)}`}
                definition="Every published complaint record in the source archive, after records missing a required field are excluded."
              />
            )}
            {ledger && (
              <MetricCell
                label="Product categories"
                value={String(ledger.distinctProducts)}
                foot="Tracked separately"
                definition="Distinct product categories as published. Legacy and current labels stay separate rather than merged, so a category is never silently rewritten."
              />
            )}
            <MetricCell
              label="Issue areas monitored"
              value={String(issueCount)}
              foot="With trend coverage"
              definition="Product areas carrying enough volume to compute a trend against their own baseline. Areas below the threshold are not scored."
            />
            {comparison && (
              <MetricCell
                label="Recent volume"
                value={formatCompact(comparison.current)}
                foot={`${comparison.currentDays} days to ${formatDate(comparison.currentEnd)}`}
                definition={`Volume over the most recent complete ${comparison.currentDays}-day window. The trailing ${lag} days are held back because those records are still publishing.`}
              />
            )}
            {comparison && (
              <MetricCell
                label="Change vs prior period"
                value={formatPct(comparison.changePct, { signed: true })}
                foot="Like-for-like windows"
                definition="Compares two equal, consecutive windows. Both sit outside the publication-lag period, so the comparison is not distorted by records still arriving."
              />
            )}
            <MetricCell
              label="Days of daily detail"
              value={String(dates.length)}
              foot={`from ${formatDate(dates[0] ?? "")}`}
              definition="The daily analytical window available for exploration. It ends at the last complete month, so no partial month reads as a decline."
            />
          </div>
        </div>
      </section>

      {/* ---------------- pipeline ---------------- */}
      <section className="band-tint band section">
        <div className="container">
          <div className="section-head">
            <h2>How a published record becomes a decision</h2>
            <p>
              Six steps, each one traceable back to the record it came from.
              Hover any step to see what happens there.
            </p>
          </div>
          <PipelineDiagram stages={stages} />
        </div>
      </section>

      {/* ---------------- next ---------------- */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Take a look for yourself</h2>
          </div>
          <div className="card-grid">
            <Link href="/explore" className="card">
              <h3>Explore the data</h3>
              <p>
                Filter by product and period, compare against the prior period,
                switch decision policies on and off, and see the queue those
                choices produce.
              </p>
              <span className="card-cta">Open explore</span>
            </Link>
            <Link href="/data-story" className="card">
              <h3>See how it is built</h3>
              <p>
                The full path from the CFPB archive through Snowflake, dbt and
                Vercel — including which models do what, and why each one
                exists.
              </p>
              <span className="card-cta">View the pipeline</span>
            </Link>
            <Link href="/methodology" className="card">
              <h3>Check the method</h3>
              <p>
                What this data can and cannot answer, how confidence is
                assigned, and the known quality issues in the source file.
              </p>
              <span className="card-cta">Read methodology</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
