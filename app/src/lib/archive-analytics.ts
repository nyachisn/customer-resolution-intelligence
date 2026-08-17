/**
 * Analytics over the full published archive, at month grain.
 *
 * This is the population the interface should lead with: 176 months,
 * 2011-12 to 2026-07, ~16.9M published records. Everything here rolls raw
 * product labels up into the families defined in product-families.ts, so a
 * series stays continuous across the CFPB's 2017 and 2023 renames.
 *
 * Monthly grain is not cosmetic. The daily series this dashboard used to
 * lead with is dominated by the working week — Sundays average 6,328
 * complaints against 26,571 on a Wednesday, 34% of a weekday — so a daily
 * line is mostly a picture of the calendar. At month grain that artifact
 * integrates out and real movement becomes visible.
 */

import type {
  ArchiveMonthProduct,
  IssueMovement,
  PolicyCombination,
  ProductPolicyRate,
} from "./types";
import { PRODUCT_FAMILIES, type ProductFamily, familyFor } from "./product-families";
import { formatMonth } from "./analytics";

export interface MonthPoint {
  /** ISO date, first of the month — charts index on a date string. */
  date: string;
  value: number;
}

export interface FamilySeries {
  family: ProductFamily;
  points: MonthPoint[];
  total: number;
  /** Volume in the most recent 12 complete months. */
  recent12m: number;
  /** Volume in the 12 months before those. */
  prior12m: number;
  /** recent12m vs prior12m. Null when there is no prior activity. */
  changePct: number | null;
  /** Last month's volume over the family's first active month. */
  growthMultiple: number | null;
  /** Share of the whole archive. */
  share: number;
  firstActive: string | null;
  lastActive: string | null;
  trend: "growing" | "steady" | "declining" | "ended" | "new";
}

/** Every month present in the export, ascending. */
export function archiveMonths(rows: ArchiveMonthProduct[]): string[] {
  return [...new Set(rows.map((r) => r.month))].sort();
}

/** Total volume per month across every product. */
export function archiveTotals(rows: ArchiveMonthProduct[], months: string[]): MonthPoint[] {
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.total);
  return months.map((m) => ({ date: `${m}-01`, value: byMonth.get(m) ?? 0 }));
}

/** Running total across the archive — the shape of "17 million records". */
export function cumulative(points: MonthPoint[]): MonthPoint[] {
  let running = 0;
  return points.map((p) => {
    running += p.value;
    return { date: p.date, value: running };
  });
}

/**
 * One continuous series per product family, with the movement measures the
 * growing/steady/declining question needs.
 *
 * A family with no volume at all is dropped rather than drawn as a flat
 * zero line, which would read as "we measured it and it was nothing".
 */
export function familySeries(rows: ArchiveMonthProduct[], months: string[]): FamilySeries[] {
  const byFamily = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const family = familyFor(r.product);
    if (!family) continue;
    const bucket = byFamily.get(family.id) ?? new Map<string, number>();
    bucket.set(r.month, (bucket.get(r.month) ?? 0) + r.total);
    byFamily.set(family.id, bucket);
  }

  const archiveTotal = rows.reduce((s, r) => s + r.total, 0);
  const recentMonths = months.slice(-12);
  const priorMonths = months.slice(-24, -12);
  const lastMonth = months[months.length - 1];

  const out: FamilySeries[] = [];
  for (const family of PRODUCT_FAMILIES) {
    const bucket = byFamily.get(family.id);
    if (!bucket) continue;

    const points = months.map((m) => ({ date: `${m}-01`, value: bucket.get(m) ?? 0 }));
    const total = [...bucket.values()].reduce((s, v) => s + v, 0);
    if (total === 0) continue;

    const active = months.filter((m) => (bucket.get(m) ?? 0) > 0);
    const firstActive = active[0] ?? null;
    const lastActive = active[active.length - 1] ?? null;

    const recent12m = recentMonths.reduce((s, m) => s + (bucket.get(m) ?? 0), 0);
    const prior12m = priorMonths.reduce((s, m) => s + (bucket.get(m) ?? 0), 0);
    const changePct = prior12m > 0 ? (recent12m - prior12m) / prior12m : null;

    const firstValue = firstActive ? (bucket.get(firstActive) ?? 0) : 0;
    const lastValue = lastMonth ? (bucket.get(lastMonth) ?? 0) : 0;
    const growthMultiple = firstValue > 0 && lastValue > 0 ? lastValue / firstValue : null;

    // "ended" and "new" are statements about the taxonomy, not about
    // conduct: a retired label stops receiving complaints because the
    // category stopped existing, which is not a decline.
    let trend: FamilySeries["trend"];
    if (recent12m === 0) trend = "ended";
    else if (prior12m === 0) trend = "new";
    else if (changePct != null && changePct > 0.1) trend = "growing";
    else if (changePct != null && changePct < -0.1) trend = "declining";
    else trend = "steady";

    out.push({
      family, points, total, recent12m, prior12m, changePct, growthMultiple,
      share: archiveTotal > 0 ? total / archiveTotal : 0,
      firstActive, lastActive, trend,
    });
  }

  return out.sort((a, b) => b.total - a.total);
}

