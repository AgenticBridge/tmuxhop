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

import { getPreferredTerminalFontSize } from "./size.js";

const terminalTheme = {
  background: "#111111",
  foreground: "#f2f2eb",
  cursor: "#f2f2eb",
} as const;

export interface LoadedTerminalRuntime {
  fitAddon: FitAddon;
  terminal: Terminal;
}

export interface CreateTerminalRuntimeOptions {
  fontFamily: string;
  fontSizeAdjustment?: number;
}

export function createTerminalRuntime(
  mount: HTMLElement,
  options: CreateTerminalRuntimeOptions,
): LoadedTerminalRuntime {
  const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: options.fontFamily,
    fontSize: getPreferredTerminalFontSize({
      adjustment: options.fontSizeAdjustment,
      mountWidth: mount.clientWidth,
      viewportWidth: window.innerWidth,
    }),
    scrollback: 5000,
    theme: terminalTheme,
  });
  const fitAddon = new FitAddon();

  terminal.loadAddon(fitAddon);
  terminal.open(mount);

  // Listen for scroll events from buttons
  const scrollHandler = (e: Event) => {
    const customEvent = e as CustomEvent;
    const direction = customEvent.detail;
    if (direction === 'up') {
      terminal.scrollLines(-5);
    } else if (direction === 'down') {
      terminal.scrollLines(5);
    }
  };
  window.addEventListener('terminal-scroll', scrollHandler);

  // Touch scroll support for mobile devices
  // New approach: listen on xterm's parent element, use passive: false to intercept
  let touchStartY = 0;
  let touchStartX = 0;
  const touchStartTime = 0;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY - touchY; // Positive = scrolling down

    // Only handle vertical scroll (ignore horizontal swipes)
    const touchX = e.touches[0].clientX;
    const deltaX = Math.abs(touchX - touchStartX);
    if (deltaX > Math.abs(deltaY)) return; // Horizontal swipe, ignore

    // Convert pixel movement to line count (assuming ~20px per line)
    const lineCount = Math.round(deltaY / 20);

    if (lineCount !== 0) {
      // Use requestAnimationFrame to batch scroll calls
      requestAnimationFrame(() => {
        terminal.scrollLines(lineCount);
      });

      // Update start position for next move event
      touchStartY = touchY;
      touchStartX = touchX;
    }

    // Prevent xterm from handling this touch event
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchEnd = (e: TouchEvent) => {
    // Reset if needed
  };

  // Get the terminal's DOM element and add listeners
  // xterm mounts inside `mount`, so we listen on mount or terminal.element
  const targetElement = terminal.element || mount;
  if (targetElement) {
    targetElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    targetElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    targetElement.addEventListener('touchend', handleTouchEnd, { passive: false });
  }

  return {
    fitAddon,
    terminal,
  };
}
