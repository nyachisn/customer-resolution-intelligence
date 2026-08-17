/**
 * Explore — server shell.
 *
 * Reads the filter contract out of the query string and loads exactly what
 * that state needs. Three deliberate payload decisions live here:
 *
 * 1. The metric bundle is pivoted server-side. The raw 15,023-row export
 *    never reaches the browser; the aligned series do, at roughly a
 *    fortieth of the size.
 * 2. The record sample crosses the wire as a list projection — id, product,
 *    issue and the fields the rules filter on. The rest of each record
 *    stays on the server.
 * 3. Exactly one full record is loaded, and only when `item` names it. That
 *    is the single asynchronous boundary in the workspace, and the only
 *    place a skeleton is honest.
 *
 * No page header: the workspace is a fixed-height dashboard that fills the
 * viewport, so every pixel above it is taken from the charts.
 */

import { ExploreWorkspace } from "@/components/explore/ExploreWorkspace";
import { parseFilters, recordRef } from "@/lib/filters";
import {
  loadDemoMeta,
  loadLedgerExhibits,
  loadMetricBundle,
  loadSampleRecord,
  loadSampleRecordIndex,
} from "@/lib/demo-data";

export const metadata = { title: "Explore" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const openRecordId = recordRef(filters.item);

  const [meta, bundle, ledger, sampleIndex, sampleRecord] = await Promise.all([
    loadDemoMeta(),
    loadMetricBundle(),
    loadLedgerExhibits(),
    loadSampleRecordIndex(),
    openRecordId ? loadSampleRecord(openRecordId) : Promise.resolve(null),
  ]);

  return (
    <ExploreWorkspace
      initialFilters={filters}
      bundle={bundle}
      ledger={ledger}
      sampleIndex={sampleIndex}
      sampleRecord={sampleRecord}
      lagDays={meta.publication_lag_window_days}
    />
  );
}
