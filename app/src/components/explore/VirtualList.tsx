"use client";

/**
 * A fixed-row-height windowed list.
 *
 * The illustrative sample is 300 rows and every rule switch re-filters it,
 * so mounting the whole list means re-reconciling hundreds of nodes on a
 * toggle. Rendering only the visible slice plus a small overscan keeps that
 * to a couple of dozen, and the spacer divs preserve the true scroll height
 * so the scrollbar still tells the truth about how much is there.
 *
 * Rows must be exactly `rowHeight` tall — the arithmetic has no way to
 * discover a taller one, and a row that overflows would drift out of
 * alignment with its scroll position.
 */

import { useEffect, useRef, useState } from "react";

const OVERSCAN = 6;

export function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  keyFor,
  className,
}: {
  items: T[];
  rowHeight: number;
  renderRow: (item: T) => React.ReactNode;
  keyFor: (item: T) => string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setViewport(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const count = Math.ceil((viewport || rowHeight * 8) / rowHeight) + OVERSCAN * 2;
  const end = Math.min(items.length, start + count);
  const slice = items.slice(start, end);

  return (
    <div
      ref={ref}
      className={className}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: start * rowHeight }} aria-hidden="true" />
      {slice.map((item) => (
        <div key={keyFor(item)} style={{ height: rowHeight }}>
          {renderRow(item)}
        </div>
      ))}
      <div style={{ height: (items.length - end) * rowHeight }} aria-hidden="true" />
    </div>
  );
}
