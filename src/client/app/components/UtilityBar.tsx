/**
 * tmuxhop utility bar.
 *
 * Purpose: render the compact top utility row with navigation, connection, and
 * quick terminal status actions.
 *
 * Boundary: client-only presentational component. It should stay free of data
 * fetching and transport side effects.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import type { PathLevel, SessionSummary, WindowInfo } from "../../../server/protocol.js";
import type { FontCompatibilityReport } from "../../terminal/font-diagnostics.js";
import type { TerminalFontMode } from "../../terminal/settings.js";
import type { NavScope, StatusState } from "../ui.js";
import { ControlSheet } from "./ControlSheet.js";
import { WarningSheet } from "./WarningSheet.js";

type PickerScope = "sessions" | "windows" | "panes";

export interface UtilityBarProps {
  fontMode?: TerminalFontMode;
  fontReport: FontCompatibilityReport;
  onCreatePath(level: PathLevel, name: string): Promise<void>;
  onDeletePath(level: PathLevel): Promise<void>;
  onFontModeChange?(mode: TerminalFontMode): void;
  onReconnect(): void;
  onRefreshFontReport(): void;
  onRenamePath(level: PathLevel, name: string): Promise<void>;
  onSelectPane(paneId: string): void;
  onSelectSession(sessionName: string): void;
  onSelectWindow(windowId: string): void;
  selectedPaneId: string | null;
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedWindowPanes: WindowInfo["panes"];
  sessions: SessionSummary[];
  status: StatusState;
  windows: WindowInfo[];
}

export function UtilityBar(props: UtilityBarProps) {
  const {
    fontMode = "bundled",
    fontReport,
    onCreatePath,
    onDeletePath,
    onFontModeChange = () => {},
    onReconnect,
    onRefreshFontReport,
    onRenamePath,
    onSelectPane,
    onSelectSession,
    onSelectWindow,
    selectedPaneId,
    selectedSessionName,
    selectedWindowId,
    selectedWindowPanes,
    sessions,
    status,
    windows,
  } = props;
  const [openPicker, setOpenPicker] = useState<PickerScope | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [controlLevel, setControlLevel] = useState<NavScope>("sessions");
  const barRef = useRef<HTMLElement | null>(null);
  const pathRef = useRef<HTMLElement | null>(null);
  const rightGroupRef = useRef<HTMLDivElement | null>(null);
  const [pathCharacterBudget, setPathCharacterBudget] = useState(6);

  const selectedWindow = useMemo(
    () => windows.find((window) => window.id === selectedWindowId) ?? null,
    [windows, selectedWindowId],
  );
  const selectedPane = useMemo(
    () => selectedWindowPanes.find((pane) => pane.id === selectedPaneId) ?? null,
    [selectedPaneId, selectedWindowPanes],
  );

  const pickerOptions = getPickerOptions({
    openPicker,
    selectedPaneId,
    selectedSessionName,
    selectedWindowId,
    selectedWindowPanes,
    sessions,
    windows,
  });
  const pickerTitle =
    openPicker === "sessions"
      ? "Sessions"
      : openPicker === "windows"
        ? "Windows"
        : openPicker === "panes"
          ? "Panes"
          : "";
  const hasWarning = fontReport.status === "warn" || status.tone === "error";

  useEffect(() => {
    const barElement = barRef.current;
    const pathElement = pathRef.current;
    const rightElement = rightGroupRef.current;
    if (!barElement || !pathElement || !rightElement) {
      return;
    }

    const updateBudget = () => {
      const availableWidth =
        barElement.getBoundingClientRect().width -
        rightElement.getBoundingClientRect().width -
        56;
      setPathCharacterBudget(getResponsivePathCharacterBudget(availableWidth));
    };

    updateBudget();
    const ResizeObserverCtor = window.ResizeObserver;
    const resizeObserver =
      typeof ResizeObserverCtor === "function"
        ? new ResizeObserverCtor(() => {
            updateBudget();
          })
        : null;

    resizeObserver?.observe(barElement);
    resizeObserver?.observe(pathElement);
    resizeObserver?.observe(rightElement);
    window.addEventListener("resize", updateBudget);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateBudget);
    };
  }, []);

  return (
    <>
      <header ref={barRef} className="utility-bar">
        <div className="utility-group utility-group--path">
          <a className="logo-button" href="/" aria-label="Back to home">
            ←
          </a>
          <span
            id="connection-status"
            className="status-dot"
            data-tone={status.tone}
            role="status"
            aria-label={status.label}
            title={status.label}
          ></span>
          <nav ref={pathRef} className="utility-path" aria-label="Current tmux location">
            <button
              id="session-title"
              className="utility-path__segment"
              type="button"
              onClick={() => setOpenPicker("sessions")}
            >
              {truncatePathLabel(selectedSessionName ?? "Session", pathCharacterBudget)}
            </button>
            <span className="utility-path__separator">&gt;</span>
            <button
              className="utility-path__segment"
              type="button"
              disabled={!windows.length}
              onClick={() => setOpenPicker("windows")}
            >
              {truncatePathLabel(
                selectedWindow ? `${selectedWindow.index}: ${selectedWindow.name}` : "Window",
                pathCharacterBudget,
              )}
            </button>
            <span className="utility-path__separator">&gt;</span>
            <button
              className="utility-path__segment"
              type="button"
              disabled={!selectedWindowPanes.length}
              onClick={() => setOpenPicker("panes")}
            >
              {truncatePathLabel(
                selectedPane?.title || `Pane ${selectedPane?.index ?? ""}`.trim(),
                pathCharacterBudget,
              )}
            </button>
          </nav>
        </div>
        <div ref={rightGroupRef} className="utility-group utility-group--right">
          <button
            id="warning-button"
            className="ghost-link ghost-link--compact utility-icon-button"
            type="button"
            aria-label="Warnings"
            aria-expanded={warningOpen}
            disabled={!hasWarning}
            data-warning={hasWarning ? "true" : "false"}
            title={hasWarning ? "Warnings" : "No warnings"}
            onClick={() => setWarningOpen(true)}
          >
            ⚠
          </button>
          <button
            id="control-button"
            className="ghost-link ghost-link--compact utility-icon-button"
            type="button"
            aria-label="Controls"
            aria-expanded={controlOpen}
            title="Controls"
            onClick={() => setControlOpen(true)}
          >
            ⚙
          </button>
          <button
            id="reconnect-button"
            className="ghost-link ghost-link--compact"
            type="button"
            aria-label="Reconnect"
            title="Reconnect"
            onClick={onReconnect}
          >
            ↻
          </button>
        </div>
      </header>

      <div className={`picker-sheet${openPicker ? "" : " hidden"}`}>
        <button
          className="picker-sheet__backdrop"
          type="button"
          aria-label="Close picker"
          onClick={() => setOpenPicker(null)}
        ></button>
        <section className="picker-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="picker-title">
          <div className="picker-sheet__header">
            <p id="picker-title" className="picker-sheet__title">
              {pickerTitle}
            </p>
            <button
              className="ghost-link ghost-link--compact"
              type="button"
              onClick={() => setOpenPicker(null)}
            >
              Close
            </button>
          </div>
          <div className="picker-sheet__options">
            {pickerOptions.map((option) => (
              <button
                key={option.value}
                className="picker-sheet__option"
                data-active={option.active ? "true" : undefined}
                type="button"
                onClick={() => {
                  if (openPicker === "sessions") {
                    onSelectSession(option.value);
                  } else if (openPicker === "windows") {
                    onSelectWindow(option.value);
                  } else if (openPicker === "panes") {
                    onSelectPane(option.value);
                  }
                  setOpenPicker(null);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <WarningSheet
        fontReport={fontReport}
        onClose={() => setWarningOpen(false)}
        onRefreshFont={() => {
          onRefreshFontReport();
        }}
        open={warningOpen}
        status={status}
      />

      <ControlSheet
        availability={{
          sessions: true,
          windows: selectedSessionName !== null,
          panes: selectedWindow !== null,
        }}
        currentLabels={{
          sessions: selectedSessionName,
          windows: selectedWindow?.name ?? null,
          panes: selectedPane?.title ?? null,
        }}
        fontMode={fontMode}
        level={controlLevel}
        onCreate={onCreatePath}
        onClose={() => setControlOpen(false)}
        onDelete={onDeletePath}
        onFontModeChange={onFontModeChange}
        onLevelChange={setControlLevel}
        onRename={onRenamePath}
        open={controlOpen}
      />
    </>
  );
}

export function truncatePathLabel(value: string, maxCharacters: number): string {
  const trimmed = value.trim();
  const clampedLength = Math.max(3, Math.floor(maxCharacters));
  if (trimmed.length <= clampedLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, clampedLength)}…`;
}

export function getResponsivePathCharacterBudget(availableWidth: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return 3;
  }

  const segmentWidth = Math.max(24, (availableWidth - 20) / 3);
  const estimatedCharacters = Math.floor((segmentWidth - 8) / 9);
  return Math.max(3, Math.min(32, estimatedCharacters));
}

function getPickerOptions(input: {
  openPicker: PickerScope | null;
  selectedPaneId: string | null;
  selectedSessionName: string | null;
  selectedWindowId: string | null;
  selectedWindowPanes: WindowInfo["panes"];
  sessions: SessionSummary[];
  windows: WindowInfo[];
}) {
  const {
    openPicker,
    selectedPaneId,
    selectedSessionName,
    selectedWindowId,
    selectedWindowPanes,
    sessions,
    windows,
  } = input;

  if (openPicker === "sessions") {
    return sessions.map((session) => ({
      value: session.name,
      label: session.name,
      active: session.name === selectedSessionName,
    }));
  }

  if (openPicker === "windows") {
    return windows.map((window) => ({
      value: window.id,
      label: `${window.index}: ${window.name}`,
      active: window.id === selectedWindowId,
    }));
  }

  if (openPicker === "panes") {
    return selectedWindowPanes.map((pane) => ({
      value: pane.id,
      label: pane.title || `Pane ${pane.index}`,
      active: pane.id === selectedPaneId,
    }));
  }

  return [];
}
