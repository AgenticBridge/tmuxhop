// @vitest-environment jsdom
/**
 * tmuxhop pane connection controller tests.
 *
 * Purpose: verify websocket transport behavior for pane attach, streaming, and
 * reconnect scheduling.
 *
 * Boundary: client controller coverage only.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePaneConnection } from "../src/client/app/controller/usePaneConnection.js";
import type { LatestAppSelectionState } from "../src/client/app/controller/types.js";
import type { UseTerminalResult } from "../src/client/app/hooks/useTerminal.js";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  static OPEN = 1;

  readyState = MockWebSocket.OPEN;
  sent: string[] = [];
  private readonly listeners = new Map<string, Array<(event?: unknown) => void>>();

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(event: string, listener: (event?: unknown) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  close() {
    this.emit("close");
  }

  send(data: string) {
    this.sent.push(data);
  }

  emit(event: string, payload?: unknown) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }
}

function createTerminalMock(): UseTerminalResult {
  return {
    mountRef: { current: document.createElement("div") },
    getCurrentTerminalSize: vi.fn(() => ({ cols: 90, rows: 30 })),
    resetTerminal: vi.fn(),
    syncTerminalSize: vi.fn(),
    writeToTerminal: vi.fn(),
  };
}

describe("usePaneConnection", () => {
  afterEach(() => {
    MockWebSocket.instances = [];
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("attaches to an explicit pane id and sends an initial resize on open", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    const terminal = createTerminalMock();
    const onStatusChange = vi.fn();

    const { result } = renderHook(() =>
      usePaneConnection({
        latestStateRef: {
          current: {
            selectedSessionName: "tmuxhop",
            selectedWindowId: "@1",
            selectedPaneId: "%1",
            windows: [],
          } satisfies LatestAppSelectionState,
        },
        onReconnectRequested: vi.fn(async () => undefined),
        onStatusChange,
        terminal,
      }),
    );

    await act(async () => {
      await result.current.attachSelectedPane({ paneId: "%9" });
    });

    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toContain("/api/panes/%259/attach");
    act(() => {
      socket?.emit("open");
    });

    expect(terminal.syncTerminalSize).toHaveBeenCalled();
    expect(socket?.sent).toContain(JSON.stringify({ type: "resize", cols: 90, rows: 30 }));
    expect(onStatusChange).toHaveBeenCalledWith("Live", "ok");
  });

  it("writes snapshot and data frames to the terminal", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    const terminal = createTerminalMock();

    const { result } = renderHook(() =>
      usePaneConnection({
        latestStateRef: {
          current: {
            selectedSessionName: "tmuxhop",
            selectedWindowId: "@1",
            selectedPaneId: "%1",
            windows: [],
          } satisfies LatestAppSelectionState,
        },
        onReconnectRequested: vi.fn(async () => undefined),
        onStatusChange: vi.fn(),
        terminal,
      }),
    );

    await act(async () => {
      await result.current.attachSelectedPane({ paneId: "%1" });
    });

    const socket = MockWebSocket.instances[0];
    act(() => {
      socket?.emit("message", {
        data: JSON.stringify({ type: "snapshot", paneId: "%1", content: "hello" }),
      });
      socket?.emit("message", {
        data: JSON.stringify({ type: "data", paneId: "%1", data: " world" }),
      });
    });

    expect(terminal.resetTerminal).toHaveBeenCalledTimes(2);
    expect(terminal.writeToTerminal).toHaveBeenNthCalledWith(1, "hello");
    expect(terminal.writeToTerminal).toHaveBeenNthCalledWith(2, " world");
  });

  it("warns instead of opening a socket when there is no selected pane", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    const onStatusChange = vi.fn();

    const { result } = renderHook(() =>
      usePaneConnection({
        latestStateRef: {
          current: {
            selectedSessionName: "tmuxhop",
            selectedWindowId: null,
            selectedPaneId: null,
            windows: [],
          } satisfies LatestAppSelectionState,
        },
        onReconnectRequested: vi.fn(async () => undefined),
        onStatusChange,
        terminal: createTerminalMock(),
      }),
    );

    await act(async () => {
      await result.current.attachSelectedPane();
    });

    expect(MockWebSocket.instances).toHaveLength(0);
    expect(onStatusChange).toHaveBeenCalledWith("No Pane", "warn");
  });

  it("schedules a reconnect when the active socket closes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    const onReconnectRequested = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      usePaneConnection({
        latestStateRef: {
          current: {
            selectedSessionName: "tmuxhop",
            selectedWindowId: "@1",
            selectedPaneId: "%1",
            windows: [],
          } satisfies LatestAppSelectionState,
        },
        onReconnectRequested,
        onStatusChange: vi.fn(),
        terminal: createTerminalMock(),
      }),
    );

    await act(async () => {
      await result.current.attachSelectedPane({ paneId: "%1" });
    });

    const socket = MockWebSocket.instances[0];
    act(() => {
      socket?.emit("close");
      vi.advanceTimersByTime(1000);
    });

    expect(onReconnectRequested).toHaveBeenCalledTimes(1);
  });

  it("ignores close events from a stale socket after a newer attach", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    const onReconnectRequested = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      usePaneConnection({
        latestStateRef: {
          current: {
            selectedSessionName: "tmuxhop",
            selectedWindowId: "@1",
            selectedPaneId: "%1",
            windows: [],
          } satisfies LatestAppSelectionState,
        },
        onReconnectRequested,
        onStatusChange: vi.fn(),
        terminal: createTerminalMock(),
      }),
    );

    await act(async () => {
      await result.current.attachSelectedPane({ paneId: "%1" });
      await result.current.attachSelectedPane({ paneId: "%2" });
    });

    const [firstSocket] = MockWebSocket.instances;
    act(() => {
      firstSocket?.emit("close");
      vi.advanceTimersByTime(1000);
    });

    expect(onReconnectRequested).not.toHaveBeenCalled();
  });
});
