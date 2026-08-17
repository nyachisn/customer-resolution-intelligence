/**
 * The shared filter contract for the Explore workspace.
 *
 * One typed object describes the whole dashboard state, and one codec moves
 * it in and out of the URL. Every surface reads from here, so a click on a
 * bar and a pasted link arrive at exactly the same state by the same route.
 *
 * Two rules this module exists to enforce:
 *
 * 1. Only dimensions that exist at the relevant grain are expressible.
 *    `product` is the single dimension shared by the metric series and the
 *    record sample, so it is the only cross-filtering key. There is
 *    deliberately no issue/company/state parameter: those exist at one grain
 *    or none, and a URL that accepted them would promise filtering the data
 *    cannot deliver.
 *
 * 2. `focus` is metric-scoped. The illustrative record sample lands on two
 *    received dates, so a date selection can never filter it. `focus` names
 *    a date on the metric series and nothing else reads it.
 *
 * Defaults are omitted from the query string, so an untouched dashboard has
 * a clean URL and a shared one carries only what was actually changed.
 */

export type ChartMode = "trend" | "ranked" | "slope" | "multiples";

export const CHART_MODES: { value: ChartMode; label: string; help: string }[] = [
  { value: "trend", label: "Trend", help: "Daily volume over the selected period" },
  { value: "ranked", label: "Ranked", help: "Products by volume, with period change" },
  { value: "slope", label: "Slope", help: "Previous period against current, per product" },
  { value: "multiples", label: "Small multiples", help: "One trend per product, same scale" },
];

/** The five policies whose switches scope the illustrative sample. */
export const RULE_IDS = [
  "POLICY_UNTIMELY_RESPONSE",
  "POLICY_EMERGING_ISSUE",
  "POLICY_PUBLICATION_LAG",
  "POLICY_INCOMPLETE_CONTEXT",
  "POLICY_CRITICAL_COMBINATION",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

/** Short URL codes — full policy ids would dominate the query string. */
const RULE_CODE: Record<RuleId, string> = {
  POLICY_UNTIMELY_RESPONSE: "untimely",
  POLICY_EMERGING_ISSUE: "emerging",
  POLICY_PUBLICATION_LAG: "lag",
  POLICY_INCOMPLETE_CONTEXT: "incomplete",
  POLICY_CRITICAL_COMBINATION: "critical",
};

const CODE_RULE: Record<string, RuleId> = Object.fromEntries(
  Object.entries(RULE_CODE).map(([id, code]) => [code, id as RuleId]),
) as Record<string, RuleId>;

export const PERIODS = [28, 56, 90, 0] as const;

export interface DashboardFilters {
  /** Exact product string, or null for every product. */
  product: string | null;
  /** A metric name present in the metric bundle. */
  measure: string;
  /** Trailing days; 0 means the whole series. */
  period: number;
  compare: boolean;
  hideRecentIncompleteDays: boolean;
  selectedRules: RuleId[];
  chartMode: ChartMode;
  /** ISO date focused on the metric series. Never filters record data. */
  focus: string | null;
  /** "rec:<complaint id>" or "model:<dbt model name>". */
  item: string | null;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  product: null,
  measure: "complaint_volume",
  period: 28,
  compare: true,
  hideRecentIncompleteDays: true,
  selectedRules: [...RULE_IDS],
  chartMode: "trend",
  focus: null,
  item: null,
};

type RawParams = Record<string, string | string[] | undefined>;

function one(raw: RawParams, key: string): string | undefined {
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ITEM_REF = /^(rec|model):[A-Za-z0-9_.-]{1,64}$/;

/**
 * Read filters out of a query string. Unknown or malformed values fall back
 * to the default rather than throwing — a hand-edited URL should degrade to
 * a working dashboard, not an error page.
 */
export function parseFilters(raw: RawParams): DashboardFilters {
  const period = Number(one(raw, "period"));
  const measure = one(raw, "measure");
  const chartMode = one(raw, "chartMode");
  const focus = one(raw, "focus");
  const item = one(raw, "item");

  const rulesParam = one(raw, "selectedRules");
  let selectedRules: RuleId[] = [...RULE_IDS];
  if (rulesParam != null) {
    // An empty value is meaningful — every rule switched off — so it is
    // distinguished from the parameter being absent altogether.
    selectedRules = rulesParam
      .split(",")
      .map((c) => CODE_RULE[c.trim()])
      .filter((id): id is RuleId => Boolean(id));
  }

  return {
    product: one(raw, "product")?.trim() || null,
    measure: measure && /^[a-z_]{1,64}$/.test(measure) ? measure : DEFAULT_FILTERS.measure,
    period: (PERIODS as readonly number[]).includes(period) ? period : DEFAULT_FILTERS.period,
    compare: bool(one(raw, "compare"), DEFAULT_FILTERS.compare),
    hideRecentIncompleteDays: bool(
      one(raw, "hideRecentIncompleteDays"),
      DEFAULT_FILTERS.hideRecentIncompleteDays,
    ),
    selectedRules,
    chartMode: CHART_MODES.some((m) => m.value === chartMode)
      ? (chartMode as ChartMode)
      : DEFAULT_FILTERS.chartMode,
    focus: focus && ISO_DATE.test(focus) ? focus : null,
    item: item && ITEM_REF.test(item) ? item : null,
  };
}

/** Serialize to a query string, omitting anything still at its default. */
export function filtersToQuery(f: DashboardFilters): string {
  const q = new URLSearchParams();

  if (f.product) q.set("product", f.product);
  if (f.measure !== DEFAULT_FILTERS.measure) q.set("measure", f.measure);
  if (f.period !== DEFAULT_FILTERS.period) q.set("period", String(f.period));
  if (f.compare !== DEFAULT_FILTERS.compare) q.set("compare", f.compare ? "1" : "0");
  if (f.hideRecentIncompleteDays !== DEFAULT_FILTERS.hideRecentIncompleteDays) {
    q.set("hideRecentIncompleteDays", f.hideRecentIncompleteDays ? "1" : "0");
  }
  if (!sameRules(f.selectedRules, DEFAULT_FILTERS.selectedRules)) {
    q.set("selectedRules", f.selectedRules.map((id) => RULE_CODE[id]).join(","));
  }
  if (f.chartMode !== DEFAULT_FILTERS.chartMode) q.set("chartMode", f.chartMode);
  if (f.focus) q.set("focus", f.focus);
  if (f.item) q.set("item", f.item);

  return q.toString();
}

function sameRules(a: readonly RuleId[], b: readonly RuleId[]): boolean {
  return a.length === b.length && RULE_IDS.every((id) => a.includes(id) === b.includes(id));
}

export function isDefaultFilters(f: DashboardFilters): boolean {
  return filtersToQuery(f) === "";
}

/** `item` refs, parsed. Returns null when the ref names the other kind. */
export function recordRef(item: string | null): string | null {
  return item?.startsWith("rec:") ? item.slice(4) : null;
}

export function modelRef(item: string | null): string | null {
  return item?.startsWith("model:") ? item.slice(6) : null;
}
