/**
 * Homepage data-report charts. Server-rendered only (no client JS) — values
 * are direct-labeled on every bar and at the trend line's start/peak/end,
 * so nothing depends on hover to be legible.
 */

interface CountRow {
  label: string;
  count: number;
}

const STATUS_COLOR: Record<string, string> = {
  good: "var(--chart-good)",
  warning: "var(--chart-warning)",
  critical: "var(--chart-critical)",
  neutral: "var(--chart-accent)",
};

export function LedgerBarChart({
  rows,
  total,
  colorFor,
  showPct = true,
  valueFormat,
}: {
  rows: CountRow[];
  total: number;
  colorFor?: (label: string, i: number) => keyof typeof STATUS_COLOR;
  showPct?: boolean;
  valueFormat?: (n: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const fmt = valueFormat ?? ((n: number) => n.toLocaleString());
  return (
    <div className="ledger-bars">
      {rows.map((r, i) => {
        const widthPct = Math.max((r.count / max) * 100, 2);
        const pct = total > 0 ? (r.count / total) * 100 : 0;
        const colorKey = colorFor ? colorFor(r.label, i) : "neutral";
        return (
          <div className="ledger-bar-row" key={r.label}>
            <div className="ledger-bar-label" title={r.label}>
              {r.label}
            </div>
            <div className="ledger-bar-track">
              <div
                className="ledger-bar-fill"
                style={{ width: `${widthPct}%`, background: STATUS_COLOR[colorKey] }}
              />
            </div>
            <div className="ledger-bar-value">
              {fmt(r.count)}
              {showPct ? <span className="ledger-bar-pct"> {pct.toFixed(1)}%</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LedgerTrendChart({ points }: { points: { month: string; total: number }[] }) {
  const W = 620;
  const H = 220;
  const padL = 48;
  const padR = 12;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(...points.map((p) => p.total));
  const x = (i: number) => padL + (i / (points.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.total).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${H - padB} L ${x(0).toFixed(1)} ${H - padB} Z`;

  const gridSteps = 4;
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => (max * i) / gridSteps);
  const yearTicks = points
    .map((p, i) => ({ i, year: p.month.slice(0, 4), isJan: p.month.endsWith("-01") }))
    .filter((t) => t.isJan);

  const last = points[points.length - 1];
  const peakIdx = points.reduce((best, p, i, arr) => (p.total > arr[best].total ? i : best), 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ledger-trend-svg" role="img" aria-label="Monthly complaint volume trend">
      {grid.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="ledger-gridline" />
          <text x={padL - 8} y={y(v) + 3} className="ledger-axislabel" textAnchor="end">
            {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
          </text>
        </g>
      ))}
      {yearTicks.map((t) => (
        <g key={t.i}>
          <line x1={x(t.i)} x2={x(t.i)} y1={padT} y2={H - padB} className="ledger-gridline" />
          <text x={x(t.i)} y={H - 6} className="ledger-axislabel" textAnchor="middle">
            {t.year}
          </text>
        </g>
      ))}
      <path d={areaPath} className="ledger-trend-area" />
      <path d={linePath} className="ledger-trend-line" />
      <circle cx={x(peakIdx)} cy={y(points[peakIdx].total)} r={3} className="ledger-trend-dot" />
      <text x={x(peakIdx)} y={y(points[peakIdx].total) - 8} className="ledger-axislabel" textAnchor="middle">
        peak
      </text>
      <circle cx={x(points.length - 1)} cy={y(last.total)} r={3.5} className="ledger-trend-dot ledger-trend-dot-end" />
    </svg>
  );
}
