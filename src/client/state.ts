/**
 * PaneHop client selection helpers.
 *
 * Purpose: derive UI-facing selection and label state from backend protocol
 * data without touching the DOM.
 *
 * Boundary: client-only. These helpers should stay free of server runtime
 * behavior and browser side effects.
 */
import type { PaneInfo, SessionSummary, WindowInfo } from "../server/protocol.js";

export interface SelectionState {
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedPaneId: string | null;
}

export function getInitialSessionName(
  sessions: SessionSummary[],
  defaultSessionName: string | null,
): string | null {
  return (
    sessions.find((session) => session.name === defaultSessionName)?.name ??
    sessions[0]?.name ??
    null
  );
}

export function getSelectedWindow(
  windows: WindowInfo[],
  selectedWindowId: string | null,
): WindowInfo | null {
  return windows.find((window) => window.id === selectedWindowId) ?? null;
}

export function getSelectedPane(
  windows: WindowInfo[],
  selectedWindowId: string | null,
  selectedPaneId: string | null,
): PaneInfo | null {
  return (
    getSelectedWindow(windows, selectedWindowId)?.panes.find(
      (pane) => pane.id === selectedPaneId,
    ) ?? null
  );
}

export function getInitialSelection(
  windows: WindowInfo[],
  activePaneId: string | null,
): SelectionState {
  const activeWindow =
    windows.find((window) => window.panes.some((pane) => pane.id === activePaneId)) ??
    windows[0] ??
    null;

  return {
    selectedSessionName: null,
    selectedWindowId: activeWindow?.id ?? null,
    selectedPaneId:
      activeWindow?.panes.find((pane) => pane.id === activePaneId)?.id ??
      activeWindow?.panes[0]?.id ??
      null,
  };
}

export function getRecoveredSelection(
  windows: WindowInfo[],
  previousSelection: Pick<SelectionState, "selectedWindowId" | "selectedPaneId">,
  activePaneId: string | null,
): SelectionState {
  const preservedPane =
    windows.find((window) =>
      window.panes.some((pane) => pane.id === previousSelection.selectedPaneId),
    ) ?? null;

  if (preservedPane) {
    return {
      selectedSessionName: null,
      selectedWindowId: preservedPane.id,
      selectedPaneId: previousSelection.selectedPaneId,
    };
  }

  const preservedWindow = getSelectedWindow(windows, previousSelection.selectedWindowId);
  if (preservedWindow?.panes[0]) {
    return {
      selectedSessionName: null,
      selectedWindowId: preservedWindow.id,
      selectedPaneId: preservedWindow.panes[0].id,
    };
  }

  return getInitialSelection(windows, activePaneId);
}

export function getPaneSubtitle(pane: PaneInfo | null): string {
  return pane ? [pane.cwd, pane.command].filter(Boolean).join(" • ") : "";
}
