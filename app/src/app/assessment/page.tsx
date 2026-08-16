/**
 * Request a Resolution Assessment. Requirements:
 * docs/01_product_requirements.md §4.1, §4.2, §12 (build plan).
 *
 * No backend endpoint exists yet (CONTACT_FORM_ENDPOINT is unset in this
 * environment). Rather than silently posting to nowhere, submission is
 * handled client-side only with an honest confirmation state — the form is
 * real UI, not a real intake pipeline yet. See docs/05_architecture.md §7:
 * the app must never expose credentials or a working destination it does
 * not actually have.
 */

import { AssessmentForm } from "./AssessmentForm";

export const metadata = { title: "Request a Resolution Assessment — Customer Resolution Intelligence" };

export default function AssessmentPage() {
  return (
    <div>
      <h1>Request a Resolution Assessment</h1>
      <p>
        A discovery conversation about your own authorized customer-issue
        data — not a product purchase, and not a production integration.
      </p>
      <div className="disclosure-banner" role="note">
        <strong>Do not submit personal data, credentials, or production
        data</strong> through this form. This is a portfolio prototype.
      </div>
      <AssessmentForm />
    </div>
  );
}
