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
import { useCallback, useRef, useState } from "react";

import type { ClientSocketMessage } from "../../../server/protocol.js";
import {
  detectFontCompatibility,
  TERMINAL_FONT_STACK,
  type FontCompatibilityReport,
} from "../../terminal/font-diagnostics.js";
import { useTerminal } from "../hooks/useTerminal.js";
import type { NavScope, StatusState, StatusTone } from "../ui.js";
import type { AppController } from "./types.js";
import { usePaneConnection } from "./usePaneConnection.js";
import { useRequestGuards } from "./useRequestGuards.js";
import { useSessions } from "./useSessions.js";

export function useAppController(): AppController {
  const [navScope, setNavScope] = useState<NavScope>("panes");
  const [status, setStatus] = useState<StatusState>({ label: "Connecting", tone: "default" });
  const [fontReport, setFontReport] = useState<FontCompatibilityReport>(() =>
    detectFontCompatibility(TERMINAL_FONT_STACK),
  );
  const [fontModalOpen, setFontModalOpen] = useState(false);
  const sendSocketMessageRef = useRef<(payload: ClientSocketMessage) => void>(() => {});

  const requestGuards = useRequestGuards({
    onStatusChange: setStatusState,
  });

  function setStatusState(label: string, tone: StatusTone = "default") {
    setStatus({ label, tone });
  }

  function refreshFontReport() {
    setFontReport(detectFontCompatibility(TERMINAL_FONT_STACK));
  }

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

  const terminal = useTerminal({
    onInput: useCallback((data: string) => {
      sendSocketMessageRef.current({ type: "input", data });
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
    closeFontModal: () => setFontModalOpen(false),
    fontModalOpen,
    fontReport,
    navScope,
    onReconnect: () => {
      void reconnectSelectedPane();
    },
    onSelectNavScope: setNavScope,
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
      setNavScope("windows");
      requestGuards.runTask(async () => {
        const { selectedPaneId } = await sessions.loadWindowsForSelectedSession({ sessionName });
        await paneConnection.attachSelectedPane({ paneId: selectedPaneId });
      });
    },
    onSelectWindow: (windowId: string) => {
      const { selectedPaneId } = sessions.selectWindow(windowId);
      setNavScope("panes");
      requestGuards.runTask(async () => {
        await paneConnection.attachSelectedPane({ paneId: selectedPaneId });
      });
    },
    onShortcut: (input: string) => paneConnection.sendSocketMessage({ type: "shortcut", data: input }),
    refreshFontReport,
    selectedPaneId: sessions.selectedPaneId,
    selectedSessionName: sessions.selectedSessionName,
    selectedWindowId: sessions.selectedWindowId,
    selectedWindowPanes: sessions.selectedWindowPanes,
    sessionTitle: sessions.sessionTitle,
    sessions: sessions.sessions,
    showApp: sessions.showApp,
    showControls: sessions.showControls,
    showEmptyState: sessions.showEmptyState,
    status,
    terminalMountRef: terminal.mountRef,
    toggleFontModal: () => setFontModalOpen((open) => !open),
    windows: sessions.windows,
  };
}
