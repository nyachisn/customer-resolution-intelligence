# Build Plan — Status Board

**Updated:** August 15, 2026 · **Repo:** https://github.com/nyachisn/customer-resolution-intelligence

| Key | Meaning |
|---|---|
| ✅ | Done |
| 🟦 | Ready — unblocked, can start now |
| ⏸️ | Blocked — waiting on something (named) |
| ⚠️ | Changed from original plan — see note |
| ⬜ | Not started |

**Overall:** Phase 0 complete · Snowflake connected · Phase 1 awaiting your SQL review · Phase 11 partly done early

---

## Phase 0 — Product & Repository Foundation

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Create GitHub repo | ✅ | Public, README/LICENSE/.gitignore/.env.example |
| 2 | Repo architecture | ✅ | All 7 dirs |
| 3 | Spec into `/docs` | ⚠️ | PDF at root; **Markdown in `/docs` is source of truth**, PDF regenerates from it |
| 4 | Initial ADRs | ✅ | ADR-001…005 |
| 5 | Audit CFPB source | ✅ | `02_data_source_audit.md` |
| 6 | Source Quality Report | ✅ | `08_source_quality_report.md` |
| 7 | **You approve source contract** | ⏸️ | **Waiting on you** |
| 8 | Update data dictionary | ✅ | `03_data_dictionary.md` v1.1 |
| 9 | Freeze MVP scope | ⚠️ | `09_supported_vs_unsupported_metrics.md`. **Dispute signal removed — field doesn't exist** |

---

## Phase 1 — Snowflake Foundation

| # | Item | Status | Note |
|---|---|---|---|
| 10 | Bootstrap SQL | ✅ | Real idempotent SQL — roles, warehouse, monitor, schemas, tags, grants |
| 11 | **You review SQL** | ⏸️ | **Waiting on you** — PR open |
| 12 | Execute bootstrap | ⏸️ | Blocked by 11. Account connected ✅ |
| 13 | Verify environment | ⏸️ | Blocked by 12 |
| — | Snowflake connection | ✅ | `snow` CLI 3.24.1, key-pair auth, tested OK |
| 14 | Governance metadata | ⬜ | |

---

## Phase 2 — CFPB Ingestion

| # | Item | Status | Note |
|---|---|---|---|
| 15 | Ingestion scripts | ⚠️ | 5 stubs w/ contracts — no logic |
| 16 | Download dataset | 🟦 | Can do now, no Snowflake needed |
| 17 | Validate file locally | 🟦 | |
| 18 | Profile dataset | 🟦 | Would confirm sampled figures in §4 of quality report |
| 19 | Document findings | 🟦 | |
| 20 | File format / stage | ⏸️ | Snowflake |
| 21 | `RAW.CFPB_COMPLAINTS` | ⏸️ | Snowflake |
| 22 | Load to Snowflake | ⏸️ | Snowflake |
| 23 | Validate raw load | ⏸️ | Snowflake |

---

## Phase 3 — dbt Foundation

| # | Item | Status | Note |
|---|---|---|---|
| 24 | Scaffold dbt | ✅ | Project, packages, 13 models, macros, seeds, tests |
| 25 | Configure dbt → Snowflake | ⏸️ | Snowflake |
| 26 | `dbt debug` | ⏸️ | Snowflake |
| 27 | Source definition | ✅ | `stg_cfpb_complaints.yml` |
| 28 | `stg_cfpb_complaints` | ⚠️ | Stub — contract written, no SQL |
| 29 | Staging YAML docs | ✅ | All 16 fields + traps documented |
| 30 | Foundational tests | ✅ | Declared; run blocked |
| 31 | `dbt parse` / `build` / `test` | ⚠️ | **parse ✅ green in CI**; build/test blocked |
| 32 | Review generated data | ⏸️ | Snowflake |
| 33 | Fusion live validation | ⏸️ | Snowflake |

---

## Phase 4 — Analytics Engineering

| # | Item | Status | Note |
|---|---|---|---|
| 34 | `int_complaint_lifecycle` | ⚠️ | **Renamed `int_complaint_status_context`** (ADR-004) |
| 35 | `int_issue_daily_volume` | ⬜ | Stub |
| 36 | `int_issue_trends` | ⬜ | Stub |
| 37 | `int_company_issue_patterns` | ⬜ | Stub — constrained to `LIMITED` confidence |
| 38 | `int_resolution_signals` | ⬜ | Stub |
| 39 | `int_priority_policy_application` | ⬜ | Stub |
| 40 | Rolling windows | ⬜ | |
| 41 | Baselines | ⬜ | |
| 42 | Emerging-pattern qualification | ⬜ | Spec'd in `04_decisioning_policy.md` §8 |
| 43 | Publication-lag signals | ⬜ | Spec'd — 60-day window |
| 44 | Confidence classification | ⬜ | Domain defined; not implemented |

---

## Phase 5 — Decisioning Layer

| # | Item | Status | Note |
|---|---|---|---|
| 45 | Policy seeds | ✅ | 3 CSVs w/ real config |
| 46 | Deterministic policy rules | ⚠️ | 6 rules defined. **`CONSUMER_DISPUTED` rule removed** — replaced by `POLICY_CRITICAL_COMBINATION` |
| 47 | Every action has `policy_id` | ✅ | Contract; enforcement pending |
| 48 | Every action has `reason_code` | ✅ | Contract; enforcement pending |
| 49 | "No action" valid | ✅ | `STANDARD_HANDLING` |
| 50 | Custom dbt policy tests | ⚠️ | 3 stubs written, no SQL |

---

## Phase 6 — Product Marts

