/**
 * tmuxhop terminal control bar.
 *
 * Purpose: render mobile-friendly terminal shortcut buttons below the terminal.
 *
 * Boundary: client-only presentational component. Button semantics come from
 * app-owned UI definitions.
 */
import type { ControlButtonDefinition } from "../ui.js";

export interface ControlBarProps {
  controls: ControlButtonDefinition[];
  onShortcut(input: string): void;
  showControls: boolean;
}

export function ControlBar(props: ControlBarProps) {
  const { controls, onShortcut, showControls } = props;

  return (
    <footer id="controls" className={`control-bar${showControls ? "" : " hidden"}`}>
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
    </footer>
  );
}
