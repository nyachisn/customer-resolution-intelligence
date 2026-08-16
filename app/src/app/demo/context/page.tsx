/**
 * Complaint record context. Requirements: docs/01_product_requirements.md §4.2.
 * Required: published structured context, status signals, action, reasons,
 * confidence, uncertainty. Prohibited: narrative text, consumer PII,
 * "customer" framing of a public row, any response-duration figure.
 */

import { PriorityBadge, ConfidenceBadge } from "@/components/common/StatusBadge";
import { PublicationLagContextNote } from "@/components/common/ContextNote";
import { loadDemoRecords } from "@/lib/demo-data";

export const metadata = { title: "Complaint record context — Customer Resolution Intelligence" };

export default async function ContextPage() {
  const records = await loadDemoRecords();
  const sample = records.slice(0, 20);
  const anyLagged = sample.some((r) => r.recentPublicationLagFlag);

  return (
    <div>
      <h1>Complaint record context</h1>
      <p>
        A compact, agent-safe view of published structured context per
        complaint record. A record is an observation from the public CFPB
        database — never a customer, a consumer profile, or an identified
        person.
      </p>
      {anyLagged && <PublicationLagContextNote />}

      {sample.length === 0 ? (
        <p>No records available in the current demo export.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
          {sample.map((r) => (
            <li key={r.complaintId} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <h3 style={{ margin: 0 }}>
                  Complaint record {r.complaintId}
                </h3>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <PriorityBadge priority={r.priority} />
                  <ConfidenceBadge confidence={r.signalConfidence} />
                </div>
              </div>
              <p style={{ margin: "0.5rem 0" }}>{r.contextSummary}</p>
              <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem", fontSize: "0.85rem" }}>
                <div>
                  <dt style={{ color: "var(--color-text-muted)" }}>Recommended action</dt>
                  <dd>{r.recommendedAction.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--color-text-muted)" }}>Reason codes</dt>
                  <dd>{r.reasonCodes.join(", ") || "none"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--color-text-muted)" }}>Policy IDs</dt>
                  <dd>{r.policyIds.join(", ") || "none"}</dd>
                </div>
                {r.interpretationLimitation && (
                  <div>
                    <dt style={{ color: "var(--color-text-muted)" }}>Limitation</dt>
                    <dd>{r.interpretationLimitation}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
