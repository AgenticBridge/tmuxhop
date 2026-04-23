// @vitest-environment jsdom
/**
 * tmuxhop request guard tests.
 *
 * Purpose: verify mounted-state protection, request invalidation, and shared
 * async error handling used by the client controller layer.
 *
 * Boundary: client controller coverage only.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRequestGuards } from "../src/client/app/controller/useRequestGuards.js";

describe("useRequestGuards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes async task failures into the shared error status", async () => {
    const onStatusChange = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useRequestGuards({ onStatusChange }));

    await act(async () => {
      result.current.runTask(async () => {
        throw new Error("boom");
      });
      await Promise.resolve();
    });

    expect(consoleError).toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenCalledWith("Error", "error");
  });

  it("invalidates older request revisions", () => {
    const { result } = renderHook(() =>
      useRequestGuards({
        onStatusChange: vi.fn(),
      }),
    );

    const first = result.current.beginRequestRevision();
    result.current.invalidateRequests();

    expect(result.current.isCurrentRequestRevision(first)).toBe(false);
  });

  it("stops reporting errors after unmount", () => {
    const onStatusChange = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useRequestGuards({ onStatusChange }));

    unmount();
    result.current.reportAsyncError(new Error("late"));

    expect(consoleError).toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
