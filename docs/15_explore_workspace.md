# 15 — Explore workspace

The Explore surface is a connected, URL-addressable decision workspace built
entirely on the curated static export. There is no API layer, no client access
to Snowflake, and no raw-record delivery as an analytical mechanism.

## 0. Why the surface was rebuilt around the archive

The first version led with `operations_overview_metrics`: daily volume by
product across 165 days. Two measured problems made that unreadable as a
story.

**The daily series draws the calendar.** Sunday averages 6,328 complaints
against 26,571 on a Wednesday — weekends run at 34% of a weekday. A daily line
is therefore mostly a picture of the working week, and real movement hides
underneath it. Month grain integrates the artifact out.

**The export had discarded the dimensions.** `fct_issue_daily_metrics` holds
date x product x issue across the whole archive, but the `monthly_volume`
query collapsed it with `DATE_TRUNC('month') ... GROUP BY 1`, dropping product
and issue. The result: the 15-year growth curve and the product breakdown
lived in two different exports and could never be crossed, so the one chart
with a story had nothing to drill into. `archive_explorer.json` fixes that at
source.

**The CFPB renamed its product taxonomy twice** — April 2017 and August 2023.
Plotted on raw labels, a 15-year per-product chart shows nearly every category
dying and being reborn on those dates; credit reporting alone appears as three
unrelated products. `app/src/lib/product-families.ts` maps the lineages, and
the chart marks both change dates rather than smoothing over them.

---

## 1. Three populations, never blended

Three different populations appear on one screen. They have different grains,
different coverage, and different authority, so each carries a fixed label
wherever it appears. Mixing them — summing across them, or comparing a number
from one against a number from another — is the primary correctness risk on
this surface.

| Population | Source | Grain | Coverage | User-facing label |
|---|---|---|---|---|
| **Archive** | `ledger_exhibits.json` | Month, all products | 17,119,581 records · 2020-01 → 2026-07 | "Whole archive, all products" / "of the archive" |
| **Metric views** | `operations_overview_metrics.json` | Date × product | 165 days · 11 products · 2026-02-17 → 2026-07-31 | "Metric views cover 165 days across 11 products" |
| **Sample** | `agent_case_context.json` | One published complaint | 300 stratified rows · 2 received dates | "Illustrative record context" / "Stratified 300-row demonstration sample" |

The dashboard footnote states all three bounds on every view.

### What each population may be used for

- **Archive** — the growth curve, and the policy trigger rates in the rules
  rail (`triggered_count / evaluated_count` over the full population).
- **Metric views** — every KPI, every chart mode, the readout, and all
  cross-filtering. This is the only population that responds to filters.
- **Sample** — display only. It is never counted, ranked, prioritized, or used
  to draw a cross-filtered conclusion. `buildAttentionQueue`, which previously
  grouped these rows into a ranked queue with record counts, was removed
  because that is exactly the population claim the sample cannot support.

`product` is the only dimension the metric series and the sample share, so it
is the only cross-filtering key.

---

## 2. Filter contract

`app/src/lib/filters.ts` is the single typed description of dashboard state,
and `app/src/lib/use-filters.ts` binds it to the address bar. Defaults are
omitted from the query string, so an untouched dashboard has a clean URL.

| Parameter | Values | Default |
|---|---|---|
| `product` | exact product string | all products |
| `measure` | `complaint_volume`, `emerging_issue_count` | `complaint_volume` |
| `period` | `28`, `56`, `90`, `0` (all) | `28` |
| `compare` | `1` / `0` | `1` |
| `hideRecentIncompleteDays` | `1` / `0` | `1` |
| `selectedRules` | csv of `untimely,emerging,lag,incomplete,critical` | all five |
| `chartMode` | `trend`, `ranked`, `slope`, `multiples` | `trend` |
| `focus` | ISO date on the metric series | none |
| `item` | `rec:<complaint id>` or `model:<dbt model name>` | none |

