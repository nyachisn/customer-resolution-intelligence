/**
 * How it's built — the architecture, end to end.
 *
 * Everything structural on this page is read from lib/pipeline.ts, which
 * transcribes the project's real ref() graph and its measured warehouse
 * footprint. Counts that could drift from the warehouse come from the
 * curated export instead, so the page cannot quietly go stale.
 */

import Link from "next/link";
import { ModelDag } from "@/components/ui/ModelDag";
import {
  CfpbMark,
  DbtMark,
  NextMark,
  SnowflakeMark,
  VercelMark,
} from "@/components/ui/TechMarks";
import { loadDemoMeta, loadLedgerExhibits } from "@/lib/demo-data";
import { MODEL_REGISTRY } from "@/lib/model-registry";
import {
  DAG,
  DECISIONS,
  DECISION_CHAIN,
  LAYER_LABEL,
  STAGES,
  TRUST,
  WAREHOUSE,
  type Layer,
} from "@/lib/pipeline";

export const metadata = { title: "How it's built" };

const STAGE_MARK: Record<string, React.ReactNode> = {
  source: <CfpbMark />,
  raw: <SnowflakeMark />,
  transform: <DbtMark />,
  analytics: <SnowflakeMark />,
  export: <NextMark />,
  serve: <VercelMark />,
};

const TRANSFORM_CHAIN = [
  { name: "Source", note: "CFPB bulk extract" },
  { name: "Raw", note: "Landed unchanged" },
  { name: "Staging", note: "Typed and filtered" },
  { name: "Intermediate", note: "Joined and derived" },
  { name: "Marts", note: "Analytics-ready" },
  { name: "Decisioning", note: "One action per record" },
];

const ARCHITECTURE_QUALITIES = [
  {
    name: "Reliable",
    detail:
      "91 tests run on every build and on every pull request. A failure stops the run rather than publishing a number nobody checked.",
  },
  {
    name: "Traceable",
    detail:
      "The lineage below is derived from the SQL itself. Every figure in the product names the model it came from, and that model names its own limitations.",
  },
  {
    name: "Decision-ready",
    detail:
      "The pipeline does not stop at a table. Policies are evaluated, precedence is applied, and each record leaves with one recommendation and the reasons behind it.",
  },
  {
    name: "Scalable",
    detail:
      "17.1M rows rebuild in minutes on an extra-small warehouse that costs nothing when idle. Adding a year of data changes runtime, not architecture.",
  },
];

