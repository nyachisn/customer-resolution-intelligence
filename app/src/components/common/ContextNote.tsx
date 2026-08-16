/**
 * Required context notes. See docs/02_data_provenance.md §9 — every
 * aggregate trend view must carry this disclosure verbatim.
 */

export function VolumeContextNote() {
  return (
    <p className="context-note">
      Published complaint volume is an observed count of complaints that met
      CFPB publication criteria. It is not a statistical sample of all
      consumer experiences, and it should be interpreted with relevant
      context, including company size, market share, geography, and
      reporting conditions. A change in complaint volume reflects a change in
      what was reported and published — not a measured change in customer
      experience, and not evidence of an incident.
    </p>
  );
}

export function ConcentrationContextNote() {
  return (
    <p className="context-note">
      Complaint volume in this dataset is highly concentrated: credit-
      reporting categories account for roughly 81% of all published records.
      Volume in these categories is materially affected by third-party
      submission behavior. The CFPB has stated it &quot;cannot rely upon the
      consumer complaint portal data as a reliable reflection of actual
      market conditions&quot; absent announced corrections.
    </p>
  );
}

export function PublicationLagContextNote() {
  return (
    <p className="context-note">
      Recently received complaints may be published before the company&apos;s
      response is recorded. Response-status distributions over recent windows
      are directional only and must not be read as company performance.
    </p>
  );
}

export function PrototypeDisclosure() {
  return (
    <div className="disclosure-banner" role="note">
      This is an independent portfolio prototype using publicly available
      CFPB Consumer Complaint Database data. It does not identify or contact
      consumers, make financial decisions, determine complaint outcomes, or
      represent an integration with CFPB, financial institutions, or Twilio.
    </div>
  );
}
