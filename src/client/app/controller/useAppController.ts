/**
 * tmuxhop app controller hook.
 *
 * Purpose: own the app-shell orchestration layer, including session loading,
 * selection transitions, websocket attachment, reconnect policy, and font
 * diagnostics.
 *
 * Boundary: client-only. This hook may depend on backend protocol types and
 * lower-level client hooks, but it should stay separate from presentational
 * React components.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ClientSocketMessage,
  PathLevel,
  PathMutationRequest,
  PathMutationResponse,
} from "../../../server/protocol.js";
import {
  createPendingFontCompatibilityReport,
  detectFontCompatibility,
  ensureBundledTerminalFontReady,
  type FontCompatibilityReport,
} from "../../terminal/font-diagnostics.js";
import {
  getTerminalFontStack,
  loadTerminalFontSize,
  loadTerminalFontMode,
  saveTerminalFontSize,
  saveTerminalFontMode,
  terminalFontModeNeedsBundledAsset,
  type TerminalFontMode,
} from "../../terminal/settings.js";
import { clampTerminalFontSize, getResponsiveTerminalFontSize } from "../../terminal/size.js";
import { useTerminal } from "../hooks/useTerminal.js";
import type { StatusState, StatusTone } from "../ui.js";
import type { AppController } from "./types.js";
import { usePaneConnection } from "./usePaneConnection.js";
import { useRequestGuards } from "./useRequestGuards.js";
import { useSessions } from "./useSessions.js";

export function useAppController(): AppController {
  const [status, setStatus] = useState<StatusState>({ label: "Connecting", tone: "default" });
  const [fontMode, setFontMode] = useState<TerminalFontMode>(() => loadTerminalFontMode());
  const [savedTerminalFontSize, setSavedTerminalFontSize] = useState<number | null>(() =>
    loadTerminalFontSize(),
  );
  const [terminalFontSize, setTerminalFontSize] = useState(() =>
    getInitialTerminalFontSize(savedTerminalFontSize),
  );
  const [fontReport, setFontReport] = useState<FontCompatibilityReport>(
    createPendingFontCompatibilityReport,
  );
  const sendSocketMessageRef = useRef<(payload: ClientSocketMessage) => void>(() => {});

  const requestGuards = useRequestGuards({
    onStatusChange: setStatusState,
  });

  function setStatusState(label: string, tone: StatusTone = "default") {
    setStatus({ label, tone });
  }

  const terminalFontStack = getTerminalFontStack(fontMode);

  async function refreshFontReport() {
    if (terminalFontModeNeedsBundledAsset(fontMode)) {
      await waitForFontProbeBudget();
    }
    setFontReport(detectFontCompatibility(terminalFontStack));
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (terminalFontModeNeedsBundledAsset(fontMode)) {
        await waitForFontProbeBudget();
      }
      if (cancelled) {
        return;
      }

      setFontReport(detectFontCompatibility(terminalFontStack));
    })();

    return () => {
      cancelled = true;
    };
  }, [fontMode, terminalFontStack]);

  const sessions = useSessions({
    onStatusChange: setStatusState,
    requestGuards,
  });

  async function reconnectSelectedPane() {
    if (!sessions.latestStateRef.current.selectedSessionName) {
      setStatusState("Missing", "warn");
      return;
    }

    try {
      const { selectedPaneId } = await sessions.loadWindowsForSelectedSession({
        preserveSelection: true,
      });
      await paneConnection.attachSelectedPane({
        paneId: selectedPaneId,
        preserveTerminal: true,
      });
    } catch (error) {
      requestGuards.reportAsyncError(error);
    }
  }

  async function initializeApp() {
    const { selectedPaneId } = await sessions.loadState();
    await paneConnection.attachSelectedPane({ paneId: selectedPaneId });
  }

  async function mutatePath(request: PathMutationRequest): Promise<PathMutationResponse> {
    const response = await fetch("/api/path-control", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || `Path action failed: ${response.status}`);
    }

    return (await response.json()) as PathMutationResponse;
  }

  async function reloadAfterMutation(
    response: PathMutationResponse,
    options: {
      refreshSessions?: boolean;
      preserveSelection?: boolean;
    } = {},
  ) {
    const nextSessionName = options.refreshSessions
      ? await sessions.refreshSessions({
          preferredSessionName:
            response.sessionName ?? sessions.latestStateRef.current.selectedSessionName,
        })
      : response.sessionName ?? sessions.latestStateRef.current.selectedSessionName;

    const { selectedPaneId } = await sessions.loadWindowsForSelectedSession({
      sessionName: nextSessionName,
      preserveSelection: options.preserveSelection,
      preferredSelection:
        response.windowId || response.paneId
          ? {
              selectedWindowId: response.windowId,
              selectedPaneId: response.paneId,
            }
          : undefined,
    });

    await paneConnection.attachSelectedPane({
      paneId: response.paneId ?? selectedPaneId,
    });
  }

  const terminal = useTerminal({
    fontFamily: terminalFontStack,
    fontSize: savedTerminalFontSize,
    fontMode,
    onInput: useCallback((data: string) => {
      sendSocketMessageRef.current({ type: "input", data });
    }, []),
    onResolvedFontSizeChange: setTerminalFontSize,
    onTerminalSizeChange: useCallback((dimensions) => {
      sendSocketMessageRef.current({
        type: "resize",
        cols: dimensions.cols,
        rows: dimensions.rows,
      });
    }, []),
    onReady: useCallback(async () => {
      try {
        await initializeApp();
      } catch (error) {
        requestGuards.reportAsyncError(error);
      }
    }, []),
  });

  const paneConnection = usePaneConnection({
    latestStateRef: sessions.latestStateRef,
    onReconnectRequested: reconnectSelectedPane,
    onStatusChange: setStatusState,
    terminal,
  });
  sendSocketMessageRef.current = paneConnection.sendSocketMessage;

  return {
    fontMode,
    fontReport,
    onCreatePath: async (level: PathLevel, name: string) => {
      const response = await mutatePath({
        action: "create",
        level,
        name,
        sessionName: sessions.latestStateRef.current.selectedSessionName,
        windowId: sessions.latestStateRef.current.selectedWindowId,
        paneId: sessions.latestStateRef.current.selectedPaneId,
      });

      if (response.sessionName) {
        sessions.selectSession(response.sessionName);
      }
      await reloadAfterMutation(response, { refreshSessions: level === "sessions" });
    },
    onDeletePath: async (level: PathLevel) => {
      const response = await mutatePath({
        action: "delete",
        level,
        sessionName: sessions.latestStateRef.current.selectedSessionName,
        windowId: sessions.latestStateRef.current.selectedWindowId,
        paneId: sessions.latestStateRef.current.selectedPaneId,
      });

      await reloadAfterMutation(response, {
        preserveSelection: true,
        refreshSessions: level === "sessions",
      });
    },
    onFontModeChange: (mode: TerminalFontMode) => {
      setFontMode(mode);
      saveTerminalFontMode(mode);
      setFontReport(createPendingFontCompatibilityReport());
    },
    onDecreaseTerminalFontSize: () => {
      const nextFontSize = clampTerminalFontSize(terminalFontSize - 1);
      setSavedTerminalFontSize(nextFontSize);
      setTerminalFontSize(nextFontSize);
      saveTerminalFontSize(nextFontSize);
    },
    onIncreaseTerminalFontSize: () => {
      const nextFontSize = clampTerminalFontSize(terminalFontSize + 1);
      setSavedTerminalFontSize(nextFontSize);
      setTerminalFontSize(nextFontSize);
      saveTerminalFontSize(nextFontSize);
    },
    onReconnect: () => {
      void reconnectSelectedPane();
    },
    onRenamePath: async (level: PathLevel, name: string) => {
      const response = await mutatePath({
        action: "rename",
        level,
        name,
        sessionName: sessions.latestStateRef.current.selectedSessionName,
        windowId: sessions.latestStateRef.current.selectedWindowId,
        paneId: sessions.latestStateRef.current.selectedPaneId,
      });

      if (response.sessionName) {
        sessions.selectSession(response.sessionName);
      }
      await reloadAfterMutation(response, {
        preserveSelection: true,
        refreshSessions: level === "sessions",
      });
    },
    onSelectPane: (paneId: string) => {
      sessions.selectPane(paneId);
      requestGuards.runTask(async () => {
        await paneConnection.attachSelectedPane({ paneId });
      });
    },
    onSelectSession: (sessionName: string) => {
      if (sessionName === sessions.selectedSessionName) {
        return;
      }
      sessions.selectSession(sessionName);
      requestGuards.runTask(async () => {
        const { selectedPaneId } = await sessions.loadWindowsForSelectedSession({ sessionName });
        await paneConnection.attachSelectedPane({ paneId: selectedPaneId });
      });
    },
    onSelectWindow: (windowId: string) => {
      const { selectedPaneId } = sessions.selectWindow(windowId);
      requestGuards.runTask(async () => {
        await paneConnection.attachSelectedPane({ paneId: selectedPaneId });
      });
    },
    onShortcut: (input: string) => paneConnection.sendSocketMessage({ type: "shortcut", data: input }),
    onTextInput: (data: string) =>
      paneConnection.sendSocketMessage({
        type: "input",
        data: data,  // Only send text, no Enter key
      }),
    refreshFontReport: () => {
      void refreshFontReport();
    },
    selectedPaneId: sessions.selectedPaneId,
    selectedSessionName: sessions.selectedSessionName,
    selectedWindowId: sessions.selectedWindowId,
    selectedWindowPanes: sessions.selectedWindowPanes,
    sessions: sessions.sessions,
    showApp: sessions.showApp,
    showControls: sessions.showControls,
    showEmptyState: sessions.showEmptyState,
    status,
    terminalMountRef: terminal.mountRef,
    terminalFontSize,
    windows: sessions.windows,
  };
}

async function waitForFontProbeBudget() {
  await Promise.race([ensureBundledTerminalFontReady(), waitForFontProbeTimeout()]);
}

function getInitialTerminalFontSize(savedTerminalFontSize: number | null): number {
  if (savedTerminalFontSize !== null) {
    return savedTerminalFontSize;
  }

  const viewportWidth = getSafeViewportWidth();
  return getResponsiveTerminalFontSize({
    mountWidth: viewportWidth,
    viewportWidth,
  });
}

function getSafeViewportWidth(): number {
  try {
    return window.innerWidth;
  } catch {
    return 0;
  }
}

function waitForFontProbeTimeout() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 250);
  });
}
