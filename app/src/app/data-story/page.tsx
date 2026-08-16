/**
 * Data Story — how source records become usable intelligence.
 *
 * Narrative, not implementation documentation. Counts come from the export
 * so the story stays true as the data moves.
 */

import Link from "next/link";
import { Chip, PageHeader, SectionHead } from "@/components/ui/Primitives";
import { PipelineDiagram } from "@/components/ui/PipelineDiagram";
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

  const stages = [
    { name: "Source", meta: ledger ? `${(ledger.totalRecords / 1_000_000).toFixed(1)}M records` : "CFPB" },
    { name: "Ingest", meta: "Unchanged" },
    { name: "Transform", meta: ledger ? `${ledger.distinctProducts} categories` : "Typed" },
    { name: "Analyze", meta: `${dates.length} days` },
    { name: "Prioritize", meta: `${actions.length} outcomes` },
    { name: "Explore", meta: "Investigate" },
  ];

  const detail = [
    {
      title: "Source",
      body: "Consumer complaint records published by the Consumer Financial Protection Bureau. Public, official, updated continuously.",
      chips: ledger ? [`${ledger.minDate.slice(0, 4)}–${ledger.maxDate.slice(0, 4)}`] : [],
    },
    {
      title: "Ingest",
      body: "Records land exactly as published. Nothing is edited or interpreted here, so any later number can be traced back to its original.",
      chips: [],
    },
    {
      title: "Transform",
      body: "Fields are typed consistently and categories preserved as published rather than merged. Records missing anything decision-critical are set aside, not filled in.",
      chips: ledger ? [`${ledger.distinctProducts} product categories`] : [],
    },
    {
      title: "Analyze",
      body: "Daily volume, trend direction and emerging-pattern status are computed per product and issue — always against that pattern's own history.",
      chips: [`${products} products`, `${dates.length} days`],
    },
    {
      title: "Prioritize",
      body: "Policy rules run over every record and assign one recommended action, with its reason and confidence attached. Most records need nothing.",
      chips: actions.map((a) => a.replaceAll("_", " ").toLowerCase()),
    },
    {
      title: "Explore",
      body: "The result is a working surface: filter, compare periods, and follow any signal down to the pattern driving it.",
      chips: [],
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Data Story"
        title="How complaint records become intelligence"
        lede="Six steps from a public record to a decision someone can act on."
      />

      <section className="band section">
        <div className="container">
          <PipelineDiagram stages={stages} />
        </div>
      </section>

      <section className="band-tint section">
        <div className="container">
          <SectionHead
            eyebrow="Each stage"
            title="What happens, and what it guarantees"
          />
          <div className="stage-detail">
            {detail.slice(0, 3).map((d, i) => (
              <div className="stage-cell" key={d.title}>
                <div className="eyebrow eyebrow-muted">{String(i + 1).padStart(2, "0")}</div>
                <h3>{d.title}</h3>
                <p>{d.body}</p>
                {d.chips.length > 0 && (
                  <div className="stage-chips">
                    {d.chips.map((c) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="stage-detail" style={{ marginTop: "1.25rem" }}>
            {detail.slice(3).map((d, i) => (
              <div className="stage-cell" key={d.title}>
                <div className="eyebrow eyebrow-muted">{String(i + 4).padStart(2, "0")}</div>
                <h3>{d.title}</h3>
                <p>{d.body}</p>
                {d.chips.length > 0 && (
                  <div className="stage-chips">
                    {d.chips.map((c) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band section">
        <div className="container">
          <SectionHead
            eyebrow="Reading it well"
            title="What the numbers can and cannot say"
          />
          <div className="note">
            <p>
              <strong>Volume reflects what was reported and published</strong> —
              not everything customers experienced. Comparisons are most
              meaningful within a single product area, where the same reporting
              conditions apply.
            </p>
            <p>
              <strong>Recent records are still arriving.</strong> The most recent{" "}
              {meta.publication_lag_window_days} days are held out of every
              period comparison, because a record published today may not be
              complete yet. Counting them would read as a decline that is really
              just timing.
            </p>
            <p>
              <strong>A signal is a prompt, not a conclusion.</strong> An
              emerging pattern means something moved enough to be worth a look.
              What it means is for the person investigating it to establish.
            </p>
          </div>
        </div>
      </section>

      <section className="band-tint section">
        <div className="container">
          <SectionHead eyebrow="Next" title="Where this leads" />
          <div className="card-grid">
            <Link href="/insights" className="card">
              <div className="eyebrow eyebrow-muted">Insights</div>
              <h3>What&apos;s happening</h3>
              <p>The movements worth knowing about this period.</p>
              <span className="card-cta">View insights</span>
            </Link>
            <Link href="/explore" className="card">
              <div className="eyebrow eyebrow-muted">Explore</div>
              <h3>Answer your own question</h3>
              <p>Filter, compare, and investigate the question you actually have.</p>
              <span className="card-cta">Open explore</span>
            </Link>
            <Link href="/decisions" className="card">
              <div className="eyebrow eyebrow-muted">Decisions</div>
              <h3>What needs attention</h3>
              <p>A prioritized queue with the signal behind each item.</p>
              <span className="card-cta">Review queue</span>
            </Link>
          </div>
          <p style={{ marginTop: "2rem", fontSize: ".78rem", color: "var(--text-3)", fontFamily: "var(--mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
            Data current as of {formatDate(meta.generated_at_utc)}
          </p>
        </div>
      </section>
    </>
  );
}
