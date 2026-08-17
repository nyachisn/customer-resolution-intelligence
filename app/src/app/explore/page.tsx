/**
 * Explore — server shell. Loads the curated export once, then hands it to
 * the client workspace so filtering and policy toggles are instant.
 *
 * No page header here: the workspace is a fixed-height dashboard that fills
 * the viewport, so every pixel above it is taken from the charts.
 *
 * Accepts ?product= so a link elsewhere can open Explore already scoped.
 */

import { ExploreWorkspace } from "@/components/explore/ExploreWorkspace";
import {
  loadDemoMeta,
  loadDemoRecords,
  loadLedgerExhibits,
  loadOperationsMetrics,
} from "@/lib/demo-data";

export const metadata = { title: "Explore" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const [params, meta, metrics, records, ledger] = await Promise.all([
    searchParams,
    loadDemoMeta(),
    loadOperationsMetrics(),
    loadDemoRecords(),
    loadLedgerExhibits(),
  ]);

  return (
    <ExploreWorkspace
      metrics={metrics}
      records={records}
      ledger={ledger}
      lagDays={meta.publication_lag_window_days}
      initialProduct={params.product}
    />
  );
}
