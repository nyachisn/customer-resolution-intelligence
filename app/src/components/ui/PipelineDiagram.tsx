/**
 * The pipeline diagram — six stages joined by thin blue connectors.
 *
 * Server-rendered SVG. The curve is a flat baseline with a gentle rise into
 * the final stage, so the eye reads left-to-right progression rather than
 * decorative motion.
 */

export interface PipelineStage {
  name: string;
  meta: string;
}

export function PipelineDiagram({ stages }: { stages: PipelineStage[] }) {
  const W = 1240;
  const H = 190;
  const padX = 70;
  const baseY = 118;
  const span = stages.length > 1 ? (W - padX * 2) / (stages.length - 1) : 0;
  const x = (i: number) => padX + i * span;

  // Gentle lift across the run — first stages sit level, the last two rise.
  const y = (i: number) => {
    const t = stages.length > 1 ? i / (stages.length - 1) : 0;
    return baseY - Math.pow(t, 2.4) * 46;
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
    <div className="pipeline-scroll">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="pipeline-svg"
        role="img"
        aria-label={`Pipeline: ${stages.map((s) => s.name).join(" to ")}`}
      >
        {/* baseline rule */}
        <line x1={0} x2={W} y1={H - 22} y2={H - 22} className="pl-rule" />

        {/* connector */}
        <path d={path} className="pl-line-active" />

        {stages.map((stage, i) => {
          const cx = x(i);
          const cy = y(i);
          const isLast = i === stages.length - 1;
          return (
            <g key={stage.name}>
              {/* vertical tick down to the baseline */}
              <line x1={cx} x2={cx} y1={cy + 10} y2={H - 22} className="pl-line" />

              {isLast && <circle cx={cx} cy={cy} r={16} className="pl-halo" />}
              <circle cx={cx} cy={cy} r={6} className="pl-node" />
              <circle cx={cx} cy={cy} r={2.5} className="pl-node-core" />

              <text x={cx} y={cy - 42} className="pl-idx" textAnchor="middle">
                {String(i + 1).padStart(2, "0")}
              </text>
              <text x={cx} y={cy - 22} className="pl-name" textAnchor="middle">
                {stage.name}
              </text>
              <text x={cx} y={H - 6} className="pl-meta" textAnchor="middle">
                {stage.meta}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
