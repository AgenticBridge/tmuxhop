/**
 * PaneHop backend protocol definitions.
 *
 * Purpose: define the canonical HTTP and WebSocket shapes emitted and accepted
 * by the backend.
 *
 * Boundary: server-owned contract. The client may consume these types, but the
 * backend is the source of truth for all wire-level structures.
 */
export interface PaneInfo {
  id: string;
  windowId: string;
  index: number;
  active: boolean;
  title: string;
  cwd: string;
  command: string;
}

export interface WindowInfo {
  id: string;
  index: number;
  name: string;
  active: boolean;
  panes: PaneInfo[];
}

export interface SessionState {
  exists: boolean;
  sessionName: string;
  windows: WindowInfo[];
  activePaneId: string | null;
}

export interface SessionResponse {
  exists: boolean;
  sessionName: string;
  localOnly: boolean;
  activePaneId: string | null;
}

export interface WindowsResponse extends SessionState {}

export interface SessionSummary {
  name: string;
  attached: boolean;
  windows: number;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
  defaultSessionName: string | null;
}

export type ClientSocketMessage =
  | { type: "input"; data: string }
  | { type: "shortcut"; data: string }
  | { type: "resize"; cols: number; rows: number };

export type ServerSocketMessage =
  | { type: "snapshot"; paneId: string; content: string }
  | { type: "data"; paneId: string; data: string }
  | { type: "error"; message: string };
