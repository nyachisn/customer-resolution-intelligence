/**
 * Data Story — how source records become usable intelligence.
 *
 * Narrative, not implementation documentation. Counts come from the export
 * so the story stays true as the data moves.
 */

import Link from "next/link";
import { Chip, PageHeader, SectionHead } from "@/components/ui/Primitives";
import { loadDemoMeta, loadLedgerExhibits, loadOperationsMetrics } from "@/lib/demo-data";
import { datesFor, dimensionsFor, formatDate } from "@/lib/analytics";

export const metadata = { title: "Data Story" };

export default async function DataStoryPage() {
  const [meta, ledger, metrics] = await Promise.all([
    loadDemoMeta(),
    loadLedgerExhibits(),
    loadOperationsMetrics(),
  ]);

  const dates = datesFor(metrics, "complaint_volume");
  const products = dimensionsFor(metrics, "complaint_volume").length;
  const actions = dimensionsFor(metrics, "action_count");

  const steps = [
    {
      title: "Source",
      body: "Consumer complaint records published by the Consumer Financial Protection Bureau. Public, official, and updated continuously.",
      chips: ledger
        ? [`${ledger.totalRecords.toLocaleString()} records`, `${ledger.minDate.slice(0, 4)}–${ledger.maxDate.slice(0, 4)}`]
        : [],
    },
    {
      title: "Ingest",
      body: "Records land unchanged, exactly as published. Nothing is edited or interpreted at this stage — the original stays intact so any later number can be traced back to it.",
      chips: ledger ? [`${ledger.distinctProducts} product categories`] : [],
    },
    {
      title: "Transform",
      body: "Records are standardized and enriched: fields are typed consistently, categories are preserved as published rather than merged, and records missing anything decision-critical are set aside instead of quietly filled in.",
      chips: ledger ? [`${ledger.completeness[0]?.label ?? "Complete"} records prioritized`] : [],
    },
    {
      title: "Analyze",
      body: "Daily volume, trend direction, and emerging-pattern status are computed for each product and issue — always against that pattern's own history, never against another product's scale.",
      chips: [`${products} products tracked`, `${dates.length} days of daily coverage`],
    },
    {
      title: "Prioritize",
      body: "Policy rules run over every record and assign one recommended action, with the reason and confidence attached. Most records need nothing; the ones that do say exactly why.",
      chips: actions.map((a) => a.replaceAll("_", " ").toLowerCase()),
    },
    {
      title: "Explore",
      body: "The result is a working surface: filter, compare periods, and follow any signal down to the pattern driving it.",
      chips: [],
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Data Story"
        title="How complaint records become intelligence"
        lede="Six steps from a public record to a decision someone can act on."
      />

      <div className="pipeline">
        {steps.map((step, i) => (
          <article className="pipeline-step" key={step.title}>
            <div className="pipeline-num">0{i + 1}</div>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {step.chips.length > 0 && (
                <div className="pipeline-detail">
                  {step.chips.map((c) => (
                    <Chip key={c} tone="neutral">
                      {c}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <SectionHead
        title="What the numbers can and cannot say"
        description="A short note on reading this data well."
      />

      <div className="note-card">
        <p style={{ margin: "0 0 0.7rem" }}>
          <strong>Volume reflects what was reported and published</strong> — not
          everything customers experienced. Comparisons are most meaningful
          within a single product area, where the same reporting conditions
          apply.
        </p>
        <p style={{ margin: "0 0 0.7rem" }}>
          <strong>Recent records are still arriving.</strong> The most recent{" "}
          {meta.publication_lag_window_days} days are held out of every
          period comparison, because a record published today may not be
          complete yet. Counting them would read as a decline that is really
          just timing.
        </p>
        <p style={{ margin: 0 }}>
          <strong>A signal is a prompt, not a conclusion.</strong> An emerging
          pattern means something moved enough to be worth a look. What it
          means is for the person investigating it to establish.
        </p>
      </div>

      <SectionHead title="Where this leads" />
      <div className="insight-grid">
        <Link href="/insights" className="insight-card">
          <h3>Insights</h3>
          <p className="insight-body">The movements worth knowing about this period.</p>
          <span className="insight-foot">View insights</span>
        </Link>
        <Link href="/explore" className="insight-card">
          <h3>Explore</h3>
          <p className="insight-body">
            Filter, compare, and investigate the question you actually have.
          </p>
          <span className="insight-foot">Open Explore</span>
        </Link>
      </div>

      <p style={{ marginTop: "2rem", fontSize: "0.83rem", color: "var(--text-muted)" }}>
        Data current as of {formatDate(meta.generated_at_utc)}.
      </p>
    </div>
  );
}
