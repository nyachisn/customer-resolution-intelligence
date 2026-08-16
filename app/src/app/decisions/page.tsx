/**
 * Decisions — the prioritized attention queue.
 *
 * Rows are product x issue patterns, ranked by the priority the policy
 * layer already assigned. Every row carries the signal behind it, its
 * confidence, and the next step — nothing is recommended here that the
 * decisioning layer did not produce.
 */

import Link from "next/link";
import {
  Chip,
  ConfidenceChip,
  EmptyState,
  MetricCard,
  PageHeader,
  PriorityChip,
  SectionHead,
} from "@/components/ui/Primitives";
import { loadDemoRecords, loadLedgerExhibits } from "@/lib/demo-data";
import { buildAttentionQueue, explainReasons, formatPct, nextStepFor } from "@/lib/analytics";

export const metadata = { title: "Decisions" };

export default async function DecisionsPage() {
  const [records, ledger] = await Promise.all([loadDemoRecords(), loadLedgerExhibits()]);
  const queue = buildAttentionQueue(records);

  const needsAttention = queue.filter((q) => q.recommendedAction !== "STANDARD_HANDLING");
  const shown = needsAttention.slice(0, 12);

  const criticalCount = queue.filter((q) => q.priority === "CRITICAL").length;
  const highCount = queue.filter((q) => q.priority === "HIGH").length;

  // The queue itself is a stratified sample — it intentionally over-samples
  // the rarer outcomes so every decisioning path is visible. The
  // clears-automatically rate must therefore come from the full population,
  // not from the sample, or it would read as though nothing ever clears.
  const actionTotals = ledger?.action ?? [];
  const populationTotal = actionTotals.reduce((s, a) => s + a.count, 0);
  const standardHandling = actionTotals.find((a) => a.label === "Standard Handling")?.count ?? 0;
  const clearRate = populationTotal > 0 ? standardHandling / populationTotal : null;

  return (
    <div>
      <PageHeader
        eyebrow="Decisions"
        title="What needs attention"
        lede="Patterns the decisioning layer flagged, ordered by priority. Each one shows the signal behind it and what to do next."
      />

      <div className="metric-grid">
        <MetricCard
          label="Patterns in queue"
          value={String(needsAttention.length)}
          foot={`across ${queue.length} reviewed`}
          definition="Product and issue combinations where at least one policy rule fired. This queue deliberately covers every decisioning outcome, so the rarer ones stay visible rather than being buried by volume."
        />
        <MetricCard
          label="Critical priority"
          value={String(criticalCount)}
          foot="Two independent signals agree"
          definition="Reserved for patterns where more than one qualifying signal fired at once. This is the narrowest category by design."
        />
        <MetricCard
          label="High priority"
          value={String(highCount)}
          foot="One qualifying signal"
          definition="A single high-confidence rule fired — most often an emerging volume pattern or a published reporting exception."
        />
        {clearRate != null && (
          <MetricCard
            label="Clears automatically"
            value={formatPct(clearRate)}
            foot="Across all analyzed records"
            definition="Share of the full population where no policy rule fired and no action is needed. Measured across every analyzed record, not the queue sample above. Clearing is a real outcome, not a fallback."
          />
        )}
      </div>

      <SectionHead
        title="Attention queue"
        description="Ranked by priority, then by how much the pattern moved against its own baseline. Covers every decisioning outcome so the rare ones stay visible."
        note={<Link href="/explore">Explore the underlying trends →</Link>}
      />

      {shown.length === 0 ? (
        <div className="surface">
          <EmptyState title="Nothing needs attention right now">
            No pattern in the current period triggered a policy rule. This is a
            valid outcome, not a gap in the data.
          </EmptyState>
        </div>
      ) : (
        <div className="surface">
          {shown.map((item) => (
            <article className="decision-row" key={item.key}>
              <div className="decision-meta">
                <PriorityChip priority={item.priority} />
                <ConfidenceChip confidence={item.confidence} />
              </div>

              <div>
                <h3 className="decision-title">{item.issue}</h3>
                <div style={{ marginBottom: "0.5rem" }}>
                  <Chip tone="neutral">{item.product}</Chip>
                </div>
                <p className="decision-why">{explainReasons(item.reasonCodes)}</p>
                <p className="decision-next">
                  <strong>Next step:</strong> {nextStepFor(item.recommendedAction)}
                </p>
                {item.limitation && (
                  <p
                    style={{
                      margin: "0.55rem 0 0",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      maxWidth: "68ch",
                    }}
                  >
                    {item.limitation}
                  </p>
                )}
              </div>

              <div className="decision-signal">
                {item.volumeChangePct != null ? (
                  <>
                    <div
                      className="ds-value"
                      style={{
                        color:
                          item.volumeChangePct > 0 ? "var(--negative)" : "var(--text)",
                      }}
                    >
                      {formatPct(item.volumeChangePct, { signed: true })}
                    </div>
                    <div className="ds-label">vs baseline</div>
                  </>
                ) : (
                  <>
                    <div className="ds-value" style={{ color: "var(--text-muted)" }}>
                      —
                    </div>
                    <div className="ds-label">no baseline</div>
                  </>
                )}
                <div className="ds-label" style={{ marginTop: "0.45rem" }}>
                  {item.recordCount} record{item.recordCount === 1 ? "" : "s"}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {needsAttention.length > shown.length && (
        <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Showing the top {shown.length} of {needsAttention.length} patterns needing action.
        </p>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.83rem", color: "var(--text-muted)" }}>
        A flagged pattern is a prompt to investigate, not a confirmed cause.{" "}
        <Link href="/data-story">How these are produced →</Link>
      </p>
    </div>
  );
}
