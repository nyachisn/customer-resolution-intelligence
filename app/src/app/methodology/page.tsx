/**
 * Methodology and limitations page.
 * Requirements: docs/01_product_requirements.md §4.1.
 */

export const metadata = { title: "Methodology — Customer Resolution Intelligence" };

export default function MethodologyPage() {
  return (
    <div>
      <h1>Methodology &amp; limitations</h1>

      <h2 className="section-title">Source</h2>
      <p>
        This prototype uses the official CFPB Consumer Complaint Database,
        retrieved via the bulk CSV archive. 17,119,590 published complaint
        records, December 2011 through the retrieval date. The database is
        an <strong>observed public complaint dataset</strong> — a record of
        complaints that met CFPB publication criteria — not a statistical
        sample of consumer experience.
      </p>

      <h2 className="section-title">What this dataset cannot support</h2>
      <ul className="limitation-list">
        <li>
          <strong>Response or resolution duration.</strong> The dataset
          publishes no company response timestamp. The only two dates are
          when the CFPB received a complaint and when the CFPB routed it to
          the company — the latter separated from the former by seconds for
          modern web submissions.
        </li>
        <li>
          <strong>A dispute signal.</strong> The &quot;Consumer disputed?&quot;
          field was removed from CFPB exports in June 2026 and does not exist
          in the current schema.
        </li>
        <li>
          <strong>Customer satisfaction, root cause, or market-wide
          prevalence.</strong> None of these are derivable from published
          complaint categories.
        </li>
        <li>
          <strong>Individual consumer risk or company rankings.</strong>{" "}
          There is no denominator (customer count, account count, or
          transaction volume) to normalize against, and this product does
          not score people.
        </li>
      </ul>
      <p>
        See the full register:{" "}
        <a href="https://github.com/nyachisn/customer-resolution-intelligence/blob/main/docs/09_supported_vs_unsupported_metrics.md">
          docs/09_supported_vs_unsupported_metrics.md
        </a>
        .
      </p>

      <h2 className="section-title">Decisioning</h2>
      <p>
        Every recommendation is deterministic — traceable to one or more
        documented policy rules, with reason codes and a confidence value.
        &quot;No special action&quot; (<code>STANDARD_HANDLING</code>) is a
        first-class outcome, not a fallback to avoid.
      </p>

      <h2 className="section-title">Signal confidence</h2>
      <table>
        <caption>Confidence domain — a qualitative interpretation status, not a statistical measure</caption>
        <thead>
          <tr>
            <th scope="col">Value</th>
            <th scope="col">Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>HIGH</td>
            <td>Directly observed source field</td>
          </tr>
          <tr>
            <td>MEDIUM</td>
            <td>Deterministic derived signal with documented methodology</td>
          </tr>
          <tr>
            <td>LIMITED</td>
            <td>Affected by coverage, publication lag, or denominator limits</td>
          </tr>
          <tr>
            <td>NOT_SUPPORTED</td>
            <td>A conclusion the public data cannot defensibly establish</td>
          </tr>
        </tbody>
      </table>

      <h2 className="section-title">Data quality, verified during the real build</h2>
      <p>
        30 of 17,119,590 source rows (0.000175%) contain an unescaped comma
        inside the narrative field — a genuine RFC4180 violation in the
        CFPB&apos;s own file. Different CSV parsers recover from it
        differently; this was found by comparing a full-population Python
        profile against the actual Snowflake load, not assumed from either
        alone. Affected rows are excluded from every downstream model, with a
        test that fails the build if the excluded count ever grows past a
        small, documented ceiling.
      </p>

      <h2 className="section-title">Full documentation</h2>
      <p>
        Complete provenance, architecture, decisioning policy, and
        architecture-decision records are in the project repository:{" "}
        <a href="https://github.com/nyachisn/customer-resolution-intelligence">
          github.com/nyachisn/customer-resolution-intelligence
        </a>
        .
      </p>
    </div>
  );
}
