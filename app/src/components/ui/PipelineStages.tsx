/**
 * The six-stage pipeline, drawn as components.
 *
 * Each stage leads with its vendor mark on a solid tile rather than a
 * coloured rule, so the cards stay white and the colour lives in one place.
 * The transform stage carries its four layers, and each layer reveals the
 * models it actually contains on hover — the same names the DAG below uses.
 */

import type { Stage } from "@/lib/pipeline";
import { STAGES } from "@/lib/pipeline";
import {
  BrandLockup,
  CfpbMark,
  DbtMark,
  NextMark,
  SnowflakeMark,
  StreamlitMark,
  VercelMark,
} from "./TechMarks";

const STAGE_BRAND: Record<string, { mark: React.ReactNode; name: string }> = {
  source: { mark: <CfpbMark />, name: "CFPB" },
  ingest: { mark: <SnowflakeMark />, name: "Snowflake" },
  transform: { mark: <DbtMark />, name: "dbt" },
  analytics: { mark: <SnowflakeMark />, name: "Snowflake" },
  export: { mark: <NextMark />, name: "Next.js" },
  experience: { mark: <VercelMark />, name: "Vercel" },
};

function StageCard({ stage }: { stage: Stage }) {
  const brand = STAGE_BRAND[stage.id];
  return (
    <article className="ps-card">
      <BrandLockup mark={brand.mark} name={brand.name} />

      <h3 className="ps-name">{stage.name}</h3>
      <p className="ps-summary">{stage.summary}</p>

      {stage.items.length > 0 && (
        <ul className="ps-items">
          {stage.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      {stage.blocks && (
        <div className="ps-blocks">
          {stage.blocks.map((block) => (
            <div className={`ps-block${block.models ? " has-models" : ""}`} key={block.name}>
              <span className="ps-block-name">{block.name}</span>
              <span className="ps-block-detail">{block.detail}</span>
              {block.models && (
                <span className="ps-block-models">
                  {block.models.map((m) => (
                    <code key={m}>{m}</code>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {stage.id === "experience" && (
        <span className="ps-second-brand">
          <BrandLockup mark={<StreamlitMark />} name="Streamlit" />
        </span>
      )}
    </article>
  );
}

export function PipelineStages() {
  return (
    <div className="ps-scroll">
      <ol className="ps-rail">
        {STAGES.map((stage, i) => (
          <li className="ps-slot" key={stage.id}>
            <StageCard stage={stage} />
            {i < STAGES.length - 1 && (
              <span className="ps-arrow" aria-hidden="true">
                <svg viewBox="0 0 34 12" width="34" height="12">
                  <path d="M0 6 H26" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M25 1.5 L32 6 L25 10.5 Z" fill="currentColor" />
                </svg>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
