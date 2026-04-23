/**
 * tmuxhop terminal runtime loader.
 *
 * Purpose: lazy-load the xterm runtime so the main React application shell can
 * stay smaller and the heavy terminal code can ship in a separate chunk.
 *
 * Boundary: client-only. This module owns direct xterm runtime imports.
 */
import "@xterm/xterm/css/xterm.css";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import { TERMINAL_FONT_STACK } from "./font-diagnostics.js";

const terminalTheme = {
  background: "#111111",
  foreground: "#f2f2eb",
  cursor: "#f2f2eb",
} as const;

export interface LoadedTerminalRuntime {
  fitAddon: FitAddon;
  terminal: Terminal;
}

export function createTerminalRuntime(mount: HTMLElement): LoadedTerminalRuntime {
  const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: TERMINAL_FONT_STACK,
    fontSize: 14,
    scrollback: 5000,
    theme: terminalTheme,
  });
  const fitAddon = new FitAddon();

  terminal.loadAddon(fitAddon);
  terminal.open(mount);

  return {
    fitAddon,
    terminal,
  };
}
