"use client";

/**
 * Client-side form handling. Collects only: name, work email, company,
 * role, customer-resolution challenge — per docs/01_product_requirements.md.
 * Prohibits customer data, credentials, production information, PII beyond
 * basic business contact fields — enforced by not collecting fields for
 * them in the first place, not by a filter after the fact.
 *
 * No CONTACT_FORM_ENDPOINT is configured in this environment, so submission
 * does not send data anywhere — it is a local, honest confirmation state.
 * Wire this to a real endpoint (via the env var, never a hard-coded URL)
 * before this form collects real prospect data.
 */

import { useState, type FormEvent } from "react";

export function AssessmentForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Intentionally not sent anywhere yet. See file header.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="card" role="status">
        <p>
          Thanks. We&apos;ll use an initial conversation to understand your
          customer-resolution workflow. No production access or customer
          data is required for an initial assessment.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" required autoComplete="name" />

      <label htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />

      <label htmlFor="company">Company</label>
      <input id="company" name="company" type="text" required autoComplete="organization" />

      <label htmlFor="role">Role</label>
      <input id="role" name="role" type="text" required autoComplete="organization-title" />

      <label htmlFor="challenge">Customer-resolution challenge</label>
      <textarea id="challenge" name="challenge" rows={4} required />

      <button type="submit" className="btn" style={{ marginTop: "1.25rem" }}>
        Request assessment
      </button>
    </form>
  );
}
