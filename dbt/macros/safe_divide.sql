{#
  macro: safe_divide
  purpose: Division returning NULL rather than erroring on a zero denominator.
  limitations: Trend models must not silently present NULL as zero change. Callers state the behavior explicitly.
  STATUS: NOT IMPLEMENTED. Phase 0 scaffold.
#}
