/**
 * Shared presentational primitives. Server components — no client JS.
 *
 * Status is never carried by color alone: every chip renders a text label
 * alongside its tone (docs/01_product_requirements.md §4.3).
 */

import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "positive" | "caution" | "negative";

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>{title}</h1>
          {lede && <p className="page-lede">{lede}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}

export function SectionHead({
  title,
  description,
  note,
}: {
  title: string;
  description?: string;
  note?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {note && <div className="section-note">{note}</div>}
    </div>
  );
}

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function DotChip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`chip chip-${tone}`}>
      <span className="chip-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

const PRIORITY_TONE: Record<string, Tone> = {
  CRITICAL: "negative",
  HIGH: "caution",
  MEDIUM: "accent",
  LOW: "neutral",
};

export function PriorityChip({ priority }: { priority: string }) {
  const label = priority.charAt(0) + priority.slice(1).toLowerCase();
  return <DotChip tone={PRIORITY_TONE[priority] ?? "neutral"}>{label} priority</DotChip>;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LIMITED: "Limited confidence",
  NOT_SUPPORTED: "Not supported",
};

export function ConfidenceChip({ confidence }: { confidence: string }) {
  return <Chip tone="neutral">{CONFIDENCE_LABEL[confidence] ?? confidence}</Chip>;
}

/**
 * A headline number. `definition` renders as a disclosure so the metric can
 * carry its own meaning without turning the card into documentation.
 */
export function MetricCard({
  label,
  value,
  foot,
  definition,
}: {
  label: string;
  value: string;
  foot?: string;
  definition?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {foot && <div className="metric-foot">{foot}</div>}
      {definition && (
        <details>
          <summary>What this means</summary>
          <p>{definition}</p>
        </details>
      )}
    </div>
  );
}

export function InsightCard({
  title,
  delta,
  direction,
  basis,
  body,
  href,
  cta = "Explore",
}: {
  title: string;
  delta: string;
  direction: "up" | "down" | "flat";
  basis: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  const inner = (
    <>
      <h3>{title}</h3>
      <div className="insight-figure">
        <span className={`insight-delta is-${direction}`}>{delta}</span>
        <span className="insight-basis">{basis}</span>
      </div>
      <p className="insight-body">{body}</p>
      {href && <span className="insight-foot">{cta}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="insight-card">
        {inner}
      </Link>
    );
  }
  return <div className="insight-card">{inner}</div>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

/** Horizontal ranked bars. Every row is direct-labeled with its value. */
export function RankedBars({
  rows,
  format,
  max: explicitMax,
}: {
  rows: { label: string; value: number }[];
  format?: (n: number) => string;
  max?: number;
}) {
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const max = explicitMax ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="rank-list">
      {rows.map((r) => (
        <div className="rank-row" key={r.label}>
          <div>
            <div className="rank-label" title={r.label}>
              {r.label}
            </div>
            <div className="rank-bar-wrap">
              <div
                className="rank-bar"
                style={{ width: `${Math.max((Math.abs(r.value) / max) * 100, 1.5)}%` }}
              />
            </div>
          </div>
          <div className="rank-value">{fmt(r.value)}</div>
        </div>
      ))}
    </div>
  );
}
