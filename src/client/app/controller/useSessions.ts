/**
 * tmuxhop sessions controller hook.
 *
 * Purpose: own session/window/pane loading, selection state, and the page
 * visibility state derived from tmux availability.
 *
 * Boundary: client-only. This hook manages session-domain state and fetches,
 * but it does not own websocket transport.
 */
import { useMemo, useRef, useState } from "react";

import type {
  SessionsResponse,
  SessionSummary,
  WindowInfo,
  WindowsResponse,
} from "../../../server/protocol.js";
import {
  getInitialSessionName,
  getInitialSelection,
  getRecoveredSelection,
  getSelectedWindow,
} from "../../state/selection.js";
import type { LatestAppSelectionState } from "./types.js";
import type { UseRequestGuardsResult } from "./useRequestGuards.js";

export interface SessionLoadResult {
  selectedPaneId: string | null;
}

export interface UseSessionsOptions {
  onStatusChange(label: string, tone?: "default" | "ok" | "warn" | "error"): void;
  requestGuards: UseRequestGuardsResult;
}

export interface UseSessionsResult {
  latestStateRef: React.RefObject<LatestAppSelectionState>;
  selectedPaneId: string | null;
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedWindowPanes: WindowInfo["panes"];
  sessionTitle: string;
  sessions: SessionSummary[];
  showApp: boolean;
  showControls: boolean;
  showEmptyState: boolean;
  windows: WindowInfo[];
  loadState(): Promise<SessionLoadResult>;
  loadWindowsForSelectedSession(options?: {
    preserveSelection?: boolean;
    sessionName?: string | null;
  }): Promise<SessionLoadResult>;
  selectPane(paneId: string): SessionLoadResult;
  selectSession(sessionName: string): void;
  selectWindow(windowId: string): SessionLoadResult;
}

export function useSessions(options: UseSessionsOptions): UseSessionsResult {
  const { onStatusChange, requestGuards } = options;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionName, setSelectedSessionName] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [selectedPaneId, setSelectedPaneId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("Shared Session");
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const latestStateRef = useRef<LatestAppSelectionState>({
    selectedSessionName: null,
    selectedWindowId: null,
    selectedPaneId: null,
    windows: [],
  });

  latestStateRef.current = {
    selectedSessionName,
    selectedWindowId,
    selectedPaneId,
    windows,
  };

  const selectedWindowPanes = useMemo(
    () => getSelectedWindow(windows, selectedWindowId)?.panes ?? [],
    [windows, selectedWindowId],
  );

  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed for ${url}: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function loadWindowsForSelectedSession({
    sessionName,
    preserveSelection = false,
  }: {
    sessionName?: string | null;
    preserveSelection?: boolean;
  } = {}): Promise<SessionLoadResult> {
    const requestRevision = requestGuards.beginRequestRevision();
    const targetSessionName = sessionName ?? latestStateRef.current.selectedSessionName;
    const previousSelection = {
      selectedWindowId: latestStateRef.current.selectedWindowId,
      selectedPaneId: latestStateRef.current.selectedPaneId,
    };

    if (!targetSessionName) {
      if (!requestGuards.isCurrentRequestRevision(requestRevision)) {
        return { selectedPaneId: null };
      }
      setWindows([]);
      setSelectedWindowId(null);
      setSelectedPaneId(null);
      setShowEmptyState(true);
      setShowApp(false);
      setShowControls(false);
      setSessionTitle("Select Session");
      onStatusChange("Missing", "warn");
      return { selectedPaneId: null };
    }

    onStatusChange("Loading", "warn");
    const windowsPayload = await fetchJson<WindowsResponse>(
      `/api/windows?session=${encodeURIComponent(targetSessionName)}`,
    );
    if (!requestGuards.isCurrentRequestRevision(requestRevision)) {
      return { selectedPaneId: null };
    }

    setSessionTitle(windowsPayload.sessionName || "Shared Session");

    if (!windowsPayload.exists) {
      setWindows([]);
      setSelectedWindowId(null);
      setSelectedPaneId(null);
      setShowEmptyState(true);
      setShowApp(false);
      setShowControls(false);
      onStatusChange("Missing", "warn");
      return { selectedPaneId: null };
    }

    setShowEmptyState(false);
    setShowApp(true);
    setShowControls(true);
    setWindows(windowsPayload.windows);

    const selection = preserveSelection
      ? getRecoveredSelection(windowsPayload.windows, previousSelection, windowsPayload.activePaneId)
      : getInitialSelection(windowsPayload.windows, windowsPayload.activePaneId);

    setSelectedWindowId(selection.selectedWindowId);
    setSelectedPaneId(selection.selectedPaneId);

    latestStateRef.current = {
      ...latestStateRef.current,
      selectedSessionName: targetSessionName,
      selectedWindowId: selection.selectedWindowId,
      selectedPaneId: selection.selectedPaneId,
      windows: windowsPayload.windows,
    };

    return { selectedPaneId: selection.selectedPaneId };
  }

  async function loadState(): Promise<SessionLoadResult> {
    const requestRevision = requestGuards.beginRequestRevision();
    const sessionsPayload = await fetchJson<SessionsResponse>("/api/sessions");
    if (!requestGuards.isCurrentRequestRevision(requestRevision)) {
      return { selectedPaneId: null };
    }

    const nextSessionName = getInitialSessionName(
      sessionsPayload.sessions,
      sessionsPayload.defaultSessionName,
    );

    setSessions(sessionsPayload.sessions);
    setSelectedSessionName(nextSessionName);
    latestStateRef.current = {
      ...latestStateRef.current,
      selectedSessionName: nextSessionName,
    };

    if (sessionsPayload.sessions.length === 0) {
      setSessionTitle("No Sessions");
      setShowEmptyState(true);
      setShowApp(false);
      setShowControls(false);
      onStatusChange("Missing", "warn");
      return { selectedPaneId: null };
    }

    return loadWindowsForSelectedSession({ sessionName: nextSessionName });
  }

  function selectSession(sessionName: string) {
    setSelectedSessionName(sessionName);
    latestStateRef.current = {
      ...latestStateRef.current,
      selectedSessionName: sessionName,
    };
  }

  function selectWindow(windowId: string): SessionLoadResult {
    const window = windows.find((candidate) => candidate.id === windowId);
    const nextPaneId = window?.panes[0]?.id ?? null;
    setSelectedWindowId(windowId);
    setSelectedPaneId(nextPaneId);
    latestStateRef.current = {
      ...latestStateRef.current,
      selectedWindowId: windowId,
      selectedPaneId: nextPaneId,
    };
    return { selectedPaneId: nextPaneId };
  }

  function selectPane(paneId: string): SessionLoadResult {
    setSelectedPaneId(paneId);
    latestStateRef.current = {
      ...latestStateRef.current,
      selectedPaneId: paneId,
    };
    return { selectedPaneId: paneId };
  }

  return {
    latestStateRef,
    selectedPaneId,
    selectedSessionName,
    selectedWindowId,
    selectedWindowPanes,
    sessionTitle,
    sessions,
    showApp,
    showControls,
    showEmptyState,
    windows,
    loadState,
    loadWindowsForSelectedSession,
    selectPane,
    selectSession,
    selectWindow,
  };
}
