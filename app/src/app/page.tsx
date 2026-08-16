/**
 * Landing page / data report. Requirements: docs/01_product_requirements.md §4.1.
 *
 * Body is a set of "exhibits" reading directly off the governed marts via
 * ledger_exhibits.json (scripts/export_demo_data.py, CRI_APP_READER,
 * aggregate-only queries — no complaint-level or company-ranking data).
 */

import Link from "next/link";
import { PrototypeDisclosure, ConcentrationContextNote } from "@/components/common/ContextNote";
import { LedgerBarChart } from "@/components/common/LedgerCharts";
import { LedgerTrendChart } from "@/components/common/LedgerTrendChart";
import { loadDemoMeta, loadLedgerExhibits } from "@/lib/demo-data";

export default async function Home() {
  const meta = await loadDemoMeta();
  const ledger = await loadLedgerExhibits();

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

      {ledger && (
        <section>
          <div className="ledger-masthead">
            <div className="ledger-eyebrow">Customer Resolution Intelligence &middot; Analytics_Prod</div>
            <h2>The Complaint Ledger</h2>
            <p className="ledger-dek">
              Seven exhibits read directly off the governed dbt marts &mdash;
              what each one shows in the CFPB complaint record, and the
              operational decision it&apos;s built to support. Every figure
              below is a live query result, not an illustration.
            </p>
          </div>

          <div className="stat-strip">
            <div className="stat-cell">
              <div className="stat-num">{ledger.totalRecords.toLocaleString()}</div>
              <div className="stat-label">Complaint records</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">
                {ledger.minDate.slice(0, 4)}&ndash;{ledger.maxDate.slice(0, 4)}
              </div>
              <div className="stat-label">Coverage window</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{ledger.distinctProducts}</div>
              <div className="stat-label">Products tracked</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{ledger.policyTriggers.length}</div>
              <div className="stat-label">Decisioning policies</div>
            </div>
          </div>

          {/* Exhibit 1 — volume trend */}
          <article className="exhibit">
            <div className="exhibit-head">
              <span className="exhibit-no">Exhibit 1</span>
              <h3>Volume has grown far faster than headcount could follow</h3>
              <span className="exhibit-source">fct_issue_daily_metrics</span>
            </div>
            <div className="exhibit-grid">
              <div className="exhibit-chartbox">
                <LedgerTrendChart points={ledger.monthlyVolume} />
              </div>
              <div className="exhibit-annot">
                <h4>What it shows</h4>
                <p>
                  Published monthly complaint volume, {ledger.monthlyVolume[0]?.month} through{" "}
                  {ledger.monthlyVolume[ledger.monthlyVolume.length - 1]?.month} (the current
                  partial month is excluded). Volume climbed from roughly{" "}
                  {ledger.monthlyVolume[0]?.total.toLocaleString()} records a month to over{" "}
                  {ledger.monthlyVolume[ledger.monthlyVolume.length - 1]?.total.toLocaleString()}{" "}
                  &mdash; a steady, compounding rise rather than a single spike.
                </p>
                <div className="decision">
                  <h4>Decision it supports</h4>
                  <p>
                    Review and warehouse capacity should be sized against the
                    current monthly run rate, not the historical average
                    &mdash; a plan built on last year&apos;s volume is already
                    under-provisioned by the time it ships.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Exhibit 2 — product mix */}
          <article className="exhibit">
            <div className="exhibit-head">
              <span className="exhibit-no">Exhibit 2</span>
              <h3>Credit reporting alone outweighs every other product combined</h3>
              <span className="exhibit-source">fct_complaints</span>
            </div>
            <div className="exhibit-grid">
              <div className="exhibit-chartbox">
                <LedgerBarChart rows={ledger.products} total={ledger.totalRecords} />
              </div>
              <div className="exhibit-annot">
                <h4>What it shows</h4>
                <p>
                  The eight highest-volume products out of {ledger.distinctProducts} tracked,
                  by record count, all-time. Credit-reporting products (split
                  across a legacy and a current CFPB label, which the
                  taxonomy deliberately keeps separate rather than merging)
                  account for roughly four-fifths of every complaint on file.
                </p>
                <div className="decision">
                  <h4>Decision it supports</h4>
                  <p>
                    Any staffing, tooling, or policy-tuning investment aimed
                    at the top product first reaches the majority of the
                    caseload &mdash; and any cross-product benchmark must be
                    read within a single product category, never across the
                    full mix.
                  </p>
                </div>
                <p className="caveat-note">
                  <strong>Note:</strong> the two credit-reporting rows are the
                  same underlying product under CFPB&apos;s legacy and current
                  naming. The taxonomy never merges them.
                </p>
              </div>
            </div>
          </article>

          {/* Exhibit 3 — priority / confidence / action */}
          <article className="exhibit">
            <div className="exhibit-head">
              <span className="exhibit-no">Exhibit 3</span>
              <h3>Most records clear automatically; the rest name a specific reason</h3>
              <span className="exhibit-source">resolution_action_queue</span>
            </div>
            <div className="exhibit-grid">
              <div>
                <div className="exhibit-chartbox">
                  <div className="chart-group-label">Recommended action</div>
                  <LedgerBarChart
                    rows={ledger.action}
                    total={ledger.totalRecords}
                    colorFor={(label) =>
                      label === "Standard Handling"
                        ? "good"
                        : label === "Escalate Review"
                          ? "critical"
                          : "warning"
                    }
                  />
                </div>
                <div className="exhibit-chartbox">
                  <div className="chart-group-label">Signal confidence</div>
                  <LedgerBarChart
                    rows={ledger.confidence}
                    total={ledger.totalRecords}
                    colorFor={(label) => (label === "High" ? "good" : label === "Limited" ? "critical" : "warning")}
                  />
                </div>
              </div>
              <div className="exhibit-annot">
                <h4>What it shows</h4>
                <p>
                  Every published complaint is evaluated against all six
                  policies and assigned exactly one recommended action.
                  Standard handling is a first-class outcome, not a default
                  &mdash; it means no escalation policy fired. Confidence is
                  tracked as a fully separate dimension from priority.
                </p>
                <div className="decision">
                  <h4>Decision it supports</h4>
                  <p>
                    Human-review capacity should be sized to the records that
                    require investigation or escalation &mdash; not the full
                    caseload, and not the smallest, most critical slice
                    alone.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Exhibit 4 — policy trigger rates */}
          <article className="exhibit">
            <div className="exhibit-head">
              <span className="exhibit-no">Exhibit 4</span>
              <h3>One policy fires far more than the rest &mdash; the others are rare by design</h3>
              <span className="exhibit-source">int_priority_policy_application</span>
            </div>
            <div className="exhibit-grid">
              <div className="exhibit-chartbox">
                <LedgerBarChart rows={ledger.policyTriggers} total={ledger.totalRecords} />
              </div>
              <div className="exhibit-annot">
                <h4>What it shows</h4>
                <p>
                  How often each of the six policy rules fires, out of every
                  complaint evaluated. The critical-combination rule, which
                  requires two high-confidence triggers at once, is
                  intentionally the rarest.
                </p>
                <div className="decision">
                  <h4>Decision it supports</h4>
                  <p>
                    A policy that fires far above its design expectation is
                    the first place to check the underlying threshold, not
                    the last &mdash; this ranking is the fastest way to spot
                    a rule that needs re-tuning before it does in production.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Exhibit 5 — data quality */}
          <article className="exhibit">
            <div className="exhibit-head">
              <span className="exhibit-no">Exhibit 5</span>
              <h3>The record is complete and on time in the overwhelming majority of cases</h3>
              <span className="exhibit-source">fct_complaints</span>
            </div>
            <div className="exhibit-grid">
              <div>
                <div className="exhibit-chartbox">
                  <div className="chart-group-label">Data completeness</div>
                  <LedgerBarChart
                    rows={ledger.completeness}
                    total={ledger.totalRecords}
                    colorFor={(label) => (label === "Complete" ? "good" : "warning")}
                  />
                </div>
                <div className="exhibit-chartbox">
                  <div className="chart-group-label">Published timeliness</div>
                  <LedgerBarChart
                    rows={ledger.timely}
                    total={ledger.totalRecords}
                    colorFor={(label) => (label === "Yes" ? "good" : "critical")}
                  />
                </div>
              </div>
              <div className="exhibit-annot">
                <h4>What it shows</h4>
                <p>
                  Records missing a non-critical field like sub-product are
                  still usable, just flagged partial. Timeliness is a
                  source-provided category, never a measured duration.
                </p>
                <div className="decision">
                  <h4>Decision it supports</h4>
                  <p>
                    The partial-record share is small enough to monitor as a
                    rate rather than triage case-by-case; a meaningful jump in
                    that rate is the real trigger for a data-quality
                    investigation, not any single incomplete record.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Exhibit 6 — emerging signals */}
          <article className="exhibit">
            <div className="exhibit-head">
              <span className="exhibit-no">Exhibit 6</span>
              <h3>{ledger.emergingSignals.length} product &times; issue pairs are qualifying as emerging right now</h3>
              <span className="exhibit-source">int_issue_trends</span>
            </div>
            <div className="exhibit-grid">
              <div className="exhibit-chartbox">
                <LedgerBarChart
                  rows={ledger.emergingSignals.map((s) => ({
                    label: `${s.product} – ${s.issue}`,
                    count: Math.round(s.volumeChangePct * 100),
                  }))}
                  total={1}
                  showPct={false}
                  valueFormat={(n) => `+${n}%`}
                  colorFor={() => "warning"}
                />
              </div>
              <div className="exhibit-annot">
                <h4>What it shows</h4>
                <p>
                  Product &times; issue pairs whose most recent qualifying
                  date falls in the last ten weeks, ranked by percentage
                  change against each pair&apos;s own baseline &mdash; never
                  against another product.
                </p>
                <div className="decision">
                  <h4>Decision it supports</h4>
                  <p>
                    This is the actual investigation queue: each qualified
                    pair is a prompt to look into what changed, never a
                    confirmed cause, incident, or market-wide event on its
                    own.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Exhibit 7 — company context */}
          <article className="exhibit">
            <div className="exhibit-head">
              <span className="exhibit-no">Exhibit 7</span>
              <h3>The nationwide credit bureaus dwarf every other company on file</h3>
              <span className="exhibit-source">int_company_issue_patterns</span>
            </div>
            <div className="exhibit-grid">
              <div className="exhibit-chartbox">
                <LedgerBarChart rows={ledger.companies} total={ledger.totalRecords} colorFor={() => "neutral"} />
              </div>
              <div className="exhibit-annot">
                <h4>What it shows</h4>
                <p>
                  Raw complaint counts for the eight highest-volume companies
                  on file &mdash; unsurprising given the top three appear on
                  nearly every credit-reporting complaint regardless of which
                  furnisher is actually at issue.
                </p>
                <div className="decision">
                  <h4>Decision it supports</h4>
                  <p>
                    None, on its own &mdash; this exhibit exists to show why
                    this data must never be used to rank or compare
                    companies.
                  </p>
                </div>
                <ConcentrationContextNote />
              </div>
            </div>
          </article>
        </section>
      )}

      <section>
        <h2 className="section-title">Source</h2>
        <div className="card-grid">
          <div className="card">
            <h3>CFPB Consumer Complaint Database</h3>
            <p>Retrieved via the official bulk CSV archive.</p>
          </div>
          <div className="card">
            <h3>Records loaded</h3>
            <p className="metric">
              {meta.source_total_records != null
                ? `${(meta.source_total_records / 1_000_000).toFixed(1)}M`
                : "—"}
            </p>
            <p className="metric-label">
              published complaint records
              {meta.source_retrieval_date
                ? ` as of ${meta.source_retrieval_date.slice(0, 10)}`
                : ""}
            </p>
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
