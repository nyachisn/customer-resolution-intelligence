/**
 * The six-stage pipeline, drawn as components rather than an image.
 *
 * Stage colour separates one stage from the next and encodes nothing else —
 * it is not a status, a severity, or a data value. The transform stage is
 * deliberately the tallest: its four layers are where most of the work
 * happens, and the reference layout gives it the same weight.
 */

import type { Stage } from "@/lib/pipeline";
import { STAGES } from "@/lib/pipeline";
import { CfpbMark, DbtMark, NextMark, SnowflakeMark } from "./TechMarks";

const STAGE_MARK: Record<string, React.ReactNode> = {
  source: <CfpbMark />,
  ingest: <SnowflakeMark />,
  transform: <DbtMark />,
  analytics: <SnowflakeMark />,
  export: <NextMark />,
  experience: <NextMark />,
};

function StageCard({ stage }: { stage: Stage }) {
  return (
    <article className={`ps-card is-${stage.tone}`}>
      <header className="ps-head">
        <span className="ps-index">{stage.index}</span>
        <span className="ps-mark" aria-hidden="true">
          {STAGE_MARK[stage.id]}
        </span>
      </header>

      <h3 className="ps-name">{stage.name}</h3>
      <p className="ps-system">{stage.system}</p>
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
            <div className="ps-block" key={block.name}>
              <span className="ps-block-name">{block.name}</span>
              <span className="ps-block-detail">{block.detail}</span>
            </div>
          ))}
        </div>
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
            {i < STAGES.length - 1 && <span className="ps-arrow" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
