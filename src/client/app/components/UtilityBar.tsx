/**
 * tmuxhop utility bar.
 *
 * Purpose: render the compact top utility row with navigation, connection, and
 * quick terminal status actions.
 *
 * Boundary: client-only presentational component. It should stay free of data
 * fetching and transport side effects.
 */
import type { FontCompatibilityReport } from "../../terminal/font-diagnostics.js";
import type { StatusState } from "../ui.js";

export interface UtilityBarProps {
  fontModalOpen: boolean;
  fontReport: FontCompatibilityReport;
  onReconnect(): void;
  onToggleFontModal(): void;
  sessionTitle: string;
  status: StatusState;
}

export function UtilityBar(props: UtilityBarProps) {
  const { fontModalOpen, fontReport, onReconnect, onToggleFontModal, sessionTitle, status } = props;

  return (
    <header className="utility-bar">
      <div className="utility-group">
        <a className="logo-button" href="/" aria-label="Back to home">
          ←
        </a>
        <span id="session-title" className="session-chip">
          {sessionTitle}
        </span>
      </div>
      <div className="utility-group utility-group--right">
        <span
          id="connection-status"
          className="status-pill status-pill--compact"
          data-tone={status.tone}
        >
          {status.label}
        </span>
        <button
          id="font-status"
          className="status-pill status-pill--compact"
          data-tone={fontReport.status}
          type="button"
          aria-label={
            fontReport.status === "ok"
              ? "Font support looks good"
              : "Font support needs attention"
          }
          aria-expanded={fontModalOpen}
          onClick={onToggleFontModal}
        >
          Font
        </button>
        <button
          id="reconnect-button"
          className="ghost-link ghost-link--compact"
          type="button"
          onClick={onReconnect}
        >
          Reconnect
        </button>
      </div>
    </header>
  );
}
