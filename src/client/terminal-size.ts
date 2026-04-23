/**
 * PaneHop terminal sizing helpers.
 *
 * Purpose: derive browser terminal row and column counts from the rendered
 * xterm viewport and keep the server-side tmux client in sync.
 *
 * Boundary: client-only. This module may depend on browser layout data and the
 * xterm terminal instance, but must not import server runtime code.
 */
import type { Terminal } from "@xterm/xterm";

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

interface TerminalWithPrivateCore extends Terminal {
  _core?: {
    _renderService?: {
      dimensions?: {
        css?: {
          cell?: {
            width?: number;
            height?: number;
          };
        };
      };
    };
  };
}

const MIN_COLS = 20;
const MIN_ROWS = 8;

export function getTerminalDimensions(
  terminal: Terminal,
  mount: HTMLElement,
): TerminalDimensions {
  const cell = getTerminalCellDimensions(terminal);
  const bounds = mount.getBoundingClientRect();
  const horizontalPadding = getElementPadding(mount, "horizontal");
  const verticalPadding = getElementPadding(mount, "vertical");

  const availableWidth = Math.max(0, bounds.width - horizontalPadding);
  const availableHeight = Math.max(0, bounds.height - verticalPadding);

  return {
    cols: Math.max(MIN_COLS, Math.floor(availableWidth / cell.width)),
    rows: Math.max(MIN_ROWS, Math.floor(availableHeight / cell.height)),
  };
}

function getTerminalCellDimensions(terminal: Terminal): { width: number; height: number } {
  const privateCore = terminal as TerminalWithPrivateCore;
  const width = privateCore._core?._renderService?.dimensions?.css?.cell?.width ?? 0;
  const height = privateCore._core?._renderService?.dimensions?.css?.cell?.height ?? 0;

  if (width > 0 && height > 0) {
    return { width, height };
  }

  return {
    width: 8.4,
    height: 17,
  };
}

function getElementPadding(
  element: HTMLElement,
  axis: "horizontal" | "vertical",
): number {
  const styles = window.getComputedStyle(element);

  if (axis === "horizontal") {
    return (
      Number.parseFloat(styles.paddingLeft || "0") +
      Number.parseFloat(styles.paddingRight || "0")
    );
  }

  return (
    Number.parseFloat(styles.paddingTop || "0") +
    Number.parseFloat(styles.paddingBottom || "0")
  );
}
