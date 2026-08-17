/**
 * A bare trend shape, scaled to its own maximum.
 *
 * Used only where the point is the shape rather than the value — the numbers
 * that matter sit beside it in text.
 */

export function Sparkline({
  points,
  accent = false,
  height = 56,
}: {
  points: number[];
  accent?: boolean;
  height?: number;
}) {
  if (points.length === 0) return null;
  const max = Math.max(...points, 1);
  const path = points
    .map((v, i) => {
      const x = points.length <= 1 ? 50 : (i / (points.length - 1)) * 100;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${(100 - (v / max) * 100).toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`spark${accent ? " is-accent" : ""}`}
      style={{ height }}
      aria-hidden="true"
    >
      <path d={`${path} L 100 100 L 0 100 Z`} className="spark-area" />
      <path d={path} className="spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
