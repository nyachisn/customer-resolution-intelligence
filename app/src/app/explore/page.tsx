/**
 * Explore — server shell.
 *
 * Loads the archive explorer (month x product across the full published
 * history), the sample list projection, and — only when `item` names one —
 * a single full record. That last read is the workspace's one asynchronous
 * boundary and the only place a skeleton is honest.
 */

import { ExploreWorkspace } from "@/components/explore/ExploreWorkspace";
import { parseFilters, recordRef } from "@/lib/filters";
import {
  loadArchiveExplorer,
  loadFocusedMonth,
  loadSampleRecord,
  loadSampleRecordIndex,
} from "@/lib/demo-data";
import { familyById } from "@/lib/product-families";

export const metadata = { title: "Explore" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const openRecordId = recordRef(filters.item);

  // The month x issue grid is reduced here, not shipped: only the focused
  // month's breakdown crosses to the client, and only when one is pinned.
  const family = familyById(filters.family);
  const [archive, sampleIndex, sampleRecord, focusedMonth] = await Promise.all([
    loadArchiveExplorer(),
    loadSampleRecordIndex(),
    openRecordId ? loadSampleRecord(openRecordId) : Promise.resolve(null),
    filters.focus ? loadFocusedMonth(filters.focus, family?.members ?? null) : Promise.resolve(null),
  ]);

  return (
    <ExploreWorkspace
      initialFilters={filters}
      archive={archive}
      sampleIndex={sampleIndex}
      sampleRecord={sampleRecord}
      focusedMonth={focusedMonth}
    />
  );
}
