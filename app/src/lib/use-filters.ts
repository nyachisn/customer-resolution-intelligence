"use client";

/**
 * Binds the filter contract to the address bar.
 *
 * Two different write paths, chosen by what the change actually costs:
 *
 * - `history.replaceState` for everything the client can already answer.
 *   Product, period, chart mode and the rule switches all operate on data
 *   the browser is holding, so a Next navigation would round-trip to the
 *   server and re-render the page to produce a view we can compute
 *   instantly. The URL still updates, so the state stays shareable.
 *
 * - `router.replace` when the change needs data the client does not have.
 *   That is exactly one case: opening a record from the illustrative
 *   sample. The full record is loaded server-side by the `item` parameter,
 *   which is what keeps the other 299 off the wire. This path is a real
 *   asynchronous boundary, and the only place a skeleton is honest.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type DashboardFilters,
  filtersToQuery,
  recordRef,
} from "./filters";

export interface FilterController {
  filters: DashboardFilters;
  /** Merge a patch into the current state and publish it to the URL. */
  set: (patch: Partial<DashboardFilters>) => void;
  reset: () => void;
  /** True while a record drawer is waiting on its server round-trip. */
  pending: boolean;
}

export function useDashboardFilters(
  initial: DashboardFilters,
  defaults: DashboardFilters,
): FilterController {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [pending, setPending] = useState(false);

  // The query string this hook last wrote. Anything arriving from the server
  // that differs from it came from outside — back/forward, or a pasted link
  // — and should be adopted. Anything matching it is the server catching up
  // with a write we already made, and must not clobber local state.
  const initialQuery = filtersToQuery(initial);
  const publishedRef = useRef(initialQuery);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (initialQuery !== publishedRef.current) {
      publishedRef.current = initialQuery;
      filtersRef.current = initial;
      setFilters(initial);
    }
    // A server render arriving at all means the round-trip finished, so any
    // record the drawer was waiting on is now in props.
    setPending(false);
  }, [initialQuery, initial]);

  const publish = useCallback(
    (next: DashboardFilters, current: DashboardFilters) => {
      const query = filtersToQuery(next);
      const url = query ? `?${query}` : window.location.pathname;

      publishedRef.current = query;

      // Only a change in *which* record is open needs the server.
      if (recordRef(next.item) !== recordRef(current.item)) {
        setPending(true);
        router.replace(url, { scroll: false });
        return;
      }

      window.history.replaceState(null, "", url);
    },
    [router],
  );

  // `set` reads current state from filtersRef rather than a functional
  // update: publishing to history inside a setState updater would fire twice
  // under StrictMode's double invocation.
  const apply = useCallback(
    (next: DashboardFilters) => {
      const current = filtersRef.current;
      if (filtersToQuery(next) === filtersToQuery(current)) return;
      filtersRef.current = next;
      setFilters(next);
      publish(next, current);
    },
    [publish],
  );

  const set = useCallback(
    (patch: Partial<DashboardFilters>) => apply({ ...filtersRef.current, ...patch }),
    [apply],
  );

  const reset = useCallback(() => apply(defaults), [apply, defaults]);

  return { filters, set, reset, pending };
}
