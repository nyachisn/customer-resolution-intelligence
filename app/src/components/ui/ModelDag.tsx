"use client";

/**
 * The dbt DAG, drawn from the project's own ref() calls.
 *
 * Laid out on longest-path depth, so every edge points left to right and the
 * column a model sits in is the order dbt builds it. Edges are cubic curves
 * rather than straight lines because several models depend on something two
 * or three columns back, and straight lines through intervening nodes are
 * unreadable.
 *
 * Hovering a model raises its own edges and dims the rest, which is the only
 * way a 13-node graph with 17 edges stays legible.
 */

import { useMemo, useState } from "react";
import { DAG, type DagNode, dagDepths } from "@/lib/pipeline";

// Model names run to 31 characters, and at the interface's 1rem floor that
// needs ~300px on one line — which would make the graph 3,000px wide. The
// name wraps to two lines instead and the node grows in height.
const NODE_W = 210;
const NODE_H = 66;
const COL_GAP = 66;
const ROW_GAP = 16;
const PAD = 16;

const LAYER_CLASS: Record<DagNode["layer"], string> = {
  staging: "is-staging",
  intermediate: "is-intermediate",
  mart: "is-mart",
};

export function ModelDag() {
  const [active, setActive] = useState<string | null>(null);

  const layout = useMemo(() => {
    const depths = dagDepths(DAG);
    const columns = new Map<number, DagNode[]>();
    for (const node of DAG) {
      const d = depths.get(node.name) ?? 0;
      const col = columns.get(d) ?? [];
      col.push(node);
      columns.set(d, col);
    }

    const positions = new Map<string, { x: number; y: number }>();
    const maxRows = Math.max(...[...columns.values()].map((c) => c.length));
    const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;

    for (const [depth, nodes] of columns) {
      const colHeight = nodes.length * NODE_H + (nodes.length - 1) * ROW_GAP;
      const top = (height - colHeight) / 2;
      nodes.forEach((node, i) => {
        positions.set(node.name, {
          x: PAD + depth * (NODE_W + COL_GAP),
          y: top + i * (NODE_H + ROW_GAP),
        });
      });
    }

    const width = PAD * 2 + (columns.size - 1) * (NODE_W + COL_GAP) + NODE_W;

    const edges: { from: string; to: string; d: string }[] = [];
    for (const node of DAG) {
      const to = positions.get(node.name);
      if (!to) continue;
      for (const dep of node.deps) {
        const from = positions.get(dep);
        if (!from) continue;
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mid = (x2 - x1) / 2;
        edges.push({
          from: dep,
          to: node.name,
          d: `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`,
        });
      }
    }

    return { positions, edges, width, height };
  }, []);

  return (
    <div className="dag-scroll">
      <div className="dag" style={{ width: layout.width, height: layout.height }}>
        <svg
          className="dag-edges"
          width={layout.width}
          height={layout.height}
          aria-hidden="true"
        >
          {layout.edges.map((e) => {
            const lit = active === e.from || active === e.to;
            return (
              <path
                key={`${e.from}->${e.to}`}
                d={e.d}
                className={`dag-edge${active ? (lit ? " is-lit" : " is-muted") : ""}`}
              />
            );
          })}
        </svg>

        {DAG.map((node) => {
          const pos = layout.positions.get(node.name);
          if (!pos) return null;
          const related =
            active === node.name ||
            node.deps.includes(active ?? "") ||
            DAG.find((n) => n.name === active)?.deps.includes(node.name);
          return (
            <div
              key={node.name}
              className={`dag-node ${LAYER_CLASS[node.layer]}${
                active ? (related ? " is-lit" : " is-muted") : ""
              }`}
              style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
              onMouseEnter={() => setActive(node.name)}
              onMouseLeave={() => setActive(null)}
              tabIndex={0}
              onFocus={() => setActive(node.name)}
              onBlur={() => setActive(null)}
            >
              <span className="dag-name">{node.name}</span>
              <span className="dag-meta">
                {node.materialized === "table"
                  ? `table · ${node.rows?.toLocaleString() ?? "—"} rows`
                  : "view"}
              </span>
              <span className="dag-tip" role="tooltip">
                {node.role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
