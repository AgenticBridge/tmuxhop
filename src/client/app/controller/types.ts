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
import type { NavScope, StatusState } from "../ui.js";

export interface AppController {
  fontModalOpen: boolean;
  fontMode: TerminalFontMode;
  fontReport: FontCompatibilityReport;
  navScope: NavScope;
  selectedPaneId: string | null;
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedWindowPanes: WindowInfo["panes"];
  sessionTitle: string;
  sessions: SessionSummary[];
  showApp: boolean;
  showControls: boolean;
  showEmptyState: boolean;
  status: StatusState;
  terminalMountRef: React.RefObject<HTMLDivElement | null>;
  windows: WindowInfo[];
  closeFontModal(): void;
  onReconnect(): void;
  onCreatePath(level: PathLevel, name: string): Promise<void>;
  onDeletePath(level: PathLevel): Promise<void>;
  onFontModeChange(mode: TerminalFontMode): void;
  onRenamePath(level: PathLevel, name: string): Promise<void>;
  onSelectNavScope(scope: NavScope): void;
  onSelectPane(paneId: string): void;
  onSelectSession(sessionName: string): void;
  onSelectWindow(windowId: string): void;
  onShortcut(input: string): void;
  onTextInput(data: string): void;
  refreshFontReport(): void;
  toggleFontModal(): void;
}

export interface LatestAppSelectionState {
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedPaneId: string | null;
  windows: WindowInfo[];
}