export const TREND_LABEL: Record<FamilySeries["trend"], string> = {
  growing: "Growing",
  steady: "Steady",
  declining: "Declining",
  ended: "Category retired",
  new: "New category",
};

/**
 * The largest month-over-month moves in a series.
 *
 * These are annotations of *what* moved, never why. The archive records no
 * cause — no awareness data, no company-side data, nothing that could
 * support an explanation — so the copy attached to these says what changed
 * and stops there.
 */
export interface Inflection {
  date: string;
  value: number;
  previous: number;
  changePct: number;
  label: string;
}

export function inflections(points: MonthPoint[], limit = 1): Inflection[] {
  const moves: Inflection[] = [];
  // Ignore the first year: early months are tiny, so ordinary noise there
  // produces enormous percentages that crowd out real later movement.
  for (let i = 13; i < points.length; i += 1) {
    const previous = points[i - 1].value;
    const value = points[i].value;
    if (previous < 500) continue;
    const changePct = (value - previous) / previous;
    if (Math.abs(changePct) < 0.2) continue;
    moves.push({
      date: points[i].date,
      value,
      previous,
      changePct,
      label: `${changePct > 0 ? "+" : ""}${Math.round(changePct * 100)}% vs ${formatMonth(points[i - 1].date)}`,
    });
  }
  return moves.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, limit);
}

/**
 * Which issues drove a family's last 12 months against the 12 before.
 *
 * This is the honest answer to "what caused the change": not a reason, but
 * a decomposition — which parts of the category actually moved.
 */
export interface IssueContribution {
  issue: string;
  current: number;
  prior: number;
  delta: number;
  changePct: number | null;
  /** Share of the family's total change this issue accounts for. */
  contribution: number;
}

export function issueContributions(
  movement: IssueMovement[],
  family: ProductFamily | null,
  limit = 6,
): { rows: IssueContribution[]; totalDelta: number } {
  const members = family ? new Set(family.members) : null;
  const byIssue = new Map<string, { current: number; prior: number }>();

  for (const m of movement) {
    if (members && !members.has(m.product)) continue;
    const acc = byIssue.get(m.issue) ?? { current: 0, prior: 0 };
    acc.current += m.current12m;
    acc.prior += m.prior12m;
    byIssue.set(m.issue, acc);
  }

  const all = [...byIssue.entries()].map(([issue, v]) => ({
    issue,
    current: v.current,
    prior: v.prior,
    delta: v.current - v.prior,
    changePct: v.prior > 0 ? (v.current - v.prior) / v.prior : null,
  }));

  const totalDelta = all.reduce((s, r) => s + r.delta, 0);
  const rows = all
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
    .map((r) => ({
      ...r,
      contribution: totalDelta !== 0 ? r.delta / totalDelta : 0,
    }));

  return { rows, totalDelta };
}

/**
 * Policy trigger rates for a family, or across the whole archive.
 *
 * evaluated_count is the product's entire record count: every record is
 * evaluated against every policy, and only triggers land in policy_ids.
 */
