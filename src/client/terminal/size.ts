/**
 * tmuxhop terminal sizing helpers.
 *
 * Purpose: choose a compact browser terminal density for smaller mobile/tablet
 * screens, then read the fitted xterm row and column counts after layout so
 * the server-side tmux client can stay in sync.
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
const DESKTOP_FONT_SIZE = 14;
const TABLET_FONT_SIZE = 11;
const PHONE_FONT_SIZE = 8;
const PHONE_NARROW_FONT_SIZE = 7;

export interface TerminalFontSizingInput {
  mountWidth: number;
  viewportWidth?: number;
}

export function getPreferredTerminalFontSize(input: TerminalFontSizingInput): number {
  const width = Math.max(0, Math.min(input.mountWidth || Infinity, input.viewportWidth || Infinity));

  if (width <= 0 || !Number.isFinite(width)) {
    return DESKTOP_FONT_SIZE;
  }

  if (width <= 380) {
    return PHONE_NARROW_FONT_SIZE;
  }

  if (width <= 480) {
    return PHONE_FONT_SIZE;
  }

  if (width <= 820) {
    return TABLET_FONT_SIZE;
  }

  return DESKTOP_FONT_SIZE;
}

export function getTerminalDimensions(terminal: Terminal): TerminalDimensions {
  return {
    cols: Math.max(MIN_COLS, terminal.cols),
    rows: Math.max(MIN_ROWS, terminal.rows),
  };
}
