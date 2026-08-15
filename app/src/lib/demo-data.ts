/**
 * Loader for the curated demo export.
 *
 * The browser never connects to Snowflake. This module reads the versioned
 * export produced by scripts/export_demo_data.py.
 * See docs/05_architecture.md §7.
 *
 * STATUS: NOT IMPLEMENTED. Phase 0 scaffold.
 */

import type { ComplaintRecordContext, DemoExportMeta } from "./types";

export async function loadDemoRecords(): Promise<ComplaintRecordContext[]> {
  throw new Error("Demo export not wired yet (Phase 0 scaffold).");
}

export async function loadDemoMeta(): Promise<DemoExportMeta> {
  throw new Error("Demo export not wired yet (Phase 0 scaffold).");
}
