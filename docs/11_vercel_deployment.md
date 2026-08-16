# Vercel Deployment

**Status: prepared, not deployed.** Deploying requires connecting this repository to a Vercel account — an external-authentication step this document stops short of. See "What deployment actually requires" below.

## Architecture being deployed

```text
CFPB → Snowflake RAW → dbt → ANALYTICS_PROD → export_demo_data.py
                                                      │
                                          app/src/data/*.json (committed)
                                                      │
                                    Next.js server components (build-time fs read)
                                                      │
                                       next build → static HTML/JSON
                                                      │
                                                 Vercel (static hosting)
```

The Next.js app has **no runtime dependency on Snowflake**. `scripts/export_demo_data.py` is run manually (or on a schedule, outside Vercel) against `CRI_APP_READER`, and its output — `app/src/data/*.json` — is committed to the repo. `app/src/lib/demo-data.ts` reads those files via `server-only` filesystem access (`fs.readFile`, never `fetch`). Vercel never opens a Snowflake connection, has no Snowflake credentials, and has no server-side data-fetching route to protect.

**Rendering mode.** Six of the seven routes are prerendered as static content at build time. `/explore` is server-rendered on demand because it reads `searchParams` — an insight links into it with a filter pre-applied (`/explore?product=…`). That still reads the same committed JSON from the filesystem; "on demand" means the HTML is assembled per request, not that any external system is queried.

This is why the app currently has zero `process.env` usage (confirmed: `grep -rn "process.env" app/src` returns nothing) — there is nothing environment-specific to configure. **No environment variables are required for deployment.**

## Why Snowflake credentials are never client-exposed

They aren't exposed because they're never present in the deployed artifact at all — not hidden via an env var, not proxied through an API route. The export step that touches Snowflake (`scripts/export_demo_data.py`, using the `~/.snowflake/cri_key.p8` key-pair credential and the `CRI_APP_READER` role) runs on a developer machine or CI runner, entirely separate from and prior to the Vercel build. Vercel's build environment only ever sees the already-exported, already-committed JSON. This is the same "curated export, not a live query API" pattern documented in `docs/05_architecture.md` §13 and `docs/12_project_context.md` — applied here to explain what it means specifically for the hosting platform.

## Curated export model

| File | Produced by | Committed | Read by |
|---|---|---|---|
| `app/src/data/agent_case_context.json` | `scripts/export_demo_data.py` | Yes | `demo-data.ts` |
| `app/src/data/operations_overview_metrics.json` | `scripts/export_demo_data.py` | Yes | `demo-data.ts` |
| `app/src/data/export_meta.json` | `scripts/export_demo_data.py` | Yes | `demo-data.ts` |

Refreshing the demo data means re-running the export script and committing the new JSON — an explicit, reviewable diff, not a silent runtime fetch. This is a deliberate trade-off (documented already in `docs/05_architecture.md` §13): data freshness is bounded by the last export, in exchange for zero runtime Snowflake dependency, zero per-request cost, and zero credential surface in the deployed app.

## Build process

```bash
cd app
npm install
npm run build   # next build — 7 routes, verified in this pass (see below)
```

`vercel.json` (already present, `app/vercel.json`) sets `framework: nextjs`, `buildCommand: npm run build`, and baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) applied to every route. No further Vercel-specific configuration exists or is needed.

## Deployment validation performed this pass

- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean.
- `npx next build` — succeeded: 7 routes (`/`, `/_not-found`, `/data-story`, `/decisions`, `/explore`, `/insights`, `/methodology`). All prerendered as static except `/explore`, which is server-rendered on demand for its filter query string.
- No test runner is configured for the app (`package.json` has no `test` script, no test files found) — this is a known gap, not a false claim of coverage.

## What deployment actually requires (STOP point)

Actually deploying to Vercel requires one of:
1. Connecting this GitHub repository to a Vercel account via the Vercel dashboard (OAuth/GitHub App authorization), or
2. Running `vercel login` and `vercel deploy` interactively from the Vercel CLI, which requires an interactive auth flow (browser-based token exchange or a personal access token).

Both are external-authentication actions on the user's own Vercel/GitHub accounts. Per this round's explicit instruction, this is the stop point: the app is build-verified and deployment-ready, but the actual connect-and-deploy step needs the user to authenticate with Vercel directly. Nothing further was attempted.

## Rollback considerations

Because the deployed artifact is stateless — it holds no database connection and no mutable state — rollback is ordinary Vercel behavior: every deployment is immutable and addressable, and Vercel's dashboard lets you promote any prior deployment back to production instantly, with no data-layer rollback needed (there is no database or live connection to roll back — only the committed JSON snapshot changes between deployments, and that's `git revert`-able like any other file).
