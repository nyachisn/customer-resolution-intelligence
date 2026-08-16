/**
 * Overview — the story before the analysis.
 *
 * Every figure comes from the curated export. Nothing on this page is
 * hardcoded: if a value is missing the card is not rendered.
 */

import Link from "next/link";
import { MetricCard, PageHeader, SectionHead } from "@/components/ui/Primitives";
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

const FLOW = [
  { name: "Source", desc: "Public complaint records" },
  { name: "Transform", desc: "Structured and enriched" },
  { name: "Analyze", desc: "Trends and signals" },
  { name: "Prioritize", desc: "What needs attention" },
  { name: "Explore", desc: "Investigate the question" },
];

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
    <div>
      <PageHeader
        title="Customer Resolution Intelligence"
        lede="Understand what customers are experiencing. Find what is changing. Decide what needs attention."
        actions={
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            <Link href="/insights" className="btn">
              See what&apos;s changing
            </Link>
            <Link href="/explore" className="btn btn-secondary">
              Explore the data
            </Link>
          </div>
        }
      />

      <SectionHead
        title="Understanding the data"
        description="The evidence base behind every insight in this product."
      />

      <div className="metric-grid">
        {ledger && (
          <MetricCard
            label="Complaints analyzed"
            value={ledger.totalRecords.toLocaleString()}
            foot={`${ledger.minDate.slice(0, 4)} to ${ledger.maxDate.slice(0, 4)}`}
            definition="Every published complaint record in the source archive, after records missing a required field are excluded."
          />
        )}
        {ledger && (
          <MetricCard
            label="Product categories"
            value={String(ledger.distinctProducts)}
            foot="Tracked independently"
            definition="Distinct product categories as published. Legacy and current labels are kept separate rather than merged, so a category is never silently rewritten."
          />
        )}
        <MetricCard
          label="Issue areas monitored"
          value={String(issueCount)}
          foot="With active trend coverage"
          definition="Product areas carrying enough volume to compute a trend against their own baseline. Areas below the volume threshold are not scored."
        />
        {comparison && (
          <MetricCard
            label="Recent complaint volume"
            value={formatCompact(comparison.current)}
            foot={`${comparison.currentDays} days to ${formatDate(comparison.currentEnd)}`}
            definition={`Volume over the most recent complete ${comparison.currentDays}-day window. The trailing ${lag} days are held back because recent records are still being published.`}
          />
        )}
        {comparison && (
          <MetricCard
            label="Change vs prior period"
            value={formatPct(comparison.changePct, { signed: true })}
            foot={`vs ${formatDate(comparison.previousStart)} – ${formatDate(comparison.previousEnd)}`}
            definition="Compares two equal, consecutive windows. Both windows sit outside the publication-lag period so the comparison is like for like."
          />
        )}
        <MetricCard
          label="Time period covered"
          value={`${dates.length} days`}
          foot={`${formatDate(dates[0] ?? "")} onward`}
          definition="The daily analytical window available for exploration in this product."
        />
      </div>

      <SectionHead
        title="How it works"
        description="Complaint records become intelligence in five steps."
        note={<Link href="/data-story">See the full data story →</Link>}
      />

      <div className="flow-strip">
        {FLOW.map((node, i) => (
          <div className="flow-node" key={node.name}>
            <div className="flow-idx">0{i + 1}</div>
            <div className="flow-name">{node.name}</div>
            <div className="flow-desc">{node.desc}</div>
          </div>
        ))}
      </div>

      <SectionHead title="Where to start" />

      <div className="insight-grid">
        <Link href="/insights" className="insight-card">
          <h3>What&apos;s happening</h3>
          <p className="insight-body">
            The movements worth knowing about this period, ranked by how much
            they changed against their own baseline.
          </p>
          <span className="insight-foot">View insights</span>
        </Link>
        <Link href="/explore" className="insight-card">
          <h3>Answer your own question</h3>
          <p className="insight-body">
            Filter by product, period and measure. Compare against the prior
            period and drill into any trend you find.
          </p>
          <span className="insight-foot">Open Explore</span>
        </Link>
        <Link href="/decisions" className="insight-card">
          <h3>What needs attention</h3>
          <p className="insight-body">
            A prioritized queue of patterns, each with the signal behind it and
            a recommended next step.
          </p>
          <span className="insight-foot">Review decisions</span>
        </Link>
      </div>
    </div>
  );
}
