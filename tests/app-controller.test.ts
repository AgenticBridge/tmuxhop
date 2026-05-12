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

const fontDiagnosticsMock = vi.hoisted(() => ({
  createPendingFontCompatibilityReport: vi.fn(() => ({
    boxDrawing: true,
    powerline: true,
    nerdFont: true,
    status: "checking" as const,
    headline: "Checking bundled font support",
    details: "tmuxhop is loading the bundled Nerd Font before checking terminal glyph coverage.",
    recommendedFonts: [],
  })),
  detectFontCompatibility: vi.fn(() => ({
    boxDrawing: true,
    powerline: true,
    nerdFont: true,
    status: "ok" as const,
    headline: "Browser font coverage looks good",
    details:
      "The bundled Nerd Font covers pane borders, prompt icons, and fullscreen terminal apps reliably.",
    recommendedFonts: [],
  })),
  ensureBundledTerminalFontReady: vi.fn().mockResolvedValue(undefined),
}));

const sessionsMock = vi.hoisted(() => ({
  loadState: vi.fn(),
  refreshSessions: vi.fn(),
  loadWindowsForSelectedSession: vi.fn(),
  selectPane: vi.fn(),
  selectSession: vi.fn(),
  selectWindow: vi.fn(),
}));

const paneConnectionMock = vi.hoisted(() => ({
  attachSelectedPane: vi.fn(),
  sendSocketMessage: vi.fn(),
}));

const terminalHookMock = vi.hoisted(() => ({
  latestOptions: null as null | {
    fontSize: number | null;
    onResolvedFontSizeChange?: (fontSize: number) => void;
  },
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
  useTerminal: (options: unknown) => {
    terminalHookMock.latestOptions = options as {
      fontSize: number | null;
      onResolvedFontSizeChange?: (fontSize: number) => void;
    };
    return {
      mountRef: { current: document.createElement("div") },
      getCurrentTerminalSize: vi.fn(() => ({ cols: 90, rows: 30 })),
      syncTerminalSize: vi.fn(),
      resetTerminal: vi.fn(),
      writeToTerminal: vi.fn(),
    };
  },
}));

vi.mock("../src/client/terminal/font-diagnostics.js", () => ({
  TERMINAL_FONT_STACK: '"Tmuxhop Terminal Nerd Font", monospace',
  ...fontDiagnosticsMock,
}));

