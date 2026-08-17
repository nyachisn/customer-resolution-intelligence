/**
 * Data Story — the actual technical pipeline: CFPB archive → Snowflake raw
 * → dbt → Snowflake analytics → Next.js on Vercel, plus what each model in
 * the transformation layer does and why it exists.
 *
 * Counts come from the export so the story stays true as the data moves.
 */

import Link from "next/link";
import { Chip, PageHeader } from "@/components/ui/Primitives";
import {
  CfpbMark,
  DbtMark,
  NextMark,
  SnowflakeMark,
  VercelMark,
} from "@/components/ui/TechMarks";
import { loadDemoMeta, loadLedgerExhibits, loadOperationsMetrics } from "@/lib/demo-data";
import { MODEL_REGISTRY } from "@/lib/model-registry";
import { datesFor, dimensionsFor } from "@/lib/analytics";

export const metadata = { title: "Data Story" };

export default async function DataStoryPage() {
  const [meta, ledger, metrics] = await Promise.all([
    loadDemoMeta(),
    loadLedgerExhibits(),
    loadOperationsMetrics(),
  ]);

  const dates = datesFor(metrics, "complaint_volume");
  const products = dimensionsFor(metrics, "complaint_volume").length;

  const stack = [
    {
      mark: <CfpbMark />,
      name: "CFPB",
      role: "Source",
      body: `The public complaint archive, downloaded as a bulk CSV. ${ledger ? ledger.totalRecords.toLocaleString() : "17M+"} published records.`,
    },
    {
      mark: <SnowflakeMark />,
      name: "Snowflake",
      role: "Warehouse",
      body: "Holds the raw load untouched, then the transformed analytics layer. Access is split by role, so the application can never reach raw data.",
    },
    {
      mark: <DbtMark />,
      name: "dbt",
      role: "Transformation",
      body: `13 models across staging, intermediate and mart layers, with ${ledger ? "91" : "90+"} tests that fail the build rather than publish a bad number.`,
    },
    {
      mark: <NextMark />,
      name: "Next.js",
      role: "Application",
      body: "Reads a curated export at build time. The browser never connects to the warehouse, so there is no credential to leak.",
    },
    {
      mark: <VercelMark />,
      name: "Vercel",
      role: "Delivery",
      body: "Serves the built application. Every deploy is immutable and traceable to the commit that produced it.",
    },
  ];

  return (
    <>
      <PageHeader
        title="How this was built"
        lede="The full path from a public government archive to the numbers on the previous page — and what every model in between is for."
      />

      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>The stack, end to end</h2>
            <p>
              Five systems, each doing one job. Data moves left to right and
              never travels backwards.
            </p>
          </div>
          <div className="tech-row">
            {stack.map((t) => (
              <div className="tech-cell" key={t.name}>
                <div className="tech-mark">{t.mark}</div>
                <div>
                  <div className="tech-role">{t.role}</div>
                  <h3>{t.name}</h3>
                </div>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band-tint band section">
        <div className="container">
          <div className="section-head">
            <h2>What happens at each step</h2>
          </div>
          <div className="stack">
            <div className="stack-cell">
              <h3>Download</h3>
              <p>
                The bulk archive is pulled from the CFPB, checked against their
                own published record count, then split into row-aligned chunks —
                loading it as one 9GB file fails partway through.
              </p>
              {ledger && (
                <div className="stack-chips">
                  <Chip>{ledger.totalRecords.toLocaleString()} records</Chip>
                </div>
              )}
            </div>
            <div className="stack-cell">
              <h3>Load into Snowflake</h3>
              <p>
                Chunks land in a raw schema as strings, unmodified. This layer
                is never queried by the application — it exists so every later
                number has an original to be checked against.
              </p>
              <div className="stack-chips">
                <Chip>Raw schema</Chip>
                <Chip>No business logic</Chip>
              </div>
            </div>
            <div className="stack-cell">
              <h3>Transform with dbt</h3>
              <p>
                Staging types and cleans, intermediate computes trends and
                applies policy, marts publish the final surfaces. Every model
                declares its grain and is tested.
              </p>
              <div className="stack-chips">
                <Chip>13 models</Chip>
                <Chip>3 layers</Chip>
              </div>
            </div>
            <div className="stack-cell">
              <h3>Write back to Snowflake</h3>
              <p>
                Transformed marts are written to a separate analytics schema.
                A read-only role can see these and nothing else — the boundary
                is verified by attempting a forbidden read and expecting it to
                fail.
              </p>
              <div className="stack-chips">
                <Chip>Analytics schema</Chip>
                <Chip>Read-only role</Chip>
              </div>
            </div>
            <div className="stack-cell">
              <h3>Export a curated slice</h3>
              <p>
                A script queries the analytics layer through that read-only role
                and writes reviewed JSON into the repository. An explicit
                allowlist drops any column not approved for display.
              </p>
              <div className="stack-chips">
                <Chip>{products} products</Chip>
                <Chip>{dates.length} days</Chip>
              </div>
            </div>
            <div className="stack-cell">
              <h3>Build and deploy</h3>
              <p>
                Next.js reads that JSON at build time and Vercel serves the
                result. There is no runtime database connection, so the site
                cannot leak a credential it does not hold.
              </p>
              <div className="stack-chips">
                <Chip>Static build</Chip>
                <Chip>No runtime DB</Chip>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="band section">
        <div className="container">
          <div className="section-head">
            <h2>The models, and why each one exists</h2>
            <p>
              Every model has one job and states its grain. A model that cannot
              explain why it exists does not belong in the pipeline.
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Layer</th>
                  <th scope="col">Model</th>
                  <th scope="col">Why it exists</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_REGISTRY.map((m) => (
                  <tr key={m.name}>
                    <td>{m.layer}</td>
                    <td style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{m.name}</td>
                    <td>{m.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="band-tint band section">
        <div className="container">
          <div className="section-head">
            <h2>Reading these numbers well</h2>
          </div>
          <div className="note">
            <p>
              <strong>Volume reflects what was reported and published</strong> —
              not everything customers experienced. Comparisons are most
              meaningful within a single product area, where the same reporting
              conditions apply.
            </p>
            <p>
              <strong>Recent records are still arriving.</strong> The most
              recent {meta.publication_lag_window_days} days are held out of
              every period comparison, and the current month is excluded
              entirely. A record published today may not be complete yet, and
              counting it would read as a decline that is really just timing.
            </p>
            <p>
              <strong>A signal is a prompt, not a conclusion.</strong> An
              emerging pattern means something moved enough to be worth a look.
              What it means is for the person investigating it to establish.
            </p>
          </div>
          <p
            style={{
              marginTop: "2.5rem",
              fontSize: "var(--fs-min)",
              color: "var(--text-3)",
              fontWeight: 300,
            }}
          >
            <Link href="/explore">Explore the data</Link>
          </p>
        </div>
      </section>
    </>
  );
}
