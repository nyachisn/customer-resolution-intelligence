/**
 * Product lineages across the CFPB's taxonomy changes.
 *
 * The archive spans 2011-12 to 2026-07 and the CFPB renamed its product
 * categories twice — April 2017 and August 2023. Plotted on raw labels, a
 * 15-year per-product chart shows almost every category dying and a new one
 * being born on those two dates. Credit reporting alone appears as three
 * unrelated products:
 *
 *   "Credit reporting"                                    2012-10 → 2017-04
 *   "Credit reporting, credit repair services, or other
 *    personal consumer reports"                           2017-04 → 2023-08
 *   "Credit reporting or other personal consumer reports"  2023-08 → 2026-08
 *
 * Grouping them into families is what makes a long series readable. It is
 * also an interpretation, so it lives here — in the application, visible and
 * editable — rather than being baked into the warehouse. The export stays a
 * faithful aggregate of the published labels.
 *
 * Where a rename was not a clean one-to-one, the note says so, and the UI
 * surfaces that note rather than hiding the seam:
 *
 * - Cards were split (2011), merged (2017), and split again (2023). A
 *   continuous card series necessarily includes prepaid.
 * - "Consumer Loan" was broken up in 2017 across vehicle, personal and
 *   other lending. Attributing all of it to vehicle would overstate that
 *   family before 2017.
 */

export interface ProductFamily {
  id: string;
  /** How the family is named in the interface. */
  label: string;
  /** Every published label that rolls up into it. */
  members: string[];
  /** Stated in the UI whenever the family is not a clean rename chain. */
  note?: string;
}

export const PRODUCT_FAMILIES: ProductFamily[] = [
  {
    id: "credit-reporting",
    label: "Credit reporting",
    members: [
      "Credit reporting",
      "Credit reporting, credit repair services, or other personal consumer reports",
      "Credit reporting or other personal consumer reports",
    ],
  },
  {
    id: "debt-collection",
    label: "Debt collection",
    members: ["Debt collection"],
  },
  {
    id: "mortgage",
    label: "Mortgage",
    members: ["Mortgage"],
  },
  {
    id: "bank-account",
    label: "Checking and savings",
    members: ["Bank account or service", "Checking or savings account"],
  },
  {
    id: "cards",
    label: "Credit and prepaid cards",
    members: ["Credit card", "Credit card or prepaid card", "Prepaid card"],
    note:
      "Cards were reported separately before 2017, merged into one category from 2017 to 2023, then split again. A continuous series has to include prepaid throughout.",
  },
  {
    id: "student-loan",
    label: "Student loan",
    members: ["Student loan"],
  },
  {
    id: "vehicle-consumer-loan",
    label: "Vehicle and consumer loans",
    members: ["Consumer Loan", "Vehicle loan or lease"],
    note:
      "\"Consumer Loan\" was broken up in 2017 across vehicle, personal and other lending. It is kept here because vehicle took the largest share, so the pre-2017 portion of this family is broader than the label suggests.",
  },
  {
    id: "payday-personal-loan",
    label: "Payday and personal loans",
    members: [
      "Payday loan",
      "Payday loan, title loan, or personal loan",
      "Payday loan, title loan, personal loan, or advance loan",
    ],
  },
  {
    id: "money-transfer",
    label: "Money transfer and virtual currency",
    members: ["Money transfers", "Virtual currency", "Money transfer, virtual currency, or money service"],
  },
  {
    id: "debt-credit-management",
    label: "Debt or credit management",
    members: ["Debt or credit management"],
    note: "Introduced in the August 2023 taxonomy. It has no earlier history to compare against.",
  },
  {
    id: "other-financial-service",
    label: "Other financial service",
    members: ["Other financial service"],
    note: "Retired in the April 2017 taxonomy. It has no later history.",
  },
];

/**
 * The two dates the CFPB changed its category names.
 *
 * Marked on every long series rather than smoothed over: a step at one of
 * these dates may be a renaming rather than a change in complaints.
 */
export const TAXONOMY_CHANGES = [
  { month: "2017-04", label: "CFPB renamed categories" },
  { month: "2023-08", label: "CFPB renamed categories" },
];

const BY_MEMBER = new Map<string, ProductFamily>();
for (const family of PRODUCT_FAMILIES) {
  for (const member of family.members) BY_MEMBER.set(member, family);
}

/**
 * The family a published label belongs to.
 *
 * A label absent from the map returns null rather than being silently
 * dropped or bucketed into "other" — a new CFPB category should show up as
 * a gap to fix, not disappear into a total.
 */
export function familyFor(product: string): ProductFamily | null {
  return BY_MEMBER.get(product) ?? null;
}

export function familyById(id: string | null): ProductFamily | null {
  if (!id) return null;
  return PRODUCT_FAMILIES.find((f) => f.id === id) ?? null;
}
