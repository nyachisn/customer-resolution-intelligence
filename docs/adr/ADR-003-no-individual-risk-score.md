# ADR-003 — No individual risk score, and no consumer-level inference

**Status:** Accepted
**Date:** August 15, 2026
**Owner:** Shem Nyachieo
**Related:** `00_project_charter.md` §8, `02_data_provenance.md` §11, `04_decisioning_policy.md` §12

---

## Context

The product produces a `priority` per complaint record and a recommended action. Structurally, that resembles a scoring system. A reader — or a future contributor — could reasonably ask why it is not one, and could extend it into one without noticing they had crossed a line.

This ADR draws the line explicitly.

## Decision

**The product scores complaint records for operational handling. It never scores people.**

Specifically prohibited, permanently and regardless of data availability:

- Any consumer risk score, credit score, fraud score, eligibility score, or vulnerability score.
- Any prediction of consumer behavior, intent, or future action.
- Any consumer profile, whether constructed from one record or many.
- Any use of protected characteristics or proxies for them — including the source `tags` field (`Older American`, `Servicemember`), which is excluded from all decisioning inputs and public surfaces.
- Any adverse-action, compensation, account, legal, or regulatory determination.
- Any attempt to link records to a person, or to re-identify a complainant.

## Rationale

**The data does not support it.** There is no consumer identifier, no account data, no outcome label, and no way to link rows to a person. Any such score would be constructed from thin air.

**The framing would be wrong even with better data.** A complaint is a customer telling an organization something is wrong. Scoring the person who complained inverts the product's purpose: the operational subject is the *issue*, not the complainant.

**It is a live risk, not a hypothetical one.** Complaint data is adjacent to credit reporting — roughly 81% of this dataset is credit-reporting categories — and the adjacent industry does score consumers. The boundary needs to be stated, not assumed.

**Terminology carries the boundary.** A row is a **complaint record**, **complaint observation**, or **issue record** — never a customer, consumer profile, or person. "Customer" is reserved for the future commercial product operating on a client organization's own authorized data. Language drift is how this boundary would erode first.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| **A "complaint severity score" per record** | An opaque composite invites exactly the misreading this ADR prevents. The product uses transparent policy rules with reason codes instead — a reviewer can see precisely why a record was prioritized |
| **Repeat-complainant detection** | Would require linking records to a person. No identifier exists, and constructing a pseudo-identifier from ZIP, state, and dates would be re-identification by another name |
| **Segmenting by `tags` for "vulnerable population" prioritization** | Well-intentioned and still prohibited. Using a protected-population attribute as a decisioning input is precisely the pattern this ADR forbids, and good intent does not change the mechanism |
| **Scoring companies instead of consumers** | Different failure, equally unsupported. No denominator exists, so any company comparison is undefined. `int_company_issue_patterns` is retained only as bounded context carrying `LIMITED` confidence, never ranked or sorted |

## Consequences

**Accepted:** the product cannot answer "which complainants matter most." It answers "which issues and records need operational attention, and why."

**Enforcement:** `priority` derives only from documented policy rules. Prohibited reason codes are enumerated in `04_decisioning_policy.md` §10. The metric register marks individual customer risk **No** with the note that this is a product boundary, not a data gap — meaning it does not become permissible if the data improves.
