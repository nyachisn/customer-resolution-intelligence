/**
 * Methodology — how the numbers are produced and what they can support.
 *
 * Reachable from the footer, not the primary navigation: it is reference
 * material for someone who wants to check the work, not part of the daily
 * analytical path.
 *
 * NOTE: this route is deliberately excluded from the disclosure CI check
 * (.github/workflows/app-ci.yml). It is the one page whose job is to name
 * the unsupported measures in order to rule them out, so terms that would
 * be a prohibited claim anywhere else are expected here in negated form.
 */

import { PageHeader, SectionHead } from "@/components/ui/Primitives";

export const metadata = { title: "Methodology" };

const CONFIDENCE_ROWS = [
  ["High", "Directly observed source field"],
  ["Medium", "Deterministic derived signal with documented methodology"],
  ["Limited", "Affected by coverage, publication lag, or denominator limits"],
  ["Not supported", "A conclusion the public data cannot defensibly establish"],
];

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        title="Methodology"
        lede="How these numbers are produced, and the questions this data can and cannot answer."
      />
      <section className="band section">
        <div className="container prose">

      <SectionHead title="Source" />
      <p>
        The official CFPB Consumer Complaint Database, retrieved via the bulk
        CSV archive — 17,119,590 published complaint records from December
        2011 onward. This is an <strong>observed public complaint dataset</strong>:
        a record of complaints that met publication criteria, not a
        statistical sample of consumer experience.
      </p>

      <SectionHead title="What this dataset cannot support" />
      <ul>
        <li>
          <strong>How long a company took to respond.</strong> The dataset
          publishes no company response timestamp. The only two dates are when
          the complaint was received and when it was routed to the company —
          separated by seconds for modern web submissions.
        </li>
        <li>
          <strong>A dispute signal.</strong> The &quot;Consumer disputed?&quot;
          field was removed from exports in June 2026 and is not in the
          current schema.
        </li>
        <li>
          <strong>Customer satisfaction, root cause, or market-wide
          prevalence.</strong> None of these are derivable from published
          complaint categories.
        </li>
        <li>
          <strong>Individual scoring or company rankings.</strong> There is no
          denominator — customer count, account count, or transaction volume —
          to normalize against, and this product does not score people.
        </li>
      </ul>

      <SectionHead title="Publication lag" />
      <p>
        Complaints are published before their record is complete, so the most
        recent days of any volume series taper toward zero as an artifact of
        publication rather than a real decline. Every period comparison in
        this product excludes that trailing window. It can be toggled back on
        in Explore, where it is labelled as incomplete.
      </p>

      <SectionHead title="Decisioning" />
      <p>
        Every recommendation is deterministic — traceable to one or more
        documented policy rules, each carrying reason codes and a confidence
        value. &quot;No action needed&quot; is a first-class outcome, not a
        fallback to avoid.
      </p>

      <SectionHead title="Signal confidence" />
      <div className="table-wrap">
        <table>
          <caption>
            A qualitative interpretation status, not a statistical measure.
          </caption>
          <thead>
            <tr>
              <th scope="col">Value</th>
              <th scope="col">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {CONFIDENCE_ROWS.map(([value, meaning]) => (
              <tr key={value}>
                <td>{value}</td>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHead title="Data quality" />
      <p>
        30 of 17,119,590 source rows (0.000175%) contain an unescaped comma
        inside a free-text field — a genuine formatting violation in the
        source file. Different parsers recover from it differently; this was
        found by comparing a full-population profile against the actual
        warehouse load rather than trusting either alone. Affected rows are
        excluded from every downstream model, with a test that fails the build
        if that excluded count ever grows past a small documented ceiling.
      </p>

      <SectionHead title="Full documentation" />
      <p>
        Complete provenance, architecture, decisioning policy, and decision
        records are in the{" "}
        <a href="https://github.com/nyachisn/customer-resolution-intelligence">
          project repository
        </a>
        .
      </p>
        </div>
      </section>
    </>
  );
}
