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
const TABLET_FONT_SIZE = 13;
const PHONE_FONT_SIZE = 12;
const PHONE_NARROW_FONT_SIZE = 11;
export const MIN_FONT_SIZE = 4;
export const MAX_FONT_SIZE = 24;

export interface TerminalFontSizingInput {
  fontSize?: number | null;
  mountWidth: number;
  viewportWidth?: number;
}

export function getResponsiveTerminalFontSize(input: Omit<TerminalFontSizingInput, "fontSize">): number {
  const width = Math.max(0, Math.min(input.mountWidth || Infinity, input.viewportWidth || Infinity));
  let baseSize = DESKTOP_FONT_SIZE;

  if (width <= 0 || !Number.isFinite(width)) {
    return clampTerminalFontSize(baseSize);
  }

  if (width <= 380) {
    baseSize = PHONE_NARROW_FONT_SIZE;
  } else if (width <= 480) {
    baseSize = PHONE_FONT_SIZE;
  } else if (width <= 820) {
    baseSize = TABLET_FONT_SIZE;
  }

  return clampTerminalFontSize(baseSize);
}

export function resolveTerminalFontSize(input: TerminalFontSizingInput): number {
  if (typeof input.fontSize === "number" && Number.isFinite(input.fontSize)) {
    return clampTerminalFontSize(input.fontSize);
  }

  return getResponsiveTerminalFontSize(input);
}

export function getTerminalDimensions(terminal: Terminal): TerminalDimensions {
  return {
    cols: Math.max(MIN_COLS, terminal.cols),
    rows: Math.max(MIN_ROWS, terminal.rows),
  };
}

export function clampTerminalFontSize(size: number): number {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
}
