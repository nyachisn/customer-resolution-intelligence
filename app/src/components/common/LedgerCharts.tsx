/**
 * Homepage data-report bar charts. Server-rendered only (no client JS) —
 * values are direct-labeled on every bar, so nothing depends on hover to
 * be legible.
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