Malformed values fall back to the default rather than throwing: a hand-edited
URL degrades to a working dashboard.

**No parameter exists for a dimension that does not exist at the relevant
grain.** There is deliberately no `issue`, `company`, or `state` parameter —
those live at one grain or none, and a URL accepting them would promise
filtering the export cannot deliver.

### `focus` is metric-scoped by construction

The sample's 300 records land on two received dates. A date filter over them
would blank the panel for almost every selection, so `focus` names a date on
the metric series and nothing else reads it. When a focus is active, the
sample panel states in place: *"The focused date applies to the metric views
above. These records are a fixed sample and are not date-scoped."*

This is the rule behind the constraint "do not create an interaction that
appears to filter records or decisions by date if the current export cannot
support it."

---

## 3. Payload strategy

Optimized within the static-export architecture; no backend services added.

### Measured, `/explore` RSC payload

| | Before | After |
|---|---|---|
| Metric rows | 1,957,265 B (15,023 long-format rows) | 16,577 B (pivoted series) |
| Record sample | 480,584 B (300 full records) | 75,140 B (list projection) |
| **Total document** | ~2.4 MB | **107 KB** |

**Pivot.** `buildMetricBundle` reshapes the long-format export into aligned
per-dimension arrays server-side. Each of the 15,023 rows repeated its metric
name and a product string up to 52 characters long; the pivot carries the same
numbers against shared axes. Each metric keeps its own date axis —
`complaint_volume` and `emerging_issue_count` do not cover identical ranges and
must not share one. `action_count` is excluded entirely: a single-date snapshot
on a time axis would imply a trend the row does not contain.

**Projection.** The sample crosses the wire as id, product, issue, priority,
recommended action, confidence, and policy ids — enough to list and to filter
by rule. `context_summary`, `sub_issue`, `company_response` and the received
date stay on the server.

**On demand.** Exactly one full record is loaded, and only when `item` names
it. This is the single asynchronous boundary in the workspace and the only
place a skeleton is shown. Every other filter is answered from data the client
already holds and updates through `history.replaceState`, with no round-trip.

**Virtualization.** The sample list renders only its visible slice plus
overscan (`VirtualList`). Rows are a fixed 104px because the component
positions by arithmetic, not measurement; the row text is clamped to hold that
contract.

**Top-N.** Ranked, slope and small-multiple modes show the top 8 products by
volume in the window.

### Remaining sample boundary

300 complaint ids and their product/issue labels are still in the default
payload, because the panel lists them. These are published CFPB record
identifiers with no consumer identifiers and no narrative text. Removing them
entirely requires the Phase 5 aggregated export below, which replaces the
sample as the primary decision surface.

---

## 4. Model Lens

`app/src/lib/model-registry.ts` is the single description of the dbt layer used
by the application. Both the Data Story page and Explore's Model Lens read it,
so a model is defined in exactly one place.

Every field is transcribed from source material already in this repository —
the `-- purpose / grain / outputs / limitations` headers on each model's `.sql`
and the first-person `description:` blocks in the five schema `.yml` files.

**It claims no runtime lineage and no dbt run state.** It describes how the
transformation layer is written, not the result of any particular run.

`surfaces` is the one thing dbt cannot know: which panels a model feeds. It is
hand-authored, and selecting a model outlines those panels and dims the rest.

---

## 5. Phase 5 — proposed, not implemented

Both are new pre-aggregated queries in `scripts/export_demo_data.py`, run under
`CRI_APP_READER`. No Snowflake object, dbt model, ingestion path, or policy
logic changes. No API layer, no client warehouse access, no raw-record delivery.

### A. Population qualification matrix

Source: `INT_PRIORITY_POLICY_APPLICATION`, grouped `product × issue × policy_id`.

