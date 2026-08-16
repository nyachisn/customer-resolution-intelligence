/**
 * Priority badge. Never communicates status by color alone — every badge
 * pairs its color with a text label. See docs/01_product_requirements.md §4.3.
 */

import type { Priority } from "@/lib/types";

const LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cls = `badge badge-${priority.toLowerCase()}`;
  return <span className={cls}>{LABELS[priority]} priority</span>;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: "High confidence — directly observed",
  MEDIUM: "Medium confidence — derived signal",
  LIMITED: "Limited confidence — see limitation",
  NOT_SUPPORTED: "Not supported by this data",
};

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  const tone =
    confidence === "HIGH" ? "low" : confidence === "MEDIUM" ? "medium" : "high";
  return (
    <span className={`badge badge-${tone}`}>
      {CONFIDENCE_LABELS[confidence] ?? confidence}
    </span>
  );
}
