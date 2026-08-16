/**
 * Operations overview. Requirements: docs/01_product_requirements.md §4.2.
 * Required: aggregate issue trends, emerging-signal cards, action counts,
 * methodology note. Prohibited: consumer identities, company rankings, any
 * response-time measure.
 */

import { VolumeContextNote, ConcentrationContextNote } from "@/components/common/ContextNote";
import { loadOperationsMetrics, loadDemoMeta } from "@/lib/demo-data";

export const metadata = { title: "Operations overview — Customer Resolution Intelligence" };

export default async function OperationsPage() {
  const metrics = await loadOperationsMetrics();
  const meta = await loadDemoMeta();

  const actionCounts = metrics.filter((m) => m.metricName === "action_count");
  const emergingCounts = metrics.filter((m) => m.metricName === "emerging_issue_count");
  const volumeByProduct = new Map<string, number>();
  for (const m of metrics) {
    if (m.metricName !== "complaint_volume") continue;
    volumeByProduct.set(
      m.dashboardDimension,
      (volumeByProduct.get(m.dashboardDimension) ?? 0) + m.metricValue
    );
  }
  const topProducts = [...volumeByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const actionTotals = new Map<string, number>();
  for (const m of actionCounts) {
    actionTotals.set(m.dashboardDimension, (actionTotals.get(m.dashboardDimension) ?? 0) + m.metricValue);
  }
  const totalEmerging = emergingCounts.reduce((s, m) => s + m.metricValue, 0);

  return (
    <div>
      <h1>Operations overview</h1>
      <p>
        Aggregate issue trends and action counts for the last{" "}
        {meta.case_context_window_days} days, from the curated demo export
        (version {meta.export_version}).
      </p>
      <VolumeContextNote />

      <h2 className="section-title">Action counts</h2>
      <div className="card-grid" aria-label="Recommended action counts">
        {[...actionTotals.entries()].map(([action, n]) => (
          <div className="card" key={action}>
            <h3>{action.replaceAll("_", " ")}</h3>
            <p className="metric">{n.toLocaleString()}</p>
            <p className="metric-label">recommendations in window</p>
          </div>
        ))}
      </div>

      <h2 className="section-title">Emerging-pattern signals</h2>
      <p>
        <strong>{totalEmerging.toLocaleString()}</strong> qualified emerging-
        pattern signals in this window. A signal is a prompt for
        investigation, never a confirmed incident, cause, or market event —
        see <a href="/methodology">methodology</a>.
      </p>
      <ConcentrationContextNote />

      <h2 className="section-title">Complaint volume by product</h2>
      <p className="context-note" style={{ marginBottom: "0.5rem" }}>
        Accessible summary: the table below lists total observed complaint
        volume per product category for the selected window, ranked highest
        to lowest.
      </p>
      <div className="table-scroll">
        <table>
          <caption>Complaint volume by product, last {meta.case_context_window_days} days</caption>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Observed volume</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map(([product, n]) => (
              <tr key={product}>
                <td>{product}</td>
                <td>{n.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