| # | Item | Status |
|---|---|---|
| 51–56 | 6 mart models | ⬜ Stubs exist |
| 57 | Lineage metadata | ⬜ |
| 58 | Caveat/limitation fields | ⬜ Spec'd |
| 59 | Confidence fields | ⬜ Spec'd |
| 60 | Full `dbt build` | ⏸️ Snowflake |
| 61 | Review DAG | ⏸️ |
| 62 | `dbt docs generate` | ⏸️ |

---

## Phase 7 — Product Data Contract

| # | Item | Status | Note |
|---|---|---|---|
| 63 | Define contract | ⚠️ | Drafted in `app/src/lib/types.ts` + dictionary §6 |
| 64 | Permitted fields | ✅ | `02_data_provenance.md` §7 |
| 65 | Exclusions | ✅ | Narratives, `tags`, `zip_code`, unsupported metrics |
| 66 | Demo-export schema | ⬜ | |
| 67 | Build `export_demo_data.py` | ⚠️ | Stub |
| 68 | Generate demo data | ⏸️ | Snowflake |
| 69 | Validate export | ⏸️ | |
| 70 | **You review every field** | ⏸️ | Manual gate — required |

---

## Phase 8 — Product / UX Design

| # | Item | Status |
|---|---|---|
| 71–80 | All design work | ⬜ Not started |

Screens: Landing · Operations Overview · Issue Investigation · Complaint Record Context · Methodology · Assessment CTA

---

## Phase 9 — Next.js Application

| # | Item | Status | Note |
|---|---|---|---|
| 81 | Create app | ⚠️ | Config only — `package.json`, `tsconfig`, `next.config`, `vercel.json`. **`npm install` not run** |
| 82 | Structure | ✅ | Dirs scaffolded |
| 83 | Types | ⚠️ | `types.ts` drafted |
| 84 | Connect demo data | ⬜ | Loader stub |
| 85–95 | Pages, charts, a11y | ⬜ | |
| 96 | Run locally | ⬜ | |
| 97 | Mobile/responsive | ⬜ | |

---

## Phase 10 — Vercel

| # | Item | Status |
|---|---|---|
| 98–108 | All Vercel work | ⬜ Not started |

---

## Phase 11 — CI/CD *(partly done early)*

| # | Item | Status | Note |
|---|---|---|---|
| 109 | GitHub Actions | ✅ | `dbt-ci.yml`, `app-ci.yml` |
| 110 | dbt CI | ⚠️ | **parse + governance ✅ green**; build job gated `if: false` until Snowflake |
| 111 | App CI | ⚠️ | Disclosure checks live; build gated until `npm install` |
| 112 | Branch protection | ⬜ | **Recommend before sharing repo** |
| 113 | PR workflow | ⬜ | |

Extra (not in original plan): CI blocks duration-shaped identifiers, dispute-field references, and models missing grain/limitations headers.

---

## Phase 12 — Customer CTA

| # | Item | Status |
|---|---|---|
| 114–118 | CTA + form | ⬜ Not started |

---

## Phase 13 — Portfolio Polish

| # | Item | Status | Note |
|---|---|---|---|
| 119 | README | ✅ | Done |
| 120–130 | Diagrams, screenshots, walkthrough | ⬜ | 128 (ADRs) ✅ · 126 (source findings) ✅ · 127 (limitations) ✅ |

---

## Phase 14 — Interview Readiness

| # | Item | Status |
|---|---|---|
| 131–140 | All prep | ⬜ Not started |

---

## Phase 15 — Commercial Experiment

| # | Item | Status |
|---|---|---|
| 141–147 | Discovery | ⬜ Not started |

---

# Issue Log

| # | Date | Issue | Resolution |
|---|---|---|---|
| L-01 | Aug 15 | Repo name already existed on GitHub | Verified identical SHAs — prior push. Wired `origin`. **Resolved** |
| L-02 | Aug 15 | CI `dbt parse` failed — no resolvable profile | Added placeholder CI profile. **Fixed immediately** |
| L-03 | Aug 15 | dbt 1.12 deprecations (freshness, accepted_values) | Moved to `config`/`arguments`. **Fixed immediately** |
| L-04 | Aug 15 | `timely_response_status = UNKNOWN` unreachable in source | Test set to `severity: warn`. **Accepted, documented** |
| L-05 | Aug 15 | Null rates measured on 192k sample, not full 17.1M | **Postponed** → item 18 re-measures on full load |
| L-06 | Aug 15 | Snowflake JWT auth failed twice before key registration | Expected — key not yet registered. **Resolved** after `ALTER USER`, fingerprint matched |
| L-07 | Aug 15 | dbt `+schema:` overrides would have created `ANALYTICS_PROD_operations` etc., leaving `CRI_APP_READER` granted on an empty schema | Removed overrides; models land in target schema. **Fixed pre-merge** |
| L-08 | Aug 15 | Dead `SET DB` variable in `03_grants.sql` | Removed. **Fixed pre-merge** |
| L-09 | Aug 15 | `dbt-ci` path filter missed `snowflake/**` and `scripts/**` | Widened. **Fixed pre-merge** |

---

# Decisions Needed From You

| # | Decision | Blocks |
|---|---|---|
| D-01 | Approve source contract (item 7) | Phase 1 onward |
| ~~D-02~~ | ~~Snowflake account~~ — **resolved**, existing account connected | ~~—~~ |
| D-03 | Enable branch protection now? | Item 112 |
| ~~D-04~~ | ~~Node.js 20 deprecation~~ — **resolved**, `actions/checkout` bumped to v5 | ~~—~~ |

---

# Recommended Next 3

1. **Review the bootstrap SQL** (item 11) — unblocks Phases 1–6.
2. **Items 16–19** — download + profile the real dataset. Doable now, no Snowflake, confirms the sampled figures.
3. **Item 112** — branch protection before the repo gets shared.
