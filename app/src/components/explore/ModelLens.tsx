"use client";

/**
 * Model Lens — the transformation layer, laid over the dashboard.
 *
 * Selecting a model lights the panels it feeds and dims the rest, so the
 * question "where does this number come from" is answered by the layout
 * itself rather than by prose. The metadata comes from the model registry,
 * which mirrors the repo's own dbt headers and schema files; nothing here
 * reads a live catalogue or claims anything about a particular dbt run.
 */

import { MODELS_BY_LAYER } from "@/lib/model-registry";

export function ModelLensRail({
  activeName,
  onSelect,
}: {
  activeName: string | null;
  onSelect: (name: string | null) => void;
}) {
  return (
    <aside className="dpanel dash-rail is-lens" aria-label="Model Lens">
      <div className="dpanel-head">
        <div>
          <h2 className="dpanel-title">Model Lens</h2>
          <p className="dpanel-sub">Select a model to light the panels it feeds</p>
        </div>
        <button type="button" className="lens-exit" onClick={() => onSelect(null)}>
          Close
        </button>
      </div>
      <div className="dpanel-body">
        {MODELS_BY_LAYER.map(({ layer, models }) => (
          <div key={layer} className="lens-group">
            <h3 className="rail-head">{layer}</h3>
            {models.map((m) => {
              const isActive = m.name === activeName;
              return (
                <button
                  key={m.name}
                  type="button"
                  className={`lens-row${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => onSelect(m.name)}
                >
                  <span className="lens-name">{m.displayName}</span>
                  <span className="lens-model">{m.name}</span>
                  <span className="lens-surfaces">
                    {m.surfaces.length > 0
                      ? `Powers ${m.surfaces.length} panel${m.surfaces.length === 1 ? "" : "s"} here`
                      : "Feeds models downstream"}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
