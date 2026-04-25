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
const PHONE_FONT_SIZE = 7;
const PHONE_NARROW_FONT_SIZE = 6;
const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 24;

export interface TerminalFontSizingInput {
  adjustment?: number;
  mountWidth: number;
  viewportWidth?: number;
}

export function getPreferredTerminalFontSize(input: TerminalFontSizingInput): number {
  const width = Math.max(0, Math.min(input.mountWidth || Infinity, input.viewportWidth || Infinity));
  const adjustment = Math.trunc(input.adjustment ?? 0);
  let baseSize = DESKTOP_FONT_SIZE;

  if (width <= 0 || !Number.isFinite(width)) {
    return clampTerminalFontSize(baseSize + adjustment);
  }

  if (width <= 380) {
    baseSize = PHONE_NARROW_FONT_SIZE;
  } else if (width <= 480) {
    baseSize = PHONE_FONT_SIZE;
  } else if (width <= 820) {
    baseSize = TABLET_FONT_SIZE;
  }

  return clampTerminalFontSize(baseSize + adjustment);
}

export function getTerminalDimensions(terminal: Terminal): TerminalDimensions {
  return {
    cols: Math.max(MIN_COLS, terminal.cols),
    rows: Math.max(MIN_ROWS, terminal.rows),
  };
}

function clampTerminalFontSize(size: number): number {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
}
