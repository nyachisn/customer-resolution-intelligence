/**
 * Shared presentational primitives. Server components — no client JS.
 *
 * Status is never carried by color alone: every chip renders a text label
 * alongside its tone (docs/01_product_requirements.md §4.3).
 */

import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "positive" | "caution" | "negative";

/**
 * Full-bleed page header band with the soft radial wash. Pages render this
 * first, then their own `.container` sections beneath it.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  aside,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  aside?: ReactNode;
}) {
  return (
    <section className="band wash">
      {/* Vertical only — a `padding` shorthand would override the horizontal
          padding `.container` sets, which is responsive. */}
      <div className="container" style={{ paddingTop: "3.5rem", paddingBottom: "3rem" }}>
        <div className="section-head-row" style={{ marginBottom: 0 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div className="eyebrow">{eyebrow}</div>
            <h2 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)" }}>{title}</h2>
            {lede && <p>{lede}</p>}
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  const head = (
    <div className="section-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
  if (!aside) return head;
  return (
    <div className="section-head-row">
      {head}
      {aside}
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
  return <DotChip tone={PRIORITY_TONE[priority] ?? "neutral"}>{label}</DotChip>;
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

/** One cell of the dashboard metric strip. */
export function MetricCell({
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
    <div className="metric-cell">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {foot && <div className="metric-foot">{foot}</div>}
      {definition && (
        <details>
          <summary>Definition</summary>
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
      <div className="card-figure">
        <span className={`card-delta is-${direction}`}>{delta}</span>
        <span className="card-basis">{basis}</span>
      </div>
      <p>{body}</p>
      {href && <span className="card-cta">{cta}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card">
        {inner}
      </Link>
    );
  }
  return <div className="card">{inner}</div>;
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
