/**
 * PaneHop font status modal.
 *
 * Purpose: render the higher-level modal that explains terminal font coverage
 * and offers a refresh action.
 *
 * Boundary: client-only presentational component. It should not run font
 * detection itself.
 */
import {
  FONT_PROBE_SAMPLE,
  type FontCompatibilityReport,
} from "../../terminal/font-diagnostics.js";

export interface FontStatusModalProps {
  fontModalOpen: boolean;
  fontReport: FontCompatibilityReport;
  onClose(): void;
  onRefresh(): void;
}

export function FontStatusModal(props: FontStatusModalProps) {
  const { fontModalOpen, fontReport, onClose, onRefresh } = props;

  return (
    <div
      id="font-check"
      className={`font-modal${fontModalOpen ? "" : " hidden"}`}
      data-tone={fontReport.status}
    >
      <div className="font-backdrop" onClick={onClose}></div>
      <section className="font-popover" role="dialog" aria-modal="true" aria-labelledby="font-check-headline">
        <div>
          <p className="nav-label">Font Check</p>
          <p id="font-check-headline" className="font-check-headline">
            {fontReport.headline}
          </p>
          <p id="font-check-details" className="font-check-details">
            {fontReport.recommendedFonts.length === 0
              ? fontReport.details
              : `${fontReport.details} Install one of: ${fontReport.recommendedFonts.join(", ")}.`}
          </p>
        </div>
        <div className="font-check-actions">
          <code id="font-check-sample" className="font-check-sample">
            {FONT_PROBE_SAMPLE}
          </code>
          <div className="font-popover-actions">
            <button
              id="font-check-refresh"
              className="tab-button"
              type="button"
              onClick={onRefresh}
            >
              Recheck
            </button>
            <button
              id="font-check-close"
              className="ghost-link ghost-link--compact"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
