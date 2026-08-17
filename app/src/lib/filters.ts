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

export type ChartMode = "growth" | "multiples";

export const CHART_MODES: { value: ChartMode; label: string; help: string }[] = [
  { value: "growth", label: "Growth table", help: "Every product family ranked, with its 15-year shape" },
  { value: "multiples", label: "Small multiples", help: "One curve per family, all on the same scale" },
];

export type ArchiveView = "volume" | "cumulative";

export const ARCHIVE_VIEWS: { value: ArchiveView; label: string; help: string }[] = [
  { value: "volume", label: "Per month", help: "Complaints published in each month" },
  { value: "cumulative", label: "Running total", help: "Everything published up to that month" },
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

export interface DashboardFilters {
  /**
   * A product-family id from product-families.ts, or null for the whole
   * archive. Families rather than raw labels: the CFPB renamed its product
   * taxonomy in 2017 and 2023, so a raw label cannot address a continuous
   * 15-year series.
   */
  family: string | null;
  view: ArchiveView;
  selectedRules: RuleId[];
  chartMode: ChartMode;
  /** A month (YYYY-MM) pinned on the archive curve. */
  focus: string | null;
  /** "rec:<complaint id>" or "model:<dbt model name>". */
  item: string | null;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  family: null,
  view: "volume",
  selectedRules: [...RULE_IDS],
  chartMode: "growth",
  focus: null,
  item: null,
};

type RawParams = Record<string, string | string[] | undefined>;

function one(raw: RawParams, key: string): string | undefined {
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

const ISO_MONTH = /^\d{4}-\d{2}$/;
const ITEM_REF = /^(rec|model):[A-Za-z0-9_.-]{1,64}$/;

/**
 * Read filters out of a query string. Unknown or malformed values fall back
 * to the default rather than throwing — a hand-edited URL should degrade to
 * a working dashboard, not an error page.
 */
export function parseFilters(raw: RawParams): DashboardFilters {
  const chartMode = one(raw, "chartMode");
  const view = one(raw, "view");
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
    family: one(raw, "family")?.trim() || null,
    view: ARCHIVE_VIEWS.some((v) => v.value === view) ? (view as ArchiveView) : DEFAULT_FILTERS.view,
    selectedRules,
    chartMode: CHART_MODES.some((m) => m.value === chartMode)
      ? (chartMode as ChartMode)
      : DEFAULT_FILTERS.chartMode,
    focus: focus && ISO_MONTH.test(focus) ? focus : null,
    item: item && ITEM_REF.test(item) ? item : null,
  };
}

/** Serialize to a query string, omitting anything still at its default. */
export function filtersToQuery(f: DashboardFilters): string {
  const q = new URLSearchParams();

  if (f.family) q.set("family", f.family);
  if (f.view !== DEFAULT_FILTERS.view) q.set("view", f.view);
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
