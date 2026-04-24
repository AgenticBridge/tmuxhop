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
    if (!draft) {
      return;
    }

    onTextInput(draft);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendDraft();
  }

  return (
    <footer id="controls" className={`control-bar${showControls ? "" : " hidden"}`}>
      <form className="control-bar__text-entry" onSubmit={handleSubmit}>
        <input
          aria-label="Mobile terminal input"
          className="control-bar__text-input"
          placeholder="Type for terminal"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="control-bar__text-button" type="submit">
          Run
        </button>
      </form>

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
