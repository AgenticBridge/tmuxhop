/**
 * tmuxhop terminal lifecycle hook.
 *
 * Purpose: own xterm runtime loading, mount lifecycle, browser resize
 * observation, and terminal read/write helpers for the app shell.
 *
 * Boundary: client-only. This hook may depend on terminal-specific helpers but
 * must stay free of backend transport concerns.
 */
import { useEffect, useRef } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";

import { getTerminalDimensions, type TerminalDimensions } from "../../terminal/size.js";

export interface UseTerminalOptions {
  onInput(data: string): void;
  onReady?(): void | Promise<void>;
}

export interface UseTerminalResult {
  mountRef: React.RefObject<HTMLDivElement | null>;
  getCurrentTerminalSize(): TerminalDimensions | null;
  syncTerminalSize(): void;
  resetTerminal(): void;
  writeToTerminal(data: string): void;
}

export function useTerminal(options: UseTerminalOptions): UseTerminalResult {
  const { onInput, onReady } = options;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastResizeRef = useRef<TerminalDimensions | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const handleWindowResize = () => {
      syncTerminalSize();
    };

    void (async () => {
      const { createTerminalRuntime } = await import("../../terminal/runtime.js");
      if (cancelled) {
        return;
      }

      const { terminal, fitAddon } = createTerminalRuntime(mount);
      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      terminal.onData(onInput);

      resizeObserver = new ResizeObserver(() => {
        syncTerminalSize();
      });
      resizeObserver.observe(mount);

      window.addEventListener("resize", handleWindowResize);

      await onReady?.();
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      lastResizeRef.current = null;
    };
  }, [onInput, onReady]);

  function getCurrentTerminalSize(): TerminalDimensions | null {
    if (!terminalRef.current || !fitAddonRef.current) {
      return null;
    }

    fitAddonRef.current.fit();
    return getTerminalDimensions(terminalRef.current);
  }

  function syncTerminalSize() {
    const dimensions = getCurrentTerminalSize();
    if (!dimensions || !terminalRef.current) {
      return;
    }

    const previous = lastResizeRef.current;
    if (previous?.cols === dimensions.cols && previous.rows === dimensions.rows) {
      return;
    }

    lastResizeRef.current = dimensions;
    terminalRef.current.resize(dimensions.cols, dimensions.rows);
  }

  function resetTerminal() {
    terminalRef.current?.reset();
    lastResizeRef.current = null;
  }

  function writeToTerminal(data: string) {
    terminalRef.current?.write(data);
  }

  return {
    mountRef,
    getCurrentTerminalSize,
    syncTerminalSize,
    resetTerminal,
    writeToTerminal,
  };
}
