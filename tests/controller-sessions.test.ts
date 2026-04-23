// @vitest-environment jsdom
/**
 * tmuxhop sessions controller tests.
 *
 * Purpose: verify the session/window loading controller, including empty-state
 * handling, preserved selection, and stale-request suppression.
 *
 * Boundary: client controller coverage only.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRequestGuards } from "../src/client/app/controller/useRequestGuards.js";
import { useSessions } from "../src/client/app/controller/useSessions.js";

function mockJsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe("useSessions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("enters the empty-state flow when no sessions are available", async () => {
    const onStatusChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => mockJsonResponse({
      sessions: [],
      defaultSessionName: null,
    })));

    const { result } = renderHook(() => {
      const guards = useRequestGuards({ onStatusChange });
      return useSessions({ onStatusChange, requestGuards: guards });
    });

    await act(async () => {
      await result.current.loadState();
    });

    expect(result.current.showEmptyState).toBe(true);
    expect(result.current.showApp).toBe(false);
    expect(result.current.showControls).toBe(false);
    expect(result.current.sessionTitle).toBe("No Sessions");
    expect(onStatusChange).toHaveBeenCalledWith("Missing", "warn");
  });

  it("marks a selected session as missing when the tmux session does not exist", async () => {
    const onStatusChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockJsonResponse({
          exists: false,
          sessionName: "tmuxhop",
          windows: [],
          activePaneId: null,
        }),
      ),
    );

    const { result } = renderHook(() => {
      const guards = useRequestGuards({ onStatusChange });
      return useSessions({ onStatusChange, requestGuards: guards });
    });

    await act(async () => {
      await result.current.loadWindowsForSelectedSession({ sessionName: "tmuxhop" });
    });

    expect(result.current.showEmptyState).toBe(true);
    expect(result.current.showApp).toBe(false);
    expect(result.current.showControls).toBe(false);
    expect(result.current.windows).toEqual([]);
    expect(onStatusChange).toHaveBeenLastCalledWith("Missing", "warn");
  });

  it("preserves the previously selected pane when reloading a session", async () => {
    const onStatusChange = vi.fn();
    const firstPayload = {
      exists: true,
      sessionName: "tmuxhop",
      activePaneId: "%1",
      windows: [
        {
          id: "@1",
          index: 0,
          name: "code",
          active: true,
          panes: [
            {
              id: "%1",
              windowId: "@1",
              index: 0,
              active: true,
              title: "editor",
              cwd: "/repo",
              command: "zsh",
            },
            {
              id: "%2",
              windowId: "@1",
              index: 1,
              active: false,
              title: "tests",
              cwd: "/repo",
              command: "vitest",
            },
          ],
        },
      ],
    };
    const secondPayload = {
      ...firstPayload,
      activePaneId: "%1",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(firstPayload))
      .mockResolvedValueOnce(mockJsonResponse(secondPayload));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => {
      const guards = useRequestGuards({ onStatusChange });
      return useSessions({ onStatusChange, requestGuards: guards });
    });

    await act(async () => {
      await result.current.loadWindowsForSelectedSession({ sessionName: "tmuxhop" });
    });
    await act(async () => {
      result.current.selectPane("%2");
      await result.current.loadWindowsForSelectedSession({
        sessionName: "tmuxhop",
        preserveSelection: true,
      });
    });

    expect(result.current.selectedPaneId).toBe("%2");
  });

  it("ignores stale session-load responses that resolve out of order", async () => {
    const onStatusChange = vi.fn();
    const first = deferred<ReturnType<typeof mockJsonResponse>>();
    const second = deferred<ReturnType<typeof mockJsonResponse>>();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => {
      const guards = useRequestGuards({ onStatusChange });
      return useSessions({ onStatusChange, requestGuards: guards });
    });

    const firstLoad = act(async () => {
      await result.current.loadWindowsForSelectedSession({ sessionName: "alpha" });
    });
    const secondLoad = act(async () => {
      await result.current.loadWindowsForSelectedSession({ sessionName: "beta" });
    });

    second.resolve(
      mockJsonResponse({
        exists: true,
        sessionName: "beta",
        activePaneId: "%2",
        windows: [
          {
            id: "@2",
            index: 1,
            name: "beta",
            active: true,
            panes: [
              {
                id: "%2",
                windowId: "@2",
                index: 0,
                active: true,
                title: "beta-pane",
                cwd: "/beta",
                command: "zsh",
              },
            ],
          },
        ],
      }),
    );
    await secondLoad;

    first.resolve(
      mockJsonResponse({
        exists: true,
        sessionName: "alpha",
        activePaneId: "%1",
        windows: [
          {
            id: "@1",
            index: 0,
            name: "alpha",
            active: true,
            panes: [
              {
                id: "%1",
                windowId: "@1",
                index: 0,
                active: true,
                title: "alpha-pane",
                cwd: "/alpha",
                command: "zsh",
              },
            ],
          },
        ],
      }),
    );
    await firstLoad;

    expect(result.current.sessionTitle).toBe("beta");
    expect(result.current.selectedPaneId).toBe("%2");
    expect(result.current.windows[0]?.name).toBe("beta");
  });
});
