"use client";

/**
 * Six-stage pipeline joined by a thin blue curve. Hovering (or focusing)
 * a stage reveals what actually happens at that step beneath the diagram,
 * so the detail is available without crowding the drawing.
 */

import { useState } from "react";

export interface PipelineStage {
  name: string;
  meta: string;
  detail: string;
}

export function PipelineDiagram({ stages }: { stages: PipelineStage[] }) {
  const [active, setActive] = useState(0);

  const W = 1320;
  const H = 190;
  const padX = 90;
  const baseY = 116;
  const span = stages.length > 1 ? (W - padX * 2) / (stages.length - 1) : 0;
  const x = (i: number) => padX + i * span;
  const y = (i: number) => {
    const t = stages.length > 1 ? i / (stages.length - 1) : 0;
    return baseY - Math.pow(t, 2.4) * 44;
  };

  const path = stages
    .map((_, i) => {
      if (i === 0) return `M ${x(0).toFixed(1)} ${y(0).toFixed(1)}`;
      const x0 = x(i - 1);
      const y0 = y(i - 1);
      const x1 = x(i);
      const y1 = y(i);
      const cx = (x0 + x1) / 2;
      return `C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <div className="pipeline-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="pipeline-svg"
          role="img"
          aria-label={`Pipeline: ${stages.map((s) => s.name).join(" to ")}`}
        >
          <line x1={0} x2={W} y1={H - 26} y2={H - 26} className="pl-rule" />
          <path d={path} className="pl-line-active" />

          {stages.map((stage, i) => {
            const cx = x(i);
            const cy = y(i);
            const isActive = i === active;
            return (
              <g
                key={stage.name}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                tabIndex={0}
                role="button"
                aria-label={`${stage.name}: ${stage.detail}`}
                style={{ cursor: "pointer", outline: "none" }}
              >
                <line x1={cx} x2={cx} y1={cy + 10} y2={H - 26} className="pl-line" />
                {isActive && <circle cx={cx} cy={cy} r={17} className="pl-halo" />}
                <circle cx={cx} cy={cy} r={isActive ? 7 : 5.5} className="pl-node" />
                <circle cx={cx} cy={cy} r={isActive ? 3 : 2.4} className="pl-node-core" />
                <text x={cx} y={cy - 24} className="pl-name" textAnchor="middle">
                  {stage.name}
                </text>
                <text x={cx} y={H - 8} className="pl-meta" textAnchor="middle">
                  {stage.meta}
                </text>
                {/* generous, invisible hit target */}
                <rect x={cx - span / 2} y={0} width={Math.max(span, 60)} height={H} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>

      <div
        style={{
          marginTop: "1.75rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
          display: "flex",
          gap: "1rem",
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "1.2rem", fontWeight: 400, letterSpacing: "-.018em", whiteSpace: "nowrap" }}>
          {stages[active].name}
        </span>
        <span style={{ color: "var(--text-2)", fontWeight: 300, maxWidth: "80ch" }}>
          {stages[active].detail}
        </span>
      </div>
    </div>
  );
}
