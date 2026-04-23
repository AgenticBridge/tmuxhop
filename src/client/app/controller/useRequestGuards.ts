/**
 * PaneHop controller request guards.
 *
 * Purpose: provide mounted-state tracking, in-flight request sequencing, and a
 * single async error path for controller tasks.
 *
 * Boundary: client-only. This hook is a controller utility and should stay
 * independent from presentational concerns.
 */
import { useEffect, useRef } from "react";

import type { StatusTone } from "../ui.js";

export interface UseRequestGuardsOptions {
  onStatusChange(label: string, tone?: StatusTone): void;
}

export interface UseRequestGuardsResult {
  beginRequestRevision(): number;
  invalidateRequests(): void;
  isCurrentRequestRevision(revision: number): boolean;
  isMounted(): boolean;
  reportAsyncError(error: unknown, label?: string): void;
  runTask(task: () => Promise<void>): void;
}

export function useRequestGuards(options: UseRequestGuardsOptions): UseRequestGuardsResult {
  const { onStatusChange } = options;

  const mountedRef = useRef(true);
  const requestRevisionRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestRevisionRef.current += 1;
    };
  }, []);

  function beginRequestRevision(): number {
    requestRevisionRef.current += 1;
    return requestRevisionRef.current;
  }

  function invalidateRequests() {
    requestRevisionRef.current += 1;
  }

  function isCurrentRequestRevision(revision: number): boolean {
    return mountedRef.current && requestRevisionRef.current === revision;
  }

  function isMounted() {
    return mountedRef.current;
  }

  function reportAsyncError(error: unknown, label = "Error") {
    console.error(error);
    if (!mountedRef.current) {
      return;
    }
    onStatusChange(label, "error");
  }

  function runTask(task: () => Promise<void>) {
    void task().catch((error) => {
      reportAsyncError(error);
    });
  }

  return {
    beginRequestRevision,
    invalidateRequests,
    isCurrentRequestRevision,
    isMounted,
    reportAsyncError,
    runTask,
  };
}
