/**
 * PaneHop terminal sizing helpers.
 *
 * Purpose: read the fitted xterm row and column counts after the browser has
 * laid out the viewport and keep the server-side tmux client in sync.
 *
 * Boundary: client-only. This module is terminal-specific and may depend on
 * the xterm terminal instance, but must not import server runtime code.
 */
import type { Terminal } from "@xterm/xterm";

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

const MIN_COLS = 20;
const MIN_ROWS = 8;

export function getTerminalDimensions(terminal: Terminal): TerminalDimensions {
  return {
    cols: Math.max(MIN_COLS, terminal.cols),
    rows: Math.max(MIN_ROWS, terminal.rows),
  };
}
