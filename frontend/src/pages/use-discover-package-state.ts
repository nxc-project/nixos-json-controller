import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { AppState } from "@/lib/app-state";
import { takePackageStateBatch } from "./discover-package-state-queue";

type UseDiscoverPackageStateOptions = {
  active: boolean;
  states: Record<string, AppState>;
  refreshPackages: (packageNames: string[]) => Promise<void>;
};

/**
 * Queue visible package-state lookups separately from Discover's search state.
 * Requests are debounced and batched to avoid one native call per visible card.
 */
export function useDiscoverPackageState({
  active,
  states,
  refreshPackages,
}: UseDiscoverPackageStateOptions) {
  const isActiveRef = useRef(active);
  const requestedStateIdsRef = useRef(new Set<string>());
  const pendingStateIdsRef = useRef(new Set<string>());
  const stateRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const stateRefreshInFlightRef = useRef(false);

  useLayoutEffect(() => {
    isActiveRef.current = active;
  }, [active]);

  const resetQueuedPackageStates = useCallback(() => {
    requestedStateIdsRef.current.clear();
    pendingStateIdsRef.current.clear();
    if (stateRefreshTimerRef.current !== null) {
      clearTimeout(stateRefreshTimerRef.current);
      stateRefreshTimerRef.current = null;
    }
  }, []);

  const dispatchQueuedPackageStates = useCallback(() => {
    const scheduleNextBatch = () => {
      if (
        !isActiveRef.current ||
        pendingStateIdsRef.current.size === 0 ||
        stateRefreshTimerRef.current !== null ||
        stateRefreshInFlightRef.current
      ) {
        return;
      }

      stateRefreshTimerRef.current = setTimeout(() => {
        stateRefreshTimerRef.current = null;
        if (!isActiveRef.current) return;
        const batch = takePackageStateBatch(pendingStateIdsRef.current);
        stateRefreshInFlightRef.current = true;
        void refreshPackages(batch).finally(() => {
          for (const packageName of batch) {
            // Preserve the marker when a newer viewport has already queued the same ID.
            if (!pendingStateIdsRef.current.has(packageName)) {
              requestedStateIdsRef.current.delete(packageName);
            }
          }
          stateRefreshInFlightRef.current = false;
          scheduleNextBatch();
        });
      }, 120);
    };

    scheduleNextBatch();
  }, [refreshPackages]);

  const requestVisiblePackageStates = useCallback(
    (packageNames: string[]) => {
      if (!isActiveRef.current) return;
      for (const packageName of packageNames) {
        if (
          states[packageName] !== undefined ||
          requestedStateIdsRef.current.has(packageName)
        ) {
          continue;
        }
        requestedStateIdsRef.current.add(packageName);
        pendingStateIdsRef.current.add(packageName);
      }
      dispatchQueuedPackageStates();
    },
    [dispatchQueuedPackageStates, states],
  );

  useEffect(() => {
    if (active) return;

    // An in-flight native request cannot be cancelled here, but it must not
    // schedule another batch after Discover becomes hidden.
    pendingStateIdsRef.current.clear();
    requestedStateIdsRef.current.clear();
    if (stateRefreshTimerRef.current !== null) {
      clearTimeout(stateRefreshTimerRef.current);
      stateRefreshTimerRef.current = null;
    }
  }, [active]);

  useEffect(
    () => () => {
      if (stateRefreshTimerRef.current !== null) {
        clearTimeout(stateRefreshTimerRef.current);
        stateRefreshTimerRef.current = null;
      }
      pendingStateIdsRef.current.clear();
    },
    [],
  );

  return { resetQueuedPackageStates, requestVisiblePackageStates };
}
