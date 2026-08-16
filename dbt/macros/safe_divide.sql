{#
  macro: safe_divide
  purpose: Division returning NULL rather than erroring or returning 0 on a
           zero or null denominator, so trend models can distinguish "no
           baseline to compare against" from "zero change" instead of
           silently presenting them the same way.
  limitations: Callers must decide how to display a NULL result — it is a
               deliberate absence of a value, not a zero.
#}

{% macro safe_divide(numerator, denominator) %}
    case
        when {{ denominator }} is null or {{ denominator }} = 0 then null
        else ({{ numerator }})::float / ({{ denominator }})::float
    end
{% endmacro %}
