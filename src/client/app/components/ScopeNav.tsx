/**
 * PaneHop scope navigation.
 *
 * Purpose: render the two-level session/window/pane navigator above the
 * terminal.
 *
 * Boundary: client-only presentational component. Selection decisions are
 * passed in from the app shell.
 */
import type { SessionSummary, WindowInfo } from "../../../server/protocol.js";
import { NAV_SCOPES, formatScopeLabel, type NavScope } from "../ui.js";

export interface ScopeNavProps {
  navScope: NavScope;
  onSelectNavScope(scope: NavScope): void;
  onSelectPane(paneId: string): void;
  onSelectSession(sessionName: string): void;
  onSelectWindow(windowId: string): void;
  selectedPaneId: string | null;
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedWindowPanes: WindowInfo["panes"];
  sessions: SessionSummary[];
  windows: WindowInfo[];
}

export function ScopeNav(props: ScopeNavProps) {
  const {
    navScope,
    onSelectNavScope,
    onSelectPane,
    onSelectSession,
    onSelectWindow,
    selectedPaneId,
    selectedSessionName,
    selectedWindowId,
    selectedWindowPanes,
    sessions,
    windows,
  } = props;

  return (
    <nav className="nav-strip">
      <div className="nav-tier">
        <p className="nav-label">Browser</p>
        <div id="scope-tabs" className="tab-row">
          {NAV_SCOPES.map((scope) => (
            <button
              key={scope}
              className="tab-button tab-button--compact"
              data-active={scope === navScope ? "true" : undefined}
              type="button"
              onClick={() => onSelectNavScope(scope)}
            >
              {formatScopeLabel(scope)}
            </button>
          ))}
        </div>
      </div>
      <div className="nav-tier">
        <p id="option-label" className="nav-label">
          {formatScopeLabel(navScope)}
        </p>
        <div id="option-tabs" className="tab-row">
          {navScope === "sessions" &&
            sessions.map((session) => (
              <button
                key={session.name}
                className="tab-button"
                data-active={session.name === selectedSessionName ? "true" : undefined}
                type="button"
                onClick={() => onSelectSession(session.name)}
              >
                {session.name}
                {session.attached ? " • attached" : ""}
              </button>
            ))}
          {navScope === "windows" &&
            windows.map((window) => (
              <button
                key={window.id}
                className="tab-button"
                data-active={window.id === selectedWindowId ? "true" : undefined}
                type="button"
                onClick={() => onSelectWindow(window.id)}
              >
                {window.index}: {window.name}
              </button>
            ))}
          {navScope === "panes" &&
            selectedWindowPanes.map((pane) => (
              <button
                key={pane.id}
                className="tab-button"
                data-active={pane.id === selectedPaneId ? "true" : undefined}
                type="button"
                onClick={() => onSelectPane(pane.id)}
              >
                {pane.title || `Pane ${pane.index}`}
              </button>
            ))}
        </div>
      </div>
    </nav>
  );
}