describe("useAppController", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    sessionsMock.refreshSessions.mockResolvedValue("notes");
    terminalHookMock.latestOptions = null;
    window.localStorage.clear();
  });

  it("keeps font status in checking state until the bundled font preload completes", async () => {
    let resolveFontReady: (() => void) | null = null;
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFontReady = resolve;
        }),
    );

    const { result } = renderHook(() => useAppController());

    expect(result.current.fontReport.status).toBe("checking");
    expect(fontDiagnosticsMock.detectFontCompatibility).not.toHaveBeenCalled();

    await act(async () => {
      resolveFontReady?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fontDiagnosticsMock.detectFontCompatibility).toHaveBeenCalledTimes(1);
    expect(result.current.fontReport.status).toBe("ok");
  });

  it("falls back from checking state if bundled font preload stalls", async () => {
    vi.useFakeTimers();
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockImplementationOnce(
      () => new Promise<void>(() => {}),
    );

    const { result } = renderHook(() => useAppController());

    expect(result.current.fontReport.status).toBe("checking");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fontDiagnosticsMock.detectFontCompatibility).toHaveBeenCalledTimes(1);
    expect(result.current.fontReport.status).toBe("ok");
  });

  it("refreshes the font report even if bundled font preload stalls", async () => {
    vi.useFakeTimers();
    fontDiagnosticsMock.ensureBundledTerminalFontReady
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>(() => {}));

    const { result } = renderHook(() => useAppController());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fontDiagnosticsMock.detectFontCompatibility.mockClear();

    await act(async () => {
      result.current.refreshFontReport();
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fontDiagnosticsMock.detectFontCompatibility).toHaveBeenCalledTimes(1);
  });

  it("loads a persisted absolute terminal font size into the terminal hook", () => {
    window.localStorage.setItem("tmuxhop.terminal-font-size", "18");

    renderHook(() => useAppController());

    expect(terminalHookMock.latestOptions?.fontSize).toBe(18);
  });

  it("persists absolute terminal font size changes from the current resolved size", async () => {
    const { result } = renderHook(() => useAppController());

    await act(async () => {
      terminalHookMock.latestOptions?.onResolvedFontSizeChange?.(12);
    });

    await act(async () => {
      result.current.onIncreaseTerminalFontSize();
    });

    expect(window.localStorage.getItem("tmuxhop.terminal-font-size")).toBe("13");
    expect(terminalHookMock.latestOptions?.fontSize).toBe(13);

    await act(async () => {
      result.current.onDecreaseTerminalFontSize();
    });

    expect(window.localStorage.getItem("tmuxhop.terminal-font-size")).toBe("12");
    expect(terminalHookMock.latestOptions?.fontSize).toBe(12);
  });

  it("bases the first font-size change on the responsive startup size before terminal mount resolves", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });

    const { result } = renderHook(() => useAppController());

    await act(async () => {
      result.current.onIncreaseTerminalFontSize();
    });

    expect(window.localStorage.getItem("tmuxhop.terminal-font-size")).toBe("13");
    expect(terminalHookMock.latestOptions?.fontSize).toBe(13);
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

  it("creates a path target and reloads using the returned selection", async () => {
    sessionsMock.refreshSessions.mockResolvedValue("notes");
    sessionsMock.loadWindowsForSelectedSession.mockResolvedValue({ selectedPaneId: "%7" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sessionName: "notes",
        windowId: "@9",
        paneId: "%9",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() => useAppController());

    await act(async () => {
      await result.current.onCreatePath("sessions", "notes");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/path-control", expect.objectContaining({
      method: "POST",
    }));
    expect(sessionsMock.selectSession).toHaveBeenCalledWith("notes");
    expect(sessionsMock.refreshSessions).toHaveBeenCalledWith({
      preferredSessionName: "notes",
    });
    expect(sessionsMock.loadWindowsForSelectedSession).toHaveBeenCalledWith({
      sessionName: "notes",
      preserveSelection: undefined,
      preferredSelection: {
        selectedWindowId: "@9",
        selectedPaneId: "%9",
      },
    });
    expect(paneConnectionMock.attachSelectedPane).toHaveBeenCalledWith({ paneId: "%9" });
  });

  it("deletes a path target and reloads with preserved selection", async () => {
    sessionsMock.loadWindowsForSelectedSession.mockResolvedValue({ selectedPaneId: "%3" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sessionName: "tmuxhop",
        windowId: null,
        paneId: null,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() => useAppController());

    await act(async () => {
      await result.current.onDeletePath("panes");
    });

    expect(sessionsMock.loadWindowsForSelectedSession).toHaveBeenCalledWith({
      sessionName: "tmuxhop",
      preserveSelection: true,
      preferredSelection: undefined,
    });
    expect(sessionsMock.refreshSessions).not.toHaveBeenCalled();
    expect(paneConnectionMock.attachSelectedPane).toHaveBeenCalledWith({ paneId: "%3" });
  });

  it("refreshes the session list after a session rename before reloading windows", async () => {
    sessionsMock.refreshSessions.mockResolvedValue("renamed");
    sessionsMock.loadWindowsForSelectedSession.mockResolvedValue({ selectedPaneId: "%4" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sessionName: "renamed",
        windowId: "@1",
        paneId: "%4",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() => useAppController());

    await act(async () => {
      await result.current.onRenamePath("sessions", "renamed");
    });

    expect(sessionsMock.selectSession).toHaveBeenCalledWith("renamed");
    expect(sessionsMock.refreshSessions).toHaveBeenCalledWith({
      preferredSessionName: "renamed",
    });
    expect(sessionsMock.loadWindowsForSelectedSession).toHaveBeenCalledWith({
      sessionName: "renamed",
      preserveSelection: true,
      preferredSelection: {
        selectedWindowId: "@1",
        selectedPaneId: "%4",
      },
    });
    expect(paneConnectionMock.attachSelectedPane).toHaveBeenCalledWith({ paneId: "%4" });
  });
});
