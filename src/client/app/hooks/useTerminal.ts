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

import { ensureBundledTerminalFontReady } from "../../terminal/font-diagnostics.js";
import { terminalFontModeNeedsBundledAsset, type TerminalFontMode } from "../../terminal/settings.js";
import {
  getPreferredTerminalFontSize,
  getTerminalDimensions,
  type TerminalDimensions,
} from "../../terminal/size.js";

export interface UseTerminalOptions {
  fontFamily: string;
  fontSizeAdjustment: number;
  fontMode: TerminalFontMode;
  onInput(data: string): void;
  onResolvedFontSizeChange?(fontSize: number): void;
  onTerminalSizeChange?(dimensions: TerminalDimensions): void;
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
  const {
    fontFamily,
    fontMode,
    fontSizeAdjustment,
    onInput,
    onReady,
    onResolvedFontSizeChange,
    onTerminalSizeChange,
  } = options;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastResizeRef = useRef<TerminalDimensions | null>(null);
  const latestFontSettingsRef = useRef({
    fontFamily,
    fontMode,
    fontSizeAdjustment,
  });

  latestFontSettingsRef.current = {
    fontFamily,
    fontMode,
    fontSizeAdjustment,
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let activeViewportAssistCleanup: (() => void) | null = null;

    const handleWindowResize = () => {
      syncTerminalSize();
    };

    void (async () => {
      const startupSettings = latestFontSettingsRef.current;
      const fontReadyPromise = terminalFontModeNeedsBundledAsset(startupSettings.fontMode)
        ? ensureBundledTerminalFontReady()
        : Promise.resolve();
      await Promise.race([fontReadyPromise, waitForStartupFontBudget()]);
      if (cancelled) {
        return;
      }

      const { createTerminalRuntime } = await import("../../terminal/runtime.js");
      if (cancelled) {
        return;
      }

      const runtimeSettings = latestFontSettingsRef.current;
      const { terminal, fitAddon } = createTerminalRuntime(mount, {
        fontFamily: runtimeSettings.fontFamily,
        fontSizeAdjustment: runtimeSettings.fontSizeAdjustment,
      });
      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      terminal.onData(onInput);
      activeViewportAssistCleanup = installTerminalViewportAssist(mount);
      onResolvedFontSizeChange?.(terminal.options.fontSize as number);

      resizeObserver = new ResizeObserver(() => {
        syncTerminalSize();
      });
      resizeObserver.observe(mount);

      window.addEventListener("resize", handleWindowResize);

      void fontReadyPromise.then(() => {
        if (cancelled) {
          return;
        }

        syncTerminalSize();
      });

      await onReady?.();
    })();

    return () => {
      cancelled = true;
      activeViewportAssistCleanup?.();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      lastResizeRef.current = null;
    };
  }, [onInput, onReady, onResolvedFontSizeChange]);

  useEffect(() => {
    const mount = mountRef.current;
    const terminal = terminalRef.current;
    if (!mount || !terminal) {
      return;
    }

    let cancelled = false;

    void (async () => {
      if (terminalFontModeNeedsBundledAsset(fontMode)) {
        await ensureBundledTerminalFontReady();
      }
      if (cancelled) {
        return;
      }

      terminal.options.fontFamily = fontFamily;
      syncTerminalFontSize(terminal, mount, fontSizeAdjustment, onResolvedFontSizeChange);
      fitAddonRef.current?.fit();
      lastResizeRef.current = null;
      syncTerminalSize();
    })();

    return () => {
      cancelled = true;
    };
  }, [fontFamily, fontMode, fontSizeAdjustment, onResolvedFontSizeChange]);

  function getCurrentTerminalSize(): TerminalDimensions | null {
    if (!terminalRef.current || !fitAddonRef.current || !mountRef.current) {
      return null;
    }

    syncTerminalFontSize(
      terminalRef.current,
      mountRef.current,
      latestFontSettingsRef.current.fontSizeAdjustment,
      onResolvedFontSizeChange,
    );
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
    onTerminalSizeChange?.(dimensions);
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

function waitForStartupFontBudget() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 250);
  });
}

