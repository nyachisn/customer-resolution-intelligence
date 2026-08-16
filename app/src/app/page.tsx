/**
 * Landing page. Requirements: docs/01_product_requirements.md §4.1.
 */

import Link from "next/link";
import { PrototypeDisclosure } from "@/components/common/ContextNote";
import { loadDemoMeta } from "@/lib/demo-data";

export default async function Home() {
  const meta = await loadDemoMeta();

  return (
    <div>
      <section className="hero">
        <h1>Customer Resolution Intelligence</h1>
        <p className="tagline">
          A trusted decision layer for customer-issue operations. Turn
          customer signals into the next best action.
        </p>
        <PrototypeDisclosure />
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
          <Link href="/demo/operations" className="btn">
            View the demo
          </Link>
          <Link href="/methodology" className="btn btn-secondary">
            Read the methodology
          </Link>
        </div>
      </section>

      <section>
        <h2 className="section-title">The product flow</h2>
        <div className="flow-diagram">
          <span className="flow-step">Customer signal</span>
          <span className="flow-arrow" aria-hidden="true">
            &rarr;
          </span>
          <span className="flow-step">Context</span>
          <span className="flow-arrow" aria-hidden="true">
            &rarr;
          </span>
          <span className="flow-step">Pattern</span>
          <span className="flow-arrow" aria-hidden="true">
            &rarr;
          </span>
          <span className="flow-step">Priority</span>
          <span className="flow-arrow" aria-hidden="true">
            &rarr;
          </span>
          <span className="flow-step">Action</span>
        </div>
        <p>
          Published CFPB complaint records are transformed into governed
          issue context, emerging-pattern signals, explainable priority, and
          a recommended investigation or action — each carrying its
          supporting evidence and its stated limitations.
        </p>
      </section>

      <section>
        <h2 className="section-title">What this is not</h2>
        <ul className="limitation-list">
          <li>Not complaint-management software.</li>
          <li>Not a complaint-resolution prediction engine.</li>
          <li>
            Not a credit, underwriting, fraud, eligibility, or regulatory
            decision system.
          </li>
          <li>Not a consumer scoring system, and not a company ranking.</li>
          <li>
            Not an integration with CFPB, any financial institution, or
            Twilio.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="section-title">Built on real, verified data</h2>
        <div className="card-grid">
          <div className="card">
            <h3>Source</h3>
            <p>
              CFPB Consumer Complaint Database, retrieved via the official
              bulk CSV archive.
            </p>
          </div>
          <div className="card">
            <h3>Records loaded</h3>
            <p className="metric">17.1M</p>
            <p className="metric-label">published complaint records</p>
          </div>
          <div className="card">
            <h3>Demo export</h3>
            <p className="metric-label">
              Version {meta.export_version} &middot; generated{" "}
              {meta.generated_at_utc}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
