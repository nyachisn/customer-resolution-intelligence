/**
 * Overview — what this is, the problem it addresses, and where the data
 * comes from, before any analysis is asked of the reader.
 *
 * Every figure comes from the curated export. Nothing is hardcoded: a card
 * whose value is unavailable is not rendered.
 */

import Link from "next/link";
import { MetricCell, SectionHead } from "@/components/ui/Primitives";
import { loadDemoMeta, loadLedgerExhibits, loadOperationsMetrics } from "@/lib/demo-data";
import {
  comparePeriods,
  dailySeries,
  datesFor,
  dimensionsFor,
  formatCompact,
  formatDate,
  formatPct,
} from "@/lib/analytics";

export default async function OverviewPage() {
  const [meta, ledger, metrics] = await Promise.all([
    loadDemoMeta(),
    loadLedgerExhibits(),
    loadOperationsMetrics(),
  ]);

  const lag = meta.publication_lag_window_days;
  const volumeSeries = dailySeries(metrics, "complaint_volume");
  const analysed = lag > 0 ? volumeSeries.slice(0, -lag) : volumeSeries;
  const comparison = comparePeriods(analysed, 28);
  const issueCount = dimensionsFor(metrics, "emerging_issue_count").length;
  const dates = datesFor(metrics, "complaint_volume");

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="band wash">
        <div className="container hero">
          <div className="eyebrow">Customer Resolution Intelligence</div>
          <h1>
            Know what customers are <em>actually</em> telling you.
          </h1>
          <p className="hero-sub">
            Complaint data arrives faster than any team can read it. This turns
            millions of records into the handful of things that changed, what
            each one is worth looking at, and what to do next.
          </p>
          <div className="hero-actions">
            <Link href="/insights" className="btn">
              See what&apos;s changing
            </Link>
            <Link href="/explore" className="btn btn-ghost">
              Explore the data
            </Link>
          </div>
        </div>

        <div className="container">
          <div className="split">
            <div>
              <div className="eyebrow eyebrow-muted">The problem</div>
              <h3>Volume outpaces attention</h3>
              <p>
                Complaint records arrive continuously across dozens of product
                areas. Reading them is impossible, and totals alone hide the
                movements that matter — a small category doubling is invisible
                next to a large one drifting.
              </p>
            </div>
            <div>
              <div className="eyebrow eyebrow-muted">The approach</div>
              <h3>Compare each pattern to itself</h3>
              <p>
                Every product and issue is measured against its own history,
                never against another&apos;s scale. Movement qualifies only when
                volume, baseline and rate of change clear threshold together —
                so what surfaces is genuinely unusual.
              </p>
            </div>
            <div>
              <div className="eyebrow eyebrow-muted">The data</div>
              <h3>Public, official, verifiable</h3>
              <p>
                The Consumer Financial Protection Bureau&apos;s complaint
                database — {ledger ? ledger.totalRecords.toLocaleString() : "millions of"}{" "}
                published records{ledger ? ` from ${ledger.minDate.slice(0, 4)} onward` : ""}.
                No private customer data, and every number traceable to a
                published record.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- data at a glance ---------------- */}
      <section className="band section">
        <div className="container">
          <SectionHead
            eyebrow="The evidence base"
            title="What sits behind every number"
            description="The analytical surface available to this product, measured rather than asserted."
          />

          <div className="metric-strip">
            {ledger && (
              <MetricCell
                label="Records analyzed"
                value={ledger.totalRecords.toLocaleString()}
                foot={`${ledger.minDate.slice(0, 4)}–${ledger.maxDate.slice(0, 4)}`}
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
                foot={`${comparison.currentDays}d to ${formatDate(comparison.currentEnd)}`}
                definition={`Volume over the most recent complete ${comparison.currentDays}-day window. The trailing ${lag} days are held back because recent records are still publishing.`}
              />
            )}
            {comparison && (
              <MetricCell
                label="Period change"
                value={formatPct(comparison.changePct, { signed: true })}
                foot="vs prior window"
                definition="Compares two equal, consecutive windows. Both sit outside the publication-lag period so the comparison is like for like."
              />
            )}
            <MetricCell
              label="Daily coverage"
              value={`${dates.length}`}
              foot={`days from ${formatDate(dates[0] ?? "")}`}
              definition="The daily analytical window available for exploration in this product."
            />
          </div>
        </div>
      </section>

      {/* ---------------- where to go ---------------- */}
      <section className="band-tint section">
        <div className="container">
          <SectionHead
            eyebrow="Start here"
            title="Three ways in"
            description="Read what changed, investigate it yourself, or work the queue."
          />
          <div className="card-grid">
            <Link href="/insights" className="card">
              <div className="eyebrow eyebrow-muted">01 · Insights</div>
              <h3>What&apos;s happening</h3>
              <p>
                The movements worth knowing about this period, ranked by how far
                each moved against its own baseline.
              </p>
              <span className="card-cta">View insights</span>
            </Link>
            <Link href="/explore" className="card">
              <div className="eyebrow eyebrow-muted">02 · Explore</div>
              <h3>Answer your own question</h3>
              <p>
                Filter by measure, period and product. Compare against the prior
                period and drill into any trend you find.
              </p>
              <span className="card-cta">Open explore</span>
            </Link>
            <Link href="/decisions" className="card">
              <div className="eyebrow eyebrow-muted">03 · Decisions</div>
              <h3>What needs attention</h3>
              <p>
                A prioritized queue of patterns, each carrying the signal behind
                it and a recommended next step.
              </p>
              <span className="card-cta">Review queue</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section className="band section">
        <div className="container">
          <SectionHead
            eyebrow="How it works"
            title="From published record to decision"
            description="Six steps, each one traceable back to the record it came from."
            aside={
              <Link href="/data-story" className="btn btn-ghost">
                See the data story
              </Link>
            }
          />
          <div className="metric-strip">
            {[
              ["Source", "Public complaint records"],
              ["Ingest", "Landed unchanged"],
              ["Transform", "Typed and enriched"],
              ["Analyze", "Trends and signals"],
              ["Prioritize", "What needs attention"],
              ["Explore", "Investigate the question"],
            ].map(([name, desc], i) => (
              <div className="metric-cell" key={name}>
                <div className="metric-label">{String(i + 1).padStart(2, "0")}</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 450, letterSpacing: "-.012em" }}>
                  {name}
                </div>
                <div className="metric-foot">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
