/**
 * How it's built — the architecture, end to end.
 *
 * Everything structural on this page is read from lib/pipeline.ts, which
 * transcribes the project's real ref() graph and its measured warehouse
 * footprint. Counts that could drift from the warehouse come from the
 * curated export instead, so the page cannot quietly go stale.
 */

import { ModelDag } from "@/components/ui/ModelDag";
import { PipelineStages } from "@/components/ui/PipelineStages";
import { loadLedgerExhibits } from "@/lib/demo-data";
import {
  DAG,
  DECISIONS,
  STACK_ROLES,
  DECISION_CHAIN,
  LAYER_LABEL,
  TRUST,
  WAREHOUSE,
  type Layer,
} from "@/lib/pipeline";

export const metadata = { title: "How it's built" };

export default async function DataStoryPage() {
  const ledger = await loadLedgerExhibits();

  const total = ledger?.totalRecords ?? WAREHOUSE.modelledRows;
  const byLayer = (layer: Layer) => DAG.filter((m) => m.layer === layer);

  return (
    <>
      {/* ---------------- hero + pipeline ---------------- */}
      <section className="band wash">
        <div className="container" style={{ paddingTop: "3.5rem", paddingBottom: "2.5rem" }}>
          <div className="section-head" style={{ marginBottom: "2.25rem", maxWidth: "70ch" }}>
            <h2 style={{ fontSize: "clamp(2.1rem, 3.8vw, 3rem)" }}>How it&rsquo;s built</h2>
            <p className="hero-sub">From structured public data to decision-ready intelligence</p>
            <p>
              A batch ELT pipeline loads CFPB complaint data into Snowflake, transforms it through
              a dependency-driven dbt model DAG, applies analytical and decisioning logic, and
              publishes curated data for exploration.
            </p>
          </div>

          <PipelineStages />

          <div className="arch-sentence">
            <h3>The architecture in one sentence</h3>
            <p>
              Snowflake stores and serves the analytical data, dbt transforms and tests it, dbt
              Cloud orchestrates production runs, and the application consumes curated analytical
              outputs.
            </p>
            <dl className="stack-roles">
              {STACK_ROLES.map((r) => (
                <div className="stack-role" key={r.tool}>
                  <dt>{r.tool}</dt>
                  <dd>{r.job}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------- the numbers ---------------- */}
      <section className="band band-tint">
        <div className="container" style={{ paddingTop: "2.25rem", paddingBottom: "2.25rem" }}>
          <div className="figures">
            <div className="figure">
              <span className="figure-value">{(total / 1_000_000).toFixed(1)}M</span>
              <span className="figure-label">Published complaint records modeled</span>
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
              <span className="figure-label">Automated tests</span>
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
            <h2>The dbt models</h2>
            <p>
              Each model has a defined grain and a specific analytical responsibility. The
              dependency graph is generated from dbt <code>ref()</code> relationships, so the visual
              reflects the actual project DAG. Columns are build order; hover a model to isolate
              its dependencies.
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

      {/* ---------------- model catalog ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>What each model is responsible for</h2>
          </div>
          {(["staging", "intermediate", "mart"] as Layer[]).map((layer) => (
            <div className="catalog-layer" key={layer}>
              <h3 className="catalog-layer-name">
                {LAYER_LABEL[layer]}
                <span>{byLayer(layer).length}</span>
              </h3>
              <div className="model-grid">
                {byLayer(layer).map((m) => (
                  <article className="model-card" key={m.name}>
                    <code className="model-name">{m.name}</code>
                    <p className="model-grain">{m.grain}</p>
                    <p className="model-purpose">{m.role}</p>
                    <p className="model-down">
                      {m.materialized === "table"
                        ? `Materialized as a table · ${m.rows?.toLocaleString()} rows`
                        : "Materialized as a view"}
                      {DAG.filter((d) => d.deps.includes(m.name)).length > 0 && (
                        <>
                          {" · feeds "}
                          {DAG.filter((d) => d.deps.includes(m.name))
                            .map((d) => d.name)
                            .join(", ")}
                        </>
                      )}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- data to decision ---------------- */}
      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>How one complaint becomes a prioritized action</h2>
            <p>
              The path a single published record takes, and the model responsible at each step.
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
                {step.model && <code className="dc-model">{step.model}</code>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- why it works ---------------- */}
      <section className="band band-tint section">
        <div className="container">
          <div className="section-head">
            <h2>Why the architecture is structured this way</h2>
          </div>
          <div className="qa-list">
            {DECISIONS.map((d) => (
              <div className="qa" key={d.title}>
                <div>
                  <h3>{d.title}</h3>
                  <p className="qa-sub">{d.subtitle}</p>
                </div>
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
            <h2>How the numbers are validated</h2>
          </div>
          <div className="trust-list">
            {TRUST.map((t) => (
              <div className="trust-row" key={t.name}>
                <h3>{t.name}</h3>
                <div>
                  <p>{t.detail}</p>
                  {t.points && (
                    <ul className="trust-points">
                      {t.points.map((pt) => (
                        <li key={pt}>{pt}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
