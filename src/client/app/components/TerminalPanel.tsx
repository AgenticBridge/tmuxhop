/**
 * PaneHop terminal panel.
 *
 * Purpose: render the terminal mount region without owning terminal runtime
 * behavior.
 *
 * Boundary: client-only presentational component.
 */
import type { RefObject } from "react";

export interface TerminalPanelProps {
  mountRef: RefObject<HTMLDivElement | null>;
}

export function TerminalPanel(props: TerminalPanelProps) {
  const { mountRef } = props;

  return (
    <section className="terminal-panel">
      <div id="terminal" ref={mountRef} className="terminal-mount"></div>
    </section>
  );
}
