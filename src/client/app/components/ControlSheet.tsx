/**
 * tmuxhop control sheet.
 *
 * Purpose: render the compact action shell for future session/window/pane
 * management actions.
 *
 * Boundary: client-only presentational component. It may manage transient
 * sheet form state, but mutation ownership stays with the app controller.
 */
import { useEffect, useMemo, useState } from "react";

import type { PathLevel } from "../../../server/protocol.js";
import type { NavScope } from "../ui.js";
import { formatScopeLabel, NAV_SCOPES } from "../ui.js";

export interface ControlSheetProps {
  availability: Record<PathLevel, boolean>;
  currentLabels: Record<PathLevel, string | null>;
  level: NavScope;
  onCreate(level: PathLevel, name: string): Promise<void>;
  onClose(): void;
  onDelete(level: PathLevel): Promise<void>;
  onLevelChange(level: NavScope): void;
  onRename(level: PathLevel, name: string): Promise<void>;
  open: boolean;
}

export function ControlSheet(props: ControlSheetProps) {
  const { availability, currentLabels, level, onClose, onCreate, onDelete, onLevelChange, onRename, open } = props;
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "rename" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const currentLabel = currentLabels[level] ?? null;
  const canCreate = availability[level];
  const canRename = currentLabel !== null;
  const canDelete = currentLabel !== null;

  useEffect(() => {
    if (!open) {
      setMode(null);
      setDraftName("");
      setError(null);
      setPending(false);
    }
  }, [open]);

  useEffect(() => {
    if (mode === "rename") {
      setDraftName(currentLabel ?? "");
    } else if (mode === "create") {
      setDraftName("");
    }
    setError(null);
  }, [currentLabel, level, mode]);

  const actionLabel = useMemo(() => {
    if (mode === "create") {
      return `Create ${formatLevelLabel(level)}`;
    }
    if (mode === "rename") {
      return `Rename ${formatLevelLabel(level)}`;
    }
    if (mode === "delete") {
      return `Delete ${formatLevelLabel(level)}`;
    }
    return "";
  }, [level, mode]);

  async function handleSubmit() {
    if (!mode) {
      return;
    }

    try {
      setPending(true);
      setError(null);
      if (mode === "create") {
        await onCreate(level, draftName.trim());
      } else if (mode === "rename") {
        await onRename(level, draftName.trim());
      } else {
        await onDelete(level);
      }
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`picker-sheet${open ? "" : " hidden"}`}>
      <button
        className="picker-sheet__backdrop"
        type="button"
        aria-label="Close controls"
        onClick={onClose}
      ></button>
      <section className="picker-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="control-sheet-title">
        <div className="picker-sheet__header">
          <p id="control-sheet-title" className="picker-sheet__title">
            Controls
          </p>
          <button className="ghost-link ghost-link--compact" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="control-sheet__content">
          <div className="control-sheet__field">
            <span className="control-sheet__label">{`Level: ${formatLevelLabel(level)}`}</span>
            <div className="control-sheet__levels" role="group" aria-label="Path levels">
              {NAV_SCOPES.map((scope) => (
                <button
                  key={scope}
                  className="tab-button control-sheet__level"
                  data-active={level === scope ? "true" : undefined}
                  type="button"
                  onClick={() => onLevelChange(scope as NavScope)}
                >
                  {currentLabels[scope] ?? formatScopeLabel(scope)}
                </button>
              ))}
            </div>
          </div>
          <p className="control-sheet__label">Action</p>
          <div className="control-sheet__actions" role="group" aria-label="Path actions">
            <button
              className="tab-button"
              type="button"
              disabled={!canCreate || pending}
              title="Add"
              onClick={() => setMode("create")}
            >
              +
            </button>
            <button
              className="tab-button"
              type="button"
              disabled={!canRename || pending}
              title="Rename"
              onClick={() => setMode("rename")}
            >
              ✎
            </button>
            <button
              className="tab-button"
              type="button"
              disabled={!canDelete || pending}
              title="Delete"
              onClick={() => setMode("delete")}
            >
              −
            </button>
          </div>
          {mode ? (
            <div className="control-sheet__editor">
              <p className="control-sheet__label">{actionLabel}</p>
              {mode === "delete" ? (
                <p className="control-sheet__hint">
                  Delete <strong>{currentLabel}</strong>? tmuxhop will switch to the next available target if one
                  exists.
                </p>
              ) : (
                <label className="control-sheet__field">
                  <span className="control-sheet__label">{`${formatLevelLabel(level)} name`}</span>
                  <input
                    className="control-sheet__input"
                    type="text"
                    value={draftName}
                    placeholder={`Enter ${formatLevelLabel(level).toLowerCase()} name`}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </label>
              )}
              {error ? <p className="control-sheet__error">{error}</p> : null}
              <div className="control-sheet__editor-actions">
                <button
                  className="tab-button"
                  type="button"
                  disabled={pending || (mode !== "delete" && draftName.trim().length === 0)}
                  onClick={() => {
                    void handleSubmit();
                  }}
                >
                  {pending ? "..." : mode === "delete" ? "Confirm" : "Save"}
                </button>
                <button
                  className="ghost-link ghost-link--compact"
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMode(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function formatLevelLabel(level: NavScope): string {
  switch (level) {
    case "sessions":
      return "Session";
    case "windows":
      return "Window";
    case "panes":
      return "Pane";
  }
}