function syncTerminalFontSize(
  terminal: Terminal,
  mount: HTMLDivElement,
  fontSizeAdjustment: number,
  onResolvedFontSizeChange?: (fontSize: number) => void,
) {
  const nextFontSize = getPreferredTerminalFontSize({
    adjustment: fontSizeAdjustment,
    mountWidth: mount.clientWidth,
    viewportWidth: window.innerWidth,
  });

  onResolvedFontSizeChange?.(nextFontSize);

  if (terminal.options.fontSize === nextFontSize) {
    return;
  }

  terminal.options.fontSize = nextFontSize;
}

function installTerminalViewportAssist(mount: HTMLDivElement): () => void {
  let keyboardInteractionActive = false;
  let scrollTimer: number | null = null;
  let rafId: number | null = null;
  let lockTimer: number | null = null;
  const visualViewport = window.visualViewport;
  const body = document.body;
  const lockClassName = "app-page--keyboard-scroll-locked";
  let removeTouchMoveLock: (() => void) | null = null;

  const flushScheduledScroll = () => {
    if (scrollTimer !== null) {
      window.clearTimeout(scrollTimer);
      scrollTimer = null;
    }
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (lockTimer !== null) {
      window.clearTimeout(lockTimer);
      lockTimer = null;
    }
  };

  const lockPageScroll = () => {
    if (removeTouchMoveLock) {
      return;
    }

    body.classList.add(lockClassName);
    const viewport = mount.querySelector<HTMLElement>(".xterm-viewport");
    const handleTouchMove = (event: TouchEvent) => {
      if (viewport && event.target instanceof Node && viewport.contains(event.target)) {
        return;
      }

      event.preventDefault();
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    removeTouchMoveLock = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      removeTouchMoveLock = null;
    };
  };

  const unlockPageScroll = () => {
    if (!removeTouchMoveLock) {
      return;
    }

    removeTouchMoveLock();
    body.classList.remove(lockClassName);
  };

  const revealTerminalInViewport = (delayMs = 0, _keyboardInset = 0) => {
    flushScheduledScroll();
    scrollTimer = window.setTimeout(() => {
      scrollTimer = null;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const viewportHeight = visualViewport?.height ?? window.innerHeight;
        const rect = mount.getBoundingClientRect();
        const controls = document.getElementById("controls");
        const controlsRect = controls?.classList.contains("hidden") ? null : controls?.getBoundingClientRect();
        const contentBottom = Math.max(rect.bottom, controlsRect?.bottom ?? 0);
        const targetBottom = viewportHeight - 12;
        const delta = contentBottom - targetBottom;
        if (delta <= 0) {
          return;
        }

        window.scrollTo({
          top: Math.max(0, window.scrollY + delta),
          behavior: delayMs > 0 ? "smooth" : "auto",
        });
      });
    }, delayMs);
  };

  const activateViewportAssist = () => {
    keyboardInteractionActive = true;
  };

  const deactivateViewportAssist = () => {
    keyboardInteractionActive = false;
    flushScheduledScroll();
    unlockPageScroll();
  };

  const handleViewportResize = () => {
    if (!keyboardInteractionActive) {
      return;
    }

    const keyboardInset = getViewportKeyboardInset();
    revealTerminalInViewport(48, keyboardInset);
    if (keyboardInset > 0) {
      lockTimer = window.setTimeout(() => {
        lockTimer = null;
        lockPageScroll();
      }, 240);
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") {
      return;
    }

    activateViewportAssist();
  };

  mount.addEventListener("touchstart", activateViewportAssist, { passive: true });
  mount.addEventListener("pointerdown", handlePointerDown);
  mount.addEventListener("focusout", deactivateViewportAssist);
  visualViewport?.addEventListener("resize", handleViewportResize);

  return () => {
    deactivateViewportAssist();
    mount.removeEventListener("touchstart", activateViewportAssist);
    mount.removeEventListener("pointerdown", handlePointerDown);
    mount.removeEventListener("focusout", deactivateViewportAssist);
    visualViewport?.removeEventListener("resize", handleViewportResize);
  };
}

function getViewportKeyboardInset(): number {
  const visualViewport = window.visualViewport;
  if (!visualViewport) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(window.innerHeight - (visualViewport.height + visualViewport.offsetTop)),
  );
}
