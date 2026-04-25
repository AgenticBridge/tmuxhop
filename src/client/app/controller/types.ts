/**
 * tmuxhop app controller types.
 *
 * Purpose: define the controller contract and internal state shapes shared
 * across controller modules.
 *
 * Boundary: client-only type definitions for the app orchestration layer.
 */
import type { PathLevel, SessionSummary, WindowInfo } from "../../../server/protocol.js";
import type { FontCompatibilityReport } from "../../terminal/font-diagnostics.js";
import type { TerminalFontMode } from "../../terminal/settings.js";
import type { StatusState } from "../ui.js";

export interface AppController {
  fontMode: TerminalFontMode;
  fontReport: FontCompatibilityReport;
  selectedPaneId: string | null;
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedWindowPanes: WindowInfo["panes"];
  sessions: SessionSummary[];
  showApp: boolean;
  showControls: boolean;
  showEmptyState: boolean;
  status: StatusState;
  terminalMountRef: React.RefObject<HTMLDivElement | null>;
  terminalFontSize: number;
  windows: WindowInfo[];
  onDecreaseTerminalFontSize(): void;
  onReconnect(): void;
  onCreatePath(level: PathLevel, name: string): Promise<void>;
  onDeletePath(level: PathLevel): Promise<void>;
  onFontModeChange(mode: TerminalFontMode): void;
  onIncreaseTerminalFontSize(): void;
  onRenamePath(level: PathLevel, name: string): Promise<void>;
  onSelectPane(paneId: string): void;
  onSelectSession(sessionName: string): void;
  onSelectWindow(windowId: string): void;
  onShortcut(input: string): void;
  onTextInput(data: string): void;
  refreshFontReport(): void;
}

export interface LatestAppSelectionState {
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedPaneId: string | null;
  windows: WindowInfo[];
}
