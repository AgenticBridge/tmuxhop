// @vitest-environment jsdom
/**
 * tmuxhop app controller orchestration tests.
 *
 * Purpose: verify that the top-level controller coordinates sessions and pane
 * transport in the expected order.
 *
 * Boundary: client controller integration coverage only.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppController } from "../src/client/app/controller/useAppController.js";
import type { AppController } from "../src/client/app/controller/types.js";

const sessionsMock = vi.hoisted(() => ({
  loadState: vi.fn(),
  loadWindowsForSelectedSession: vi.fn(),
  selectPane: vi.fn(),
  selectSession: vi.fn(),
  selectWindow: vi.fn(),
}));

const paneConnectionMock = vi.hoisted(() => ({
  attachSelectedPane: vi.fn(),
  sendSocketMessage: vi.fn(),
}));

vi.mock("../src/client/app/controller/useSessions.js", () => ({
  useSessions: () => ({
    latestStateRef: {
      current: {
        selectedSessionName: "tmuxhop",
        selectedWindowId: "@1",
        selectedPaneId: "%1",
        windows: [],
      },
    },
    selectedPaneId: "%1",
    selectedSessionName: "tmuxhop",
    selectedWindowId: "@1",
    selectedWindowPanes: [],
    sessionTitle: "tmuxhop",
    sessions: [{ name: "tmuxhop", attached: true, windows: 1 }],
    showApp: true,
    showControls: true,
    showEmptyState: false,
    windows: [],
    ...sessionsMock,
  }),
}));

vi.mock("../src/client/app/controller/usePaneConnection.js", () => ({
  usePaneConnection: () => ({
    ...paneConnectionMock,
  }),
}));

vi.mock("../src/client/app/hooks/useTerminal.js", () => ({
  useTerminal: (_options: unknown) => ({
    mountRef: { current: document.createElement("div") },
    getCurrentTerminalSize: vi.fn(() => ({ cols: 90, rows: 30 })),
    syncTerminalSize: vi.fn(),
    resetTerminal: vi.fn(),
    writeToTerminal: vi.fn(),
  }),
}));

describe("useAppController", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads windows and then attaches the returned pane on session change", async () => {
    sessionsMock.loadWindowsForSelectedSession.mockResolvedValue({ selectedPaneId: "%9" });

    const { result } = renderHook(() => useAppController());

    await act(async () => {
      result.current.onSelectSession("notes");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sessionsMock.selectSession).toHaveBeenCalledWith("notes");
    expect(sessionsMock.loadWindowsForSelectedSession).toHaveBeenCalledWith({
      sessionName: "notes",
    });
    expect(paneConnectionMock.attachSelectedPane).toHaveBeenCalledWith({ paneId: "%9" });
  });

  it("reattaches the selected pane with terminal preservation on reconnect", async () => {
    sessionsMock.loadWindowsForSelectedSession.mockResolvedValue({ selectedPaneId: "%5" });

    const { result } = renderHook(() => useAppController());

    await act(async () => {
      result.current.onReconnect();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sessionsMock.loadWindowsForSelectedSession).toHaveBeenCalledWith({
      preserveSelection: true,
    });
    expect(paneConnectionMock.attachSelectedPane).toHaveBeenCalledWith({
      paneId: "%5",
      preserveTerminal: true,
    });
  });
});
