/**
 * tmuxhop warning sheet.
 *
 * Purpose: render warning details for utility-bar issues like font and
 * connection problems.
 *
 * Boundary: client-only presentational component. It should stay free of
 * controller state and backend effects.
 */
import type { FontCompatibilityReport } from "../../terminal/font-diagnostics.js";
import type { StatusState } from "../ui.js";

export interface WarningSheetProps {
  fontReport: FontCompatibilityReport;
  onClose(): void;
  onRefreshFont(): void;
  open: boolean;
  status: StatusState;
}

export function WarningSheet(props: WarningSheetProps) {
  const { fontReport, onClose, onRefreshFont, open, status } = props;
  const hasFontWarning = fontReport.status === "warn";
  const hasConnectionWarning = status.tone === "error";

  return (
    <div className={`picker-sheet${open ? "" : " hidden"}`}>
      <button
        className="picker-sheet__backdrop"
        type="button"
        aria-label="Close warnings"
        onClick={onClose}
      ></button>
      <section className="picker-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="warning-sheet-title">
        <div className="picker-sheet__header">
          <p id="warning-sheet-title" className="picker-sheet__title">
            Warnings
          </p>
          <button className="ghost-link ghost-link--compact" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="warning-sheet__content">
          {hasConnectionWarning ? (
            <article className="warning-card" data-tone={status.tone}>
              <p className="warning-card__title">Connection</p>
              <p className="warning-card__details">{status.label}</p>
            </article>
          ) : null}
          {hasFontWarning ? (
            <article className="warning-card" data-tone={fontReport.status}>
              <div className="warning-card__header">
                <p className="warning-card__title">Font</p>
                <button
                  className="ghost-link ghost-link--compact"
                  type="button"
                  onClick={onRefreshFont}
                >
                  Recheck
                </button>
              </div>
              <p className="warning-card__details">
                {fontReport.recommendedFonts.length === 0
                  ? fontReport.details
                  : `${fontReport.details} Try one of: ${fontReport.recommendedFonts.join(", ")}.`}
              </p>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
