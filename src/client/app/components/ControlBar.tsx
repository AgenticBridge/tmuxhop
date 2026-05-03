/**
 * tmuxhop terminal control bar.
 *
 * Purpose: render mobile-friendly terminal shortcut buttons below the terminal.
 *
 * Boundary: client-only presentational component. Button semantics come from
 * app-owned UI definitions.
 */
import { useState, type FormEvent } from "react";

import type { ControlButtonDefinition } from "../ui.js";

export interface ControlBarProps {
  controls: ControlButtonDefinition[];
  onShortcut(input: string): void;
  onTextInput(data: string): void;
  showControls: boolean;
}

export function ControlBar(props: ControlBarProps) {
  const { controls, onShortcut, onTextInput, showControls } = props;
  const [draft, setDraft] = useState("");

  function sendDraft() {
    if (!draft.trim()) {
      return;
    }

    onTextInput(draft);
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+Enter or Cmd+Enter or Alt+Enter to submit
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey || event.altKey)) {
      event.preventDefault();
      sendDraft();
    }
    // Enter alone does nothing (allows new line)
  }

  return (
    <footer id="controls" className={`control-bar${showControls ? "" : " hidden"}`}>
      <div className="control-bar__text-entry">
        <textarea
          aria-label="Mobile terminal input"
          className="control-bar__text-input"
          placeholder="Type for terminal (Ctrl/Cmd/Alt+Enter to send)"
          value={draft}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="control-bar__text-button" type="button" onClick={sendDraft}>
          Send
        </button>
      </div>

      <div className="control-bar__shortcuts">
        {controls.map((definition) => (
          <button
            key={`${definition.label}:${definition.input}`}
            type="button"
            title={definition.title}
            aria-label={definition.title}
            onClick={() => onShortcut(definition.input)}
          >
            {definition.label}
          </button>
        ))}
      </div>
    </footer>
  );
}