export default async function DataStoryPage() {
  const [meta, ledger] = await Promise.all([loadDemoMeta(), loadLedgerExhibits()]);

  const total = ledger?.totalRecords ?? WAREHOUSE.modelledRows;
  const byLayer = (layer: Layer) => DAG.filter((m) => m.layer === layer);

  return (
    <>
      {/* ---------------- the architecture ---------------- */}
      <section className="band wash">
        <div className="container" style={{ paddingTop: "3.5rem", paddingBottom: "2.5rem" }}>
          <div className="section-head" style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "clamp(2.1rem, 3.8vw, 3rem)" }}>
              From a public file to a decision
            </h2>
            <p>
              Six stages, three systems, and one direction of travel. Data leaves the CFPB once
              and every step after it is versioned, tested and reproducible.
            </p>
          </div>

          <ol className="flow">
            {STAGES.map((stage, i) => (
              <li className="flow-step" key={stage.id}>
                <div className="flow-card">
                  <span className="flow-mark" aria-hidden="true">
                    {STAGE_MARK[stage.id]}
                  </span>
                  <h3 className="flow-name">{stage.name}</h3>
                  <p className="flow-system">{stage.system}</p>
                  <p className="flow-detail">{stage.detail}</p>
                  <span className="flow-output">{stage.output}</span>
                </div>
                {i < STAGES.length - 1 && <span className="flow-arrow" aria-hidden="true" />}
              </li>
            ))}
          </ol>

          <p className="flow-loop">
            Two of those stages write back to where they came from: dbt reads Snowflake and
            materializes into Snowflake, and the export reads the warehouse to produce a file that
            is committed to Git — which is what Vercel then builds.
          </p>
        </div>
      </section>

      {/* ---------------- the numbers ---------------- */}
      <section className="band band-tint">
        <div className="container" style={{ paddingTop: "2.25rem", paddingBottom: "2.25rem" }}>
          <div className="figures">
            <div className="figure">
              <span className="figure-value">{(total / 1_000_000).toFixed(1)}M</span>
              <span className="figure-label">Complaints modelled</span>
            </div>
            <div className="figure">
              <span className="figure-value">{WAREHOUSE.models}</span>
              <span className="figure-label">dbt models</span>
            </div>
            <div className="figure">
              <span className="figure-value">{WAREHOUSE.layers}</span>
              <span className="figure-label">Transformation layers</span>
            </div>
            <div className="figure">
              <span className="figure-value">{WAREHOUSE.tests}</span>
              <span className="figure-label">Tests on every build</span>
            </div>
            <div className="figure">
              <span className="figure-value">{WAREHOUSE.storageGb} GB</span>
              <span className="figure-label">Raw and analytics storage</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- lineage ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>Every model, and what it depends on</h2>
            <p>
              Generated from the project&rsquo;s own <code>ref()</code> calls, so it cannot drift
              from the code. Columns are build order — a model runs once everything to its left has
              finished. Hover a model to isolate its dependencies.
            </p>
          </div>
          <ModelDag />
          <div className="dag-key">
            <span className="dag-key-item">
              <span className="dag-swatch is-staging" /> {LAYER_LABEL.staging} ·{" "}
              {byLayer("staging").length} model
            </span>
            <span className="dag-key-item">
              <span className="dag-swatch is-intermediate" /> {LAYER_LABEL.intermediate} ·{" "}
              {byLayer("intermediate").length} models
            </span>
            <span className="dag-key-item">
              <span className="dag-swatch is-mart" /> {LAYER_LABEL.mart} ·{" "}
              {byLayer("mart").length} models
            </span>
            <span className="dag-key-note">
              Marts persist as tables; staging and intermediate stay views, so the warehouse holds{" "}
              {WAREHOUSE.martTables} model tables and {WAREHOUSE.seeds} seeds.
            </span>
          </div>
        </div>
      </section>

      {/* ---------------- how data transforms ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>What each layer is allowed to assume</h2>
            <p>
              Each layer is trusted for exactly one thing, which is what makes a wrong number
              traceable to a single place.
            </p>
          </div>
          <ol className="chain">
            {TRANSFORM_CHAIN.map((step, i) => (
              <li className="chain-step" key={step.name}>
                <span className="chain-index" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="chain-name">{step.name}</span>
                <span className="chain-note">{step.note}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- data to decision ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>How one complaint becomes one recommendation</h2>
            <p>
              The pipeline does not stop at an analytics table. This is the path a single published
              record takes through it.
            </p>
          </div>
          <div className="decision-chain">
            {DECISION_CHAIN.map((step, i) => (
              <div className="dc-step" key={step.stage}>
                <div className="dc-head">
                  <span className="dc-stage">{step.stage}</span>
                  {i < DECISION_CHAIN.length - 1 && (
                    <span className="dc-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                </div>
                <p className="dc-detail">{step.detail}</p>
                <code className="dc-model">{step.model}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- why it works ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>What this architecture buys</h2>
          </div>
          <div className="quality-grid">
            {ARCHITECTURE_QUALITIES.map((q) => (
              <div className="quality" key={q.name}>
                <h3>{q.name}</h3>
                <p>{q.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- product decisions ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>The four decisions that shaped it</h2>
          </div>
          <div className="qa-list">
            {DECISIONS.map((d) => (
              <div className="qa" key={d.question}>
                <h3>{d.question}</h3>
                <p>{d.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- trust ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>How the numbers are kept honest</h2>
          </div>
          <div className="trust-list">
            {TRUST.map((t) => (
              <div className="trust-row" key={t.name}>
                <h3>{t.name}</h3>
                <p>{t.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- catalog ---------------- */}
      <section className="band section">
        <div className="container">
          <details className="catalog">
            <summary>
              <span className="catalog-title">The model catalog</span>
              <span className="catalog-hint">
                All {WAREHOUSE.models} models, their grain and their limitations
              </span>
            </summary>
            <div className="table-wrap" style={{ marginTop: "1.5rem" }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Layer</th>
                    <th scope="col">Model</th>
                    <th scope="col">Grain</th>
                    <th scope="col">What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {MODEL_REGISTRY.map((m) => (
                    <tr key={m.name}>
                      <td>{m.layer}</td>
                      <td style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{m.name}</td>
                      <td>{m.grain}</td>
                      <td>{m.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </section>

      {/* ---------------- reading the numbers ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>Reading the numbers</h2>
          </div>
          <div className="note">
            <p>
              <strong>Volume is what was reported and published</strong>, which is not the same as
              what customers experienced. A comparison holds within one category, where reporting
              conditions are alike.
            </p>
            <p>
              <strong>The most recent records are still arriving.</strong> The trailing{" "}
              {meta.publication_lag_window_days} days sit outside every period comparison and the
              current month is excluded entirely, because counting a partial month reads as a
              decline that is only timing.
            </p>
            <p>
              <strong>A signal is a prompt.</strong> An emerging pattern means something moved
              enough to be worth a look. What it means is for whoever investigates it to establish
              — and <Link href="/methodology">the methodology</Link> sets out what this data cannot
              answer.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
