/**
 * Derived analytics over the curated export.
 *
 * Everything here is computed from data that already exists in
 * operations_overview_metrics / agent_case_context / ledger_exhibits.
 * Nothing is fabricated: if the underlying series is too short or too
 * sparse to support a comparison, the function returns null and the UI
 * shows nothing rather than a guess.
 */

import type { MetricSeries, OperationsMetric } from "./types";

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  changePct: number | null;
  currentDays: number;
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
}

export const METRIC_LABELS: Record<string, string> = {
  complaint_volume: "Complaint volume",
  emerging_issue_count: "Emerging signals",
  action_count: "Recommended actions",
};

/** Distinct sorted dates present for a metric. */
export function datesFor(metrics: OperationsMetric[], metricName: string): string[] {
  const set = new Set<string>();
  for (const m of metrics) {
    if (m.metricName === metricName) set.add(m.metricDate);
  }
  return [...set].sort();
}

/** Distinct dimensions present for a metric, ordered by total volume desc. */
export function dimensionsFor(metrics: OperationsMetric[], metricName: string): string[] {
  const totals = new Map<string, number>();
  for (const m of metrics) {
    if (m.metricName !== metricName) continue;
    totals.set(m.dashboardDimension, (totals.get(m.dashboardDimension) ?? 0) + m.metricValue);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
}

/**
 * Compare the trailing `windowDays` against the equally-sized window
 * immediately before it. Returns null when the series is too short to
 * hold two complete windows — a partial comparison would overstate or
 * understate the change purely as an artifact of the window length.
 */
export function comparePeriods(series: SeriesPoint[], windowDays: number): PeriodComparison | null {
  if (series.length < windowDays * 2) return null;
  const currentSlice = series.slice(-windowDays);
  const previousSlice = series.slice(-windowDays * 2, -windowDays);
  const current = currentSlice.reduce((s, p) => s + p.value, 0);
  const previous = previousSlice.reduce((s, p) => s + p.value, 0);
  return {
    current,
    previous,
    changePct: previous > 0 ? (current - previous) / previous : null,
    currentDays: windowDays,
    currentStart: currentSlice[0].date,
    currentEnd: currentSlice[currentSlice.length - 1].date,
    previousStart: previousSlice[0].date,
    previousEnd: previousSlice[previousSlice.length - 1].date,
  };
}

export function formatPct(v: number | null, opts: { signed?: boolean } = {}): string {
  if (v == null) return "—";
  const pct = v * 100;
  const sign = opts.signed && pct > 0 ? "+" : "";
  const digits = Math.abs(pct) >= 10 ? 0 : 1;
  return `${sign}${pct.toFixed(digits)}%`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

/** "Jan 2020" — for series indexed by month rather than day. */
export function formatMonth(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

/**
 * "May 5 – Jun 1, 2026" — the year is stated once when both ends share it,
 * which keeps the range inside a dashboard tile without truncating.
 */
export function formatRange(fromIso: string, toIso: string): string {
  const to = formatDate(toIso);
  const from = formatDate(fromIso);
  const sameYear = fromIso.slice(0, 4) === toIso.slice(0, 4);
  return `${sameYear ? from.replace(/, \d{4}$/, "") : from} – ${to}`;
}

export function titleize(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Record-level context for the illustrative sample                     */
/* ------------------------------------------------------------------ */

const REASON_TEXT: Record<string, string> = {
  EMERGING_ISSUE_SIGNAL:
    "Volume for this pattern cleared the emerging-signal thresholds against its own baseline.",
  PUBLISHED_UNTIMELY_RESPONSE:
    "The published record shows the company did not meet the reporting standard for this case.",
  RECENT_PUBLICATION_LAG:
    "This pattern falls inside the recent-publication window, so its status may still change.",
  INCOMPLETE_CONTEXT: "One or more fields needed to interpret this pattern are missing.",
  MULTIPLE_QUALIFIED_TRIGGERS: "Two independent signals qualified on the same pattern.",
  STABLE_PATTERN: "No qualifying signal fired for this pattern.",
};

export function explainReasons(codes: string[]): string {
  const parts = codes.map((c) => REASON_TEXT[c]).filter(Boolean);
  if (parts.length === 0) return "No qualifying signal fired for this pattern.";
  return parts.join(" ");
}

const ACTION_NEXT_STEP: Record<string, string> = {
  ESCALATE_REVIEW: "Escalate for review",
  INVESTIGATE_PATTERN: "Investigate the underlying trend",
  REQUIRE_HUMAN_REVIEW: "Route to a human reviewer",
  STANDARD_HANDLING: "No action needed",
  PRIORITIZE_CASE_REVIEW: "Prioritize case review",
  UPDATE_AGENT_GUIDANCE: "Update agent guidance",
};

export function nextStepFor(action: string): string {
  return ACTION_NEXT_STEP[action] ?? titleize(action);
}


/* ------------------------------------------------------------------ */
/* Series views over the pivoted metric bundle                          */
/* ------------------------------------------------------------------ */

/** One product's totals for the current window and the one before it. */
export interface DimensionMovement {
  dimension: string;
  current: number;
  previous: number | null;
  changePct: number | null;
  share: number;
}

/** The window a view is actually showing, after lag and period trimming. */
export interface WindowView {
  points: SeriesPoint[];
  /** The prior window, re-dated onto the current one so they overlay. */
  priorAligned: SeriesPoint[] | null;
  comparison: PeriodComparison | null;
  total: number;
  dailyAverage: number;
  peak: SeriesPoint | null;
  /** Index bounds of this window inside the lag-trimmed series. */
  from: number;
  to: number;
}

/** Points for one dimension, or the all-dimension total when null. */
export function seriesPoints(
  series: MetricSeries | undefined,
  dimension: string | null,
): SeriesPoint[] {
  if (!series) return [];
  const values = dimension ? series.values[dimension] : series.totals;
  if (!values) return [];
  return series.dates.map((date, i) => ({ date, value: values[i] ?? 0 }));
}

/**
 * Trim the publication-lag tail, take the trailing window, and derive
 * everything a metric panel needs from that one slice.
 *
 * Recently received complaints publish before their record is complete, so
 * the tail of any volume series tapers as an artifact of publication rather
 * than a real decline (docs/02_data_provenance.md §9). Dropping it before
 * the window is taken is what keeps a "decline" from being manufactured.
 */
export function buildWindowView(
  points: SeriesPoint[],
  opts: { periodDays: number; lagDays: number; hideLag: boolean; compare: boolean },
): WindowView {
  const { periodDays, lagDays, hideLag, compare } = opts;
  const trimmed = hideLag && lagDays > 0 ? points.slice(0, -lagDays) : points;
  const windowed = periodDays > 0 ? trimmed.slice(-periodDays) : trimmed;

  let priorAligned: SeriesPoint[] | null = null;
  if (compare && periodDays > 0 && trimmed.length >= periodDays * 2) {
    const prior = trimmed.slice(-periodDays * 2, -periodDays);
    priorAligned = prior.map((p, i) => ({ date: windowed[i]?.date ?? p.date, value: p.value }));
  }

  const total = windowed.reduce((s, p) => s + p.value, 0);
  const peak =
    windowed.length > 0
      ? windowed.reduce((best, p) => (p.value > best.value ? p : best), windowed[0])
      : null;

  return {
    points: windowed,
    priorAligned,
    comparison: periodDays > 0 ? comparePeriods(trimmed, periodDays) : null,
    total,
    dailyAverage: windowed.length > 0 ? total / windowed.length : 0,
    peak,
    from: Math.max(trimmed.length - (periodDays > 0 ? periodDays : trimmed.length), 0),
    to: trimmed.length,
  };
}

/**
 * Per-dimension totals for the window, with the equivalent prior window.
 *
 * Both windows are cut from the same lag-trimmed axis as the chart, so a
 * share here always sums to the total shown above it — the two cannot drift
 * apart the way they do when a day count is recomputed independently.
 */
export function dimensionMovements(
  series: MetricSeries | undefined,
  opts: { periodDays: number; lagDays: number; hideLag: boolean },
): DimensionMovement[] {
  if (!series) return [];
  const { periodDays, lagDays, hideLag } = opts;

  const end = hideLag && lagDays > 0 ? Math.max(series.dates.length - lagDays, 0) : series.dates.length;
  const span = periodDays > 0 ? Math.min(periodDays, end) : end;
  const curStart = end - span;
  const prevStart = curStart - span;
  const hasPrevious = prevStart >= 0 && span > 0;

  const sum = (arr: number[] | undefined, a: number, b: number) => {
    if (!arr) return 0;
    let t = 0;
    for (let i = a; i < b; i += 1) t += arr[i] ?? 0;
    return t;
  };

  const grandTotal = sum(series.totals, curStart, end);

  return series.dimensions
    .map((dimension) => {
      const values = series.values[dimension];
      const current = sum(values, curStart, end);
      const previous = hasPrevious ? sum(values, prevStart, curStart) : null;
      return {
        dimension,
        current,
        previous,
        changePct: previous != null && previous > 0 ? (current - previous) / previous : null,
        share: grandTotal > 0 ? current / grandTotal : 0,
      };
    })
    .filter((m) => m.current > 0)
    .sort((a, b) => b.current - a.current);
}

/** The value of one dimension on one date, for the focused-date readout. */
export function valueOn(
  series: MetricSeries | undefined,
  dimension: string | null,
  date: string,
): number | null {
  if (!series) return null;
  const i = series.dates.indexOf(date);
  if (i < 0) return null;
  const values = dimension ? series.values[dimension] : series.totals;
  return values?.[i] ?? null;
}

/* ------------------------------------------------------------------ */
/* Readout — plain-language interpretation of the metric selection      */
/* ------------------------------------------------------------------ */

export interface Readout {
  headline: string;
  observations: string[];
  actions: string[];
}

/**
 * Turns the current metric selection into an explanation and next steps.
 *
 * Every sentence is derived from a number already on screen, and every one
 * of those numbers comes from operations_overview_metrics — the six-month
 * product-level aggregate. Nothing here draws on the illustrative record
 * sample: 300 stratified rows cannot support a count, a ranking or a
 * priority mix, so they are not allowed to reach this text.
 */
export function buildReadout(input: {
  measureLabel: string;
  product: string | null;
  productCount: number;
  windowDays: number;
  total: number;
  changePct: number | null;
  hasComparison: boolean;
  topShare: { label: string; share: number } | null;
  peak: SeriesPoint | null;
  dailyAverage: number;
  focus: { date: string; value: number | null } | null;
  signalDays: number | null;
}): Readout {
  const {
    measureLabel, product, productCount, windowDays, total, changePct, hasComparison,
    topShare, peak, dailyAverage, focus, signalDays,
  } = input;

  const scope = product ?? `all ${productCount} products`;
  const observations: string[] = [];
  const actions: string[] = [];

  let headline: string;
  if (!hasComparison || changePct == null) {
    headline = `${measureLabel} across ${scope} totals ${Math.round(total).toLocaleString()} over the last ${windowDays} days. There is not enough history behind this window to compare it with the period before, so read it as a level rather than a movement.`;
  } else if (Math.abs(changePct) < 0.02) {
    headline = `${measureLabel} across ${scope} is essentially flat — ${formatPct(changePct, { signed: true })} against the previous ${windowDays} days. When the total holds steady, movement worth acting on is usually hiding inside individual products rather than showing up here.`;
  } else if (changePct > 0) {
    headline = `${measureLabel} across ${scope} is up ${formatPct(changePct, { signed: true })} against the previous ${windowDays} days, at ${Math.round(total).toLocaleString()} in total. A rise means more was reported and published — not necessarily that more went wrong.`;
  } else {
    headline = `${measureLabel} across ${scope} is down ${formatPct(Math.abs(changePct))} against the previous ${windowDays} days, at ${Math.round(total).toLocaleString()} in total. A fall means less was reported in this window, which can reflect reporting conditions as much as customer experience.`;
  }

  observations.push(
    `Averaging ${Math.round(dailyAverage).toLocaleString()} per day across the window.`,
  );

  if (peak) {
    observations.push(
      `The busiest single day was ${formatDate(peak.date)} at ${Math.round(peak.value).toLocaleString()} — roughly ${dailyAverage > 0 ? (peak.value / dailyAverage).toFixed(1) : "?"}× the daily average.`,
    );
  }

  if (!product && topShare && topShare.share > 0) {
    observations.push(
      `${topShare.label} accounts for ${formatPct(topShare.share)} of the total, so the headline number mostly tracks that one category.`,
    );
  }

  if (signalDays != null && signalDays > 0) {
    observations.push(
      `${signalDays.toLocaleString()} issue-days in this window cleared the emerging-pattern threshold against their own baseline.`,
    );
  }

  if (focus) {
    observations.push(
      focus.value != null
        ? `${formatDate(focus.date)} is focused: ${Math.round(focus.value).toLocaleString()}, ${dailyAverage > 0 ? `${(focus.value / dailyAverage).toFixed(2)}× the window average` : "no average to compare against"}.`
        : `${formatDate(focus.date)} is focused, but this selection has no value on that date.`,
    );
  }

  if (!product && topShare && topShare.share > 0.5) {
    actions.push(
      `Filter to ${topShare.label} to see whether the headline is being set by that category alone, then check the others separately.`,
    );
  }

  actions.push(
    hasComparison
      ? `Open the slope view to see which products moved against the previous period rather than with it — a total that barely moves can hide offsetting products.`
      : `Widen the period so two complete windows are available, then compare like for like.`,
  );

  if (!product) {
    actions.push(
      `Use small multiples to scan every product on one scale before committing to a single one.`,
    );
  } else {
    actions.push(
      `Compare this against another product before drawing a conclusion — a change only means something relative to that product's own history.`,
    );
  }

  return { headline, observations, actions };
}
