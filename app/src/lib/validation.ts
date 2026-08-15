/**
 * Runtime guards for the demo surface.
 *
 * These enforce, at render time, the constraints the metric register enforces
 * at build time — a defence in depth against an unsupported claim reaching the
 * page. See docs/09_supported_vs_unsupported_metrics.md.
 *
 * STATUS: NOT IMPLEMENTED. Phase 0 scaffold.
 */

/** Field-name fragments that must never appear in a rendered label. */
export const PROHIBITED_LABEL_PATTERNS: readonly RegExp[] = [
  /response\s*time/i,
  /resolution\s*time/i,
  /days?\s*to\s*respond/i,
  /time\s*to\s*resolution/i,
  /handling\s*time/i,
  /satisfaction/i,
  /root\s*cause/i,
  /high[-\s]*risk\s*customer/i,
];

/** A trend figure may only render with its baseline, share, and confidence. */
export function assertTrendIsQualified(): never {
  throw new Error("Not implemented (Phase 0 scaffold).");
}
