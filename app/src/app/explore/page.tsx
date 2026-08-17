/**
 * Explore — server shell. Loads the curated export once, then hands it to
 * the client workspace so filtering and policy toggles are instant.
 *
 * Accepts ?product= so a link elsewhere can open Explore already scoped.
 */

import { PageHeader } from "@/components/ui/Primitives";
import { ExploreWorkspace } from "@/components/explore/ExploreWorkspace";
import { loadDemoMeta, loadDemoRecords, loadOperationsMetrics } from "@/lib/demo-data";

export const metadata = { title: "Explore" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const [params, meta, metrics, records] = await Promise.all([
    searchParams,
    loadDemoMeta(),
    loadOperationsMetrics(),
    loadDemoRecords(),
  ]);

  return (
    <>
      <PageHeader
        title="Explore the data"
        lede="Pick a measure, a period and a product. Switch decision rules on and off to see which patterns would still reach someone."
      />
      <section className="band section-tight">
        <div className="container-wide">
          <ExploreWorkspace
            metrics={metrics}
            records={records}
            lagDays={meta.publication_lag_window_days}
            initialProduct={params.product}
          />
        </div>
      </section>
    </>
  );
}
