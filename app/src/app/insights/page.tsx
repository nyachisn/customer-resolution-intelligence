/**
 * Insights — what changed, how much, and where to look next.
 *
 * Every card is computed from the export at request time. Insights that
 * cannot be supported (too little history for two complete windows) are
 * not rendered rather than shown with a guessed value.
 */

import Link from "next/link";
import { InsightCard, PageHeader, RankedBars, SectionHead, EmptyState } from "@/components/ui/Primitives";
import { loadDemoMeta, loadOperationsMetrics } from "@/lib/demo-data";
import {
  comparePeriods,
  dailySeries,
  formatDate,
  formatPct,
  topMovers,
  titleize,
  totalsByDimension,
} from "@/lib/analytics";

export const metadata = { title: "Insights" };

const WINDOW = 28;

function direction(changePct: number | null): "up" | "down" | "flat" {
  if (changePct == null || Math.abs(changePct) < 0.02) return "flat";
  return changePct > 0 ? "up" : "down";
}

export default async function InsightsPage() {
  const [meta, metrics] = await Promise.all([loadDemoMeta(), loadOperationsMetrics()]);
  const lag = meta.publication_lag_window_days;

  const trim = <T,>(arr: T[]): T[] => (lag > 0 ? arr.slice(0, -lag) : arr);

  const volumeAll = trim(dailySeries(metrics, "complaint_volume"));
  const overall = comparePeriods(volumeAll, WINDOW);

  const emergingAll = trim(dailySeries(metrics, "emerging_issue_count"));
  const emerging = comparePeriods(emergingAll, WINDOW);

  const escalationAll = trim(dailySeries(metrics, "action_count", "ESCALATE_REVIEW"));
  const escalation = comparePeriods(escalationAll, WINDOW);

  // Per-product movers need enough volume in the window to be meaningful —
  // a category with 12 records can swing 200% on noise alone.
  const movers = topMovers(metrics, "complaint_volume", WINDOW, { minCurrent: 250, limit: 4 })
    .map((m) => ({
      ...m,
      // Recompute on the lag-trimmed series so movers match the headline.
      trimmed: comparePeriods(trim(dailySeries(metrics, "complaint_volume", m.dimension)), WINDOW),
    }))
    .filter((m) => m.trimmed && m.trimmed.current >= 250 && m.trimmed.changePct != null)
    .sort((a, b) => Math.abs(b.trimmed!.changePct!) - Math.abs(a.trimmed!.changePct!))
    .slice(0, 3);

  // action_count is published as a single point-in-time snapshot of the whole
  // analyzed population, not a daily series — so it is shown as a standing
  // distribution and never windowed or compared period over period.
  const actionMix = totalsByDimension(metrics, "action_count");

  const hasAnything = overall || emerging || movers.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="What's happening"
        lede={
          overall
            ? `Movement over the ${WINDOW} days to ${formatDate(overall.currentEnd)}, compared with the ${WINDOW} days before it.`
            : "Movement across complaint volume, emerging patterns and escalations."
        }
      />

      {!hasAnything ? (
        <EmptyState title="Not enough history yet">
          Two complete comparison periods are needed before change can be
          measured. Check back once more data has been collected.
        </EmptyState>
      ) : (
        <>
          <div className="insight-grid">
            {overall && (
              <InsightCard
                title="Overall complaint volume"
                delta={formatPct(overall.changePct, { signed: true })}
                direction={direction(overall.changePct)}
                basis="vs prior period"
                body={`${Math.round(overall.current).toLocaleString()} complaints in the current period against ${Math.round(overall.previous).toLocaleString()} in the one before. ${
                  direction(overall.changePct) === "flat"
                    ? "Total volume is holding steady, so movement worth attention is happening inside individual product areas rather than across the whole book."
                    : "The shift is visible at the top level, so it is worth checking which product areas are driving it."
                }`}
                href="/explore"
                cta="Explore volume"
              />
            )}

            {emerging && (
              <InsightCard
                title="Emerging pattern signals"
                delta={formatPct(emerging.changePct, { signed: true })}
                direction={direction(emerging.changePct)}
                basis="vs prior period"
                body={`${Math.round(emerging.current).toLocaleString()} patterns qualified as emerging this period, against ${Math.round(emerging.previous).toLocaleString()} before. A pattern qualifies only when its volume, its baseline and its rate of change all clear threshold together.`}
                href="/decisions"
                cta="Review what qualified"
              />
            )}

            {escalation && escalation.current > 0 && (
              <InsightCard
                title="Cases escalated for review"
                delta={formatPct(escalation.changePct, { signed: true })}
                direction={direction(escalation.changePct)}
                basis="vs prior period"
                body={`${Math.round(escalation.current).toLocaleString()} records were routed to escalated review, against ${Math.round(escalation.previous).toLocaleString()} in the prior period. Escalation is the narrowest of the recommended actions and moves only when two independent signals agree.`}
                href="/decisions"
                cta="See the queue"
              />
            )}
          </div>

          {movers.length > 0 && (
            <>
              <SectionHead
                title="Where the movement is"
                description="Product areas that moved most against their own prior period, excluding categories too small to read reliably."
              />
              <div className="insight-grid">
                {movers.map((m) => {
                  const c = m.trimmed!;
                  return (
                    <InsightCard
                      key={m.dimension}
                      title={m.dimension}
                      delta={formatPct(c.changePct, { signed: true })}
                      direction={direction(c.changePct)}
                      basis={`${Math.round(c.current).toLocaleString()} this period`}
                      body={`Moved from ${Math.round(c.previous).toLocaleString()} to ${Math.round(c.current).toLocaleString()} between consecutive ${WINDOW}-day periods. This is measured against this product's own history, not against other products.`}
                      href={`/explore?product=${encodeURIComponent(m.dimension)}`}
                      cta="Investigate this product"
                    />
                  );
                })}
              </div>
            </>
          )}

          {actionMix.length > 0 && (
            <>
              <SectionHead
                title="How work is routed"
                description="The standing distribution of recommended actions across every analyzed record — a snapshot, not a period comparison."
              />
              <div className="chart-frame">
                <RankedBars
                  rows={actionMix.map((a) => ({
                    label: titleize(a.dimension),
                    value: Math.round(a.value),
                  }))}
                />
              </div>
            </>
          )}
        </>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.83rem", color: "var(--text-muted)" }}>
        Comparisons exclude the most recent {lag} days, where records are still
        being published.{" "}
        <Link href="/data-story">How this data is built →</Link>
      </p>
    </div>
  );
}
