# app/

Next.js + TypeScript portfolio application, deployed on Vercel.

**Status:** not yet implemented. Requirements below are binding.

## Views

| View | Shows | Must never show |
|---|---|---|
| Landing | Value proposition, prototype disclosure, product flow, methodology links | A production-integration or purchase CTA |
| Operations overview | Aggregate trends, emerging signals, action counts, observed-share context | Consumer identities, company rankings, any response-time measure |
| Issue investigation | Current volume, baseline, % change, observed share, confidence, trend window, taxonomy, threshold, limitation | Causal claims, market prevalence, a % increase framed as an incident |
| Complaint-record context | Published structured context, status signals, action, reasons, confidence, uncertainty | Narrative text, PII, "customer" framing of a public row, any duration |
| Action playbook | Action definition, policy ID, owner, human-review condition, limitation | Autonomous resolution instruction |

## Hard constraints

- **No response-time encoding of any kind** — no duration, elapsed time, clock, SLA indicator, "days to respond," or visual proxy for speed. The published `timely_response` signal appears only as a source-provided category with a tooltip noting that CFPB publishes no company response timestamp.
- **The browser never connects to Snowflake.** The app reads a curated versioned export or a server-only API route.
- **No credentials in client-side variables.** Not Snowflake account details, not keys, not raw exports.
- **Every chart carries an accessible text summary**, and color alone never communicates priority or status.
- **Every aggregate view carries its context note** from `docs/02_data_provenance.md` §9.

## Accessibility baseline

Semantic HTML, descriptive labels, keyboard navigation, visible focus state, sufficient contrast, mobile-legible layouts.

## Environment

```text
NEXT_PUBLIC_APP_ENV=
DEMO_DATA_VERSION=
```

Client-safe values only. See `.env.example`.

## Before merging UI copy

Check it against `docs/01_product_requirements.md` §9, "Explicitly unacceptable claims," and the caveat column of `docs/09_supported_vs_unsupported_metrics.md`.
