/**
 * tmuxhop pane connection hook.
 *
 * Purpose: own the websocket attach/reconnect transport for the currently
 * selected pane while delegating tmux data selection to the sessions layer.
 *
 * Boundary: client-only. This hook manages live pane transport and depends on
 * the terminal helper, but it does not fetch session/window metadata.
 */
import { useCallback, useEffect, useRef } from "react";

import type {
  ClientSocketMessage,
  ServerSocketMessage,
} from "../../../server/protocol.js";
import type { LatestAppSelectionState } from "./types.js";
import type { UseTerminalResult } from "../hooks/useTerminal.js";
import { getSelectedPane } from "../../state/selection.js";

export interface UsePaneConnectionOptions {
  latestStateRef: React.RefObject<LatestAppSelectionState>;
  onReconnectRequested(): Promise<void>;
  onStatusChange(label: string, tone?: "default" | "ok" | "warn" | "error"): void;
  terminal: UseTerminalResult;
}

export interface UsePaneConnectionResult {
  attachSelectedPane(options?: { paneId?: string | null; preserveTerminal?: boolean }): Promise<void>;
  sendSocketMessage(payload: ClientSocketMessage): void;
}

export function usePaneConnection(options: UsePaneConnectionOptions): UsePaneConnectionResult {
  const { latestStateRef, onReconnectRequested, onStatusChange, terminal } = options;

  const socketRef = useRef<WebSocket | null>(null);
  const socketRevisionRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    return () => {
      teardownSocket();
    };
  }, []);

  function clearReconnectTimer() {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  function teardownSocket({ intentional = true }: { intentional?: boolean } = {}) {
    clearReconnectTimer();

    const socket = socketRef.current;
    socketRef.current = null;

    if (socket && intentional) {
      socket.close();
    }
  }

  function sendSocketMessage(payload: ClientSocketMessage) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    socketRef.current.send(JSON.stringify(payload));
  }

  const syncTerminalSize = useCallback(() => {
    terminal.syncTerminalSize();
  }, [terminal]);

  function buildPaneSocketUrl(paneId: string): string {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = new URL(
      `${protocol}://${window.location.host}/api/panes/${encodeURIComponent(paneId)}/attach`,
    );
    const dimensions = terminal.getCurrentTerminalSize();
    if (dimensions) {
      url.searchParams.set("cols", String(dimensions.cols));
      url.searchParams.set("rows", String(dimensions.rows));
    }
    return url.toString();
  }

  async function attachSelectedPane({
    paneId,
    preserveTerminal = false,
  }: {
    paneId?: string | null;
    preserveTerminal?: boolean;
  } = {}) {
    const resolvedPaneId =
      paneId ??
      getSelectedPane(
        latestStateRef.current.windows,
        latestStateRef.current.selectedWindowId,
        latestStateRef.current.selectedPaneId,
      )?.id ??
      null;

    teardownSocket();
    if (!preserveTerminal) {
      terminal.resetTerminal();
    }

    if (!resolvedPaneId) {
      onStatusChange("No Pane", "warn");
      return;
    }

    clearReconnectTimer();
    const socket = new WebSocket(buildPaneSocketUrl(resolvedPaneId));
    const revision = socketRevisionRef.current + 1;

    socketRef.current = socket;
    socketRevisionRef.current = revision;
    onStatusChange("Connecting", "warn");

    socket.addEventListener("open", () => {
      if (socketRef.current !== socket) {
        return;
      }

      reconnectAttemptRef.current = 0;
      onStatusChange("Live", "ok");
      clearReconnectTimer();
      syncTerminalSize();
    });

    socket.addEventListener("message", (event) => {
      if (socketRef.current !== socket || socketRevisionRef.current !== revision) {
        return;
      }

      const payload = JSON.parse(event.data) as ServerSocketMessage;

      if (payload.type === "snapshot") {
        terminal.resetTerminal();
        terminal.writeToTerminal(payload.content);
        return;
      }

      if (payload.type === "data") {
        terminal.writeToTerminal(payload.data);
        return;
      }

      if (payload.type === "error") {
        onStatusChange("Error", "error");
        console.error(payload.message);
      }
    });

    socket.addEventListener("close", () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
        clearReconnectTimer();
        reconnectAttemptRef.current += 1;
        onStatusChange(`Reconnecting (${reconnectAttemptRef.current})`, "warn");
        reconnectTimerRef.current = window.setTimeout(() => {
          if (socketRef.current !== null) {
            return;
          }
          void onReconnectRequested();
        }, 1000);
      }
    });
  }

  return {
    attachSelectedPane,
    sendSocketMessage,
  };
}