```
qualification_matrix.json
[
  {
    "PRODUCT":            string,
    "ISSUE":              string,
    "POLICY_ID":          string,
    "EVALUATED_COUNT":    integer,   -- records evaluated against this policy
    "TRIGGERED_COUNT":    integer,   -- records where it fired
    "TRIGGER_RATE":       float,     -- TRIGGERED_COUNT / EVALUATED_COUNT
    "QUALIFIED_COUNT":    integer,   -- of the triggered, those whose pattern
                                     -- reached QUALIFIED_SIGNAL
    "MIN_CONFIDENCE":     string,    -- weakest signal_confidence among them
    "SNAPSHOT_DATE":      date,      -- source_snapshot_date
    "COVERAGE_MIN_DATE":  date,
    "COVERAGE_MAX_DATE":  date
  }
]
```

Bounded to the top 12 issues per product to keep the export small; the residual
is emitted as a single `"All other issues"` row per product × policy so the
denominators still reconcile to the population.

Until this exists, Explore shows the lighter "Rules in this view" panel —
population trigger rates per policy, with no product or issue cross-tab.
**No sample-scoped matrix ships**, per the approved constraint.

### B. Population decision queue

Source: `RESOLUTION_ACTION_QUEUE` joined to `INT_ISSUE_TRENDS`, grouped
`product × issue × priority × recommended_action`.

```
decision_queue_aggregate.json
[
  {
    "PRODUCT":              string,
    "ISSUE":                string,
    "PRIORITY":             string,   -- LOW | MEDIUM | HIGH | CRITICAL
    "RECOMMENDED_ACTION":   string,
    "RECORD_COUNT":         integer,  -- current window
    "PRIOR_RECORD_COUNT":   integer,  -- equivalent prior window
    "CHANGE_PCT":           float,    -- null when PRIOR is 0
    "BASELINE_VOLUME":      float,
    "VOLUME_CHANGE_PCT":    float,
    "OBSERVED_SHARE_PCT":   float,
    "TRIGGERED_POLICY_IDS": array,    -- policies firing for every record in
                                      -- the group; mixed groups emit the
                                      -- intersection, never a union
    "REASON_CODES":         array,    -- same intersection rule
    "MIN_CONFIDENCE":       string,
    "ISSUE_PATTERN_STATUS": string,
    "INTERPRETATION_LIMITATION": string,  -- null when none applies
    "SNAPSHOT_DATE":        date,
    "WINDOW_START":         date,
    "WINDOW_END":           date
  }
]
```

The intersection rule on the array columns is load-bearing: a union would
attribute a policy to records it never fired on, which is the aggregate version
of the population claim this project refuses to make.

### C. Optional — date-aware queue aggregates

Only if date-to-queue cross-filtering is decided to be necessary. It is the
same rollup keyed additionally by `METRIC_DATE`, and it is what would make a
trend-point click legitimately filter decisions.

---

## 6. User-facing labels

The exact strings that keep the three populations distinct:

| Where | Label |
|---|---|
| Growth panel subtitle | "Whole archive, all products · 26,394 published in Jan 2020 · 700,437 in Jul 2026 · 26.5× more per month" |
| Rules rail subtitle | "Trigger rates across all 17.1M published records" |
| Rule switch meta | "… · fires on 0.6% of the archive" |
| Sample panel subtitle | "Stratified 300-row demonstration sample · not a ranking or a population count" |
| Sample panel footnote | "240 of 300 sampled records · the mix is by construction, not by measurement" |
| Sample panel, focus active | "The focused date applies to the metric views above. These records are a fixed sample and are not date-scoped." |
| Drawer scope note | "One record from a stratified 300-row demonstration sample, drawn to cover every decisioning outcome so rare ones stay visible. It is not representative of the 17.1M-record archive and nothing on this dashboard is counted from it." |
| Model drawer scope note | "Transcribed from this project's own model headers and schema files. It describes how the transformation layer is written, not the state of any particular dbt run." |
| Dashboard footnote | "Archive figures cover all 17,119,581 published records. Metric views cover 165 days across 11 products. Record context is a 300-row demonstration sample. The three are never combined." |
