/**
 * Issue investigation. Requirements: docs/01_product_requirements.md §4.2.
 * Required: current volume, baseline, % change, observed share, confidence,
 * trend window, taxonomy, threshold, limitation. Prohibited: causal claims,
 * proof of misconduct, market-wide prevalence, or a % increase framed as an
 * incident.
 */

import { ConfidenceBadge } from "@/components/common/StatusBadge";
import { ConcentrationContextNote } from "@/components/common/ContextNote";
import { loadDemoRecords } from "@/lib/demo-data";

export const metadata = { title: "Issue investigation — Customer Resolution Intelligence" };

export default async function InvestigationPage() {
  const records = await loadDemoRecords();

  // DEDUP SEMANTICS (documented 2026-08-16, not redesigned — see
  // docs/12_project_context.md): agent_case_context.json is exported sorted
  // complaint_received_date DESC (scripts/export_demo_data.py). The
  // `if (!byGrain.has(key))` below therefore keeps, for each product x
  // issue pair, that pair's MOST RECENT complaint record and displays ITS
  // trend snapshot (issueVolumeCurrent/baselineVolume/etc, joined per-
  // complaint from that complaint's own received date). This is a
  // reasonable proxy for "current trend status for this pattern" — it is
  // not an independent aggregate query — and depends on the export's sort
  // order to be correct. If that sort order ever changes, this dedup must
  // change with it.
  const byGrain = new Map<
    string,
    {
      product: string;
      issue: string;
      issueVolumeCurrent: number;
      baselineVolume: number;
      volumeChangePct: number | null;
      observedSharePct: number;
      issuePatternStatus: string;
    }
  >();
  for (const r of records) {
    const key = `${r.product}::${r.issue}`;
    if (!byGrain.has(key)) {
      byGrain.set(key, {
        product: r.product,
        issue: r.issue,
        issueVolumeCurrent: r.issueVolumeCurrent,
        baselineVolume: r.baselineVolume,
        volumeChangePct: r.volumeChangePct,
        observedSharePct: r.observedSharePct,
        issuePatternStatus: r.issuePatternStatus,
      });
    }
  }
  const qualified = [...byGrain.values()]
    .filter((g) => g.issuePatternStatus === "QUALIFIED_SIGNAL")
    .sort((a, b) => (b.volumeChangePct ?? 0) - (a.volumeChangePct ?? 0));

  return (
    <div>
      <h1>Issue investigation</h1>
      <p>
        Qualified emerging-pattern signals from the curated demo sample.
        Every signal is a prompt for investigation — never a confirmed
        incident, cause, or market event.
      </p>
      <ConcentrationContextNote />

      {qualified.length === 0 ? (
        <p>No qualified signals in the current demo sample window.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <caption>
              Product/issue combinations with a qualified emerging-pattern
              signal, ranked by percentage change
            </caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Issue</th>
                <th scope="col">Current volume</th>
                <th scope="col">Baseline volume</th>
                <th scope="col">% change</th>
                <th scope="col">Observed share</th>
                <th scope="col">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {qualified.slice(0, 25).map((g) => (
                <tr key={`${g.product}::${g.issue}`}>
                  <td>{g.product}</td>
                  <td>{g.issue}</td>
                  <td>{g.issueVolumeCurrent}</td>
                  <td>{g.baselineVolume.toFixed(1)}</td>
                  <td>
                    {g.volumeChangePct != null
                      ? `${(g.volumeChangePct * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td>{(g.observedSharePct * 100).toFixed(2)}%</td>
                  <td>
                    <ConfidenceBadge confidence="MEDIUM" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-title">Qualification conditions</h2>
      <p>
        A signal qualifies only when all conditions hold: sufficient current
        volume, sufficient baseline volume, the percentage-change threshold
        met, evaluation within a single product category, and the record not
        predominantly affected by publication lag. See{" "}
        <a href="/methodology">methodology</a> for the full policy.
      </p>
    </div>
  );
}