export function policyRatesFor(
  rates: ProductPolicyRate[],
  family: ProductFamily | null,
): { policyId: string; triggered: number; evaluated: number; rate: number | null }[] {
  const members = family ? new Set(family.members) : null;
  const byPolicy = new Map<string, { triggered: number; evaluated: number }>();
  const evaluatedByProduct = new Map<string, number>();

  for (const r of rates) {
    if (members && !members.has(r.product)) continue;
    const acc = byPolicy.get(r.policyId) ?? { triggered: 0, evaluated: 0 };
    acc.triggered += r.triggeredCount;
    byPolicy.set(r.policyId, acc);
    evaluatedByProduct.set(r.product, r.evaluatedCount);
  }

  // Every policy shares the same denominator — the record count of the
  // products in scope — so it is summed once across products rather than
  // once per policy row, which would multiply it by the policy count.
  const evaluated = [...evaluatedByProduct.values()].reduce((s, v) => s + v, 0);

  return [...byPolicy.entries()]
    .map(([policyId, v]) => ({
      policyId,
      triggered: v.triggered,
      evaluated,
      rate: evaluated > 0 ? v.triggered / evaluated : null,
    }))
    .sort((a, b) => b.triggered - a.triggered);
}

/* ------------------------------------------------------------------ */
/* Exact policy-set arithmetic                                          */
/* ------------------------------------------------------------------ */

export interface RuleCoverage {
  /** Records tripping at least one of the selected rules. Exact. */
  selected: number;
  /** Records tripping at least one rule, with every rule switched on. */
  anyRule: number;
  /** Records tripping no rule at all — standard handling. */
  noRule: number;
  /** Every record evaluated in scope. */
  evaluated: number;
  /** Exact count per individual rule, for the per-rule readouts. */
  perRule: Record<string, number>;
}

/**
 * How many records a chosen set of rules actually pulls out.
 *
 * A union, not a sum. The combinations partition the population, so a record
 * tripping both "emerging issue" and "incomplete context" is counted once
 * here and twice by any approach that adds per-policy totals. That
 * double-count is what made the previous panel claim 5.5M against a true
 * 5,017,782, and it is why switching every rule on never approached the
 * population total the way a reader would reasonably expect.
 */
export function ruleCoverage(
  combinations: PolicyCombination[],
  family: ProductFamily | null,
  selected: readonly string[],
): RuleCoverage {
  const members = family ? new Set(family.members) : null;
  const on = new Set(selected);

  let evaluated = 0;
  let selectedCount = 0;
  let anyRule = 0;
  let noRule = 0;
  const perRule: Record<string, number> = {};

  for (const combo of combinations) {
    if (members && !members.has(combo.product)) continue;
    evaluated += combo.count;

    if (combo.policies.length === 0) {
      noRule += combo.count;
      continue;
    }
    anyRule += combo.count;
    if (combo.policies.some((p) => on.has(p))) selectedCount += combo.count;
    for (const p of combo.policies) perRule[p] = (perRule[p] ?? 0) + combo.count;
  }

  return { selected: selectedCount, anyRule, noRule, evaluated, perRule };
}

/**
 * How often each pair of rules fires on the same record.
 *
 * Read across a row: the share of that rule's records which also trip the
 * column's rule. Derived from the same combinations, so it needs no
 * additional export.
 */
export function policyOverlap(
  combinations: PolicyCombination[],
  family: ProductFamily | null,
  ids: readonly string[],
): { rowId: string; total: number; cells: { colId: string; share: number | null }[] }[] {
  const members = family ? new Set(family.members) : null;
  const totals = new Map<string, number>();
  const pairs = new Map<string, number>();

  for (const combo of combinations) {
    if (members && !members.has(combo.product)) continue;
    for (const a of combo.policies) {
      totals.set(a, (totals.get(a) ?? 0) + combo.count);
      for (const b of combo.policies) {
        if (a === b) continue;
        const key = `${a}>${b}`;
        pairs.set(key, (pairs.get(key) ?? 0) + combo.count);
      }
    }
  }

  return ids.map((rowId) => {
    const total = totals.get(rowId) ?? 0;
    return {
      rowId,
      total,
      cells: ids.map((colId) => ({
        colId,
        share: colId === rowId || total === 0 ? null : (pairs.get(`${rowId}>${colId}`) ?? 0) / total,
      })),
    };
  });
}
