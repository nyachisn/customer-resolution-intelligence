"use client";

/**
 * The right-side drawer. Two kinds of subject, one shell.
 *
 * Record evidence is scoped to a single record from the illustrative
 * sample. Every field shown is that record's own — a source value or a
 * value the policy layer derived for it — and the footer states the sample
 * boundary, because a reader who has drilled this far is the reader most
 * likely to mistake one record for a population.
 *
 * Model detail is read from the model registry, which mirrors the repo's
 * own dbt documentation. It claims no runtime lineage or run state.
 */

import { useEffect, useRef } from "react";
import { Chip, ConfidenceChip, PriorityChip } from "@/components/ui/Primitives";
import type { ComplaintRecordContext } from "@/lib/types";
import type { ModelEntry, SurfaceId } from "@/lib/model-registry";
import { SURFACE_LABELS } from "@/lib/model-registry";
import { explainReasons, formatDate, formatPct, nextStepFor, titleize } from "@/lib/analytics";

const POLICY_SHORT: Record<string, string> = {
  POLICY_UNTIMELY_RESPONSE: "Untimely response",
  POLICY_EMERGING_ISSUE: "Emerging issue",
  POLICY_PUBLICATION_LAG: "Publication lag",
  POLICY_INCOMPLETE_CONTEXT: "Incomplete context",
  POLICY_CRITICAL_COMBINATION: "Critical combination",
  POLICY_STABLE_PATTERN: "Stable pattern",
};

function Shell({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-label={title}>
      <div className="drawer-head">
        <div>
          <p className="drawer-eyebrow">{eyebrow}</p>
          <h2 className="drawer-title">{title}</h2>
        </div>
        <button ref={closeRef} type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="drawer-body">{children}</div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="drawer-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function RecordDrawerSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="Loading record" eyebrow="Illustrative record context" onClose={onClose}>
      <div className="skeleton-stack" aria-live="polite" aria-busy="true">
        <span className="skeleton is-line" style={{ width: "70%" }} />
        <span className="skeleton is-line" style={{ width: "45%" }} />
        <span className="skeleton is-block" />
        <span className="skeleton is-line" style={{ width: "60%" }} />
        <span className="skeleton is-line" style={{ width: "80%" }} />
      </div>
    </Shell>
  );
}

export function RecordDrawer({
  record,
  onClose,
}: {
  record: ComplaintRecordContext;
  onClose: () => void;
}) {
  return (
    <Shell title={record.issue} eyebrow="Illustrative record context" onClose={onClose}>
      <div className="drawer-chips">
        <PriorityChip priority={record.priority} />
        <ConfidenceChip confidence={record.signalConfidence} />
        <Chip>{titleize(record.issuePatternStatus)}</Chip>
      </div>

      <dl className="drawer-fields">
        <Field label="Product">{record.product}</Field>
        {record.subProduct && <Field label="Sub-product">{record.subProduct}</Field>}
        {record.subIssue && <Field label="Sub-issue">{record.subIssue}</Field>}
        <Field label="Recommended action">{nextStepFor(record.recommendedAction)}</Field>
      </dl>

      <h3 className="drawer-section">Evidence values</h3>
      <dl className="drawer-fields is-numeric">
        <Field label="Pattern volume, current window">
          {record.issueVolumeCurrent.toLocaleString()}
        </Field>
        <Field label="Baseline volume">{Math.round(record.baselineVolume).toLocaleString()}</Field>
        <Field label="Change against baseline">
          {formatPct(record.volumeChangePct, { signed: true })}
        </Field>
        <Field label="Observed share of window">{formatPct(record.observedSharePct)}</Field>
      </dl>

      <h3 className="drawer-section">Why it qualified</h3>
      <div className="drawer-chips">
        {record.policyIds.length > 0 ? (
          record.policyIds.map((p) => (
            <Chip key={p} tone="accent">
              {POLICY_SHORT[p] ?? titleize(p)}
            </Chip>
          ))
        ) : (
          <Chip>No policy triggered</Chip>
        )}
      </div>
      <p className="drawer-prose">{explainReasons(record.reasonCodes)}</p>
      {record.reasonCodes.length > 0 && (
        <p className="drawer-codes">
          Reason codes: {record.reasonCodes.join(", ")}
        </p>
      )}

      <h3 className="drawer-section">Published context</h3>
      <dl className="drawer-fields">
        <Field label="Received">{formatDate(record.complaintReceivedDate)}</Field>
        <Field label="Submitted via">{record.submittedVia}</Field>
        <Field label="Company response">{record.companyResponse}</Field>
        <Field label="Timeliness (published assessment)">{record.timelyResponseStatus}</Field>
        <Field label="Data completeness">{titleize(record.dataCompletenessStatus)}</Field>
      </dl>

      {record.interpretationLimitation && (
        <p className="drawer-limit">
          <strong>Interpretation limit:</strong> {record.interpretationLimitation}
        </p>
      )}

      <p className="drawer-scope">
        One record from a stratified 300-row demonstration sample, drawn to cover every
        decisioning outcome so rare ones stay visible. It is not representative of the
        17.1M-record archive and nothing on this dashboard is counted from it.
      </p>
    </Shell>
  );
}

export function ModelDrawer({
  model,
  onClose,
}: {
  model: ModelEntry;
  onClose: () => void;
}) {
  return (
    <Shell title={model.displayName} eyebrow={`${model.layer} model`} onClose={onClose}>
      <p className="drawer-model-name">{model.name}</p>

      <h3 className="drawer-section">Grain</h3>
      <p className="drawer-prose">{model.grain}</p>

      <h3 className="drawer-section">What it does</h3>
      <p className="drawer-prose">{model.purpose}</p>

      <h3 className="drawer-section">Main outputs</h3>
      <p className="drawer-prose">{model.outputs}</p>

      <h3 className="drawer-section">Known limitations</h3>
      <p className="drawer-prose">{model.limitations}</p>

      <h3 className="drawer-section">What it powers here</h3>
      {model.surfaces.length > 0 ? (
        <ul className="drawer-surfaces">
          {model.surfaces.map((s: SurfaceId) => (
            <li key={s}>{SURFACE_LABELS[s]}</li>
          ))}
        </ul>
      ) : (
        <p className="drawer-prose">
          Nothing on this screen directly. It feeds models further down the chain rather
          than a panel of its own.
        </p>
      )}

      <p className="drawer-scope">
        Transcribed from this project&rsquo;s own model headers and schema files. It
        describes how the transformation layer is written, not the state of any
        particular dbt run.
      </p>
    </Shell>
  );
}
