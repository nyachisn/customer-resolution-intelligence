/**
 * Explore — server shell. Loads the curated export once, then hands it to
 * the client workspace so filtering is instant.
 *
 * Accepts ?product= and ?metric= so an insight can open Explore with its
 * own context already applied.
 */

import { PageHeader } from "@/components/ui/Primitives";
import { ExploreWorkspace } from "@/components/explore/ExploreWorkspace";
import { loadDemoMeta, loadOperationsMetrics } from "@/lib/demo-data";

export const metadata = { title: "Explore" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; metric?: string }>;
}) {
  const [params, meta, metrics] = await Promise.all([
    searchParams,
    loadDemoMeta(),
    loadOperationsMetrics(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title="Answer your own question"
        lede="Filter by measure, period and product. Compare against the prior period and drill into whatever you find."
      />
      <section className="band section-tight">
        <div className="container">
          <ExploreWorkspace
            metrics={metrics}
            lagDays={meta.publication_lag_window_days}
            initialProduct={params.product}
            initialMetric={params.metric}
          />
        </div>
      </section>
    </>
  );
}
