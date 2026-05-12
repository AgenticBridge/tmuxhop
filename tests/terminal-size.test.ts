/**
 * tmuxhop terminal sizing tests.
 *
 * Purpose: verify fitted terminal size normalization independently from the DOM
 * wiring in the app shell.
 *
 * Boundary: client test coverage only.
 */
import { describe, expect, it, vi } from "vitest";

import {
  clampTerminalFontSize,
  getResponsiveTerminalFontSize,
  resolveTerminalFontSize,
  getTerminalDimensions,
} from "../src/client/terminal/size.js";

describe("getResponsiveTerminalFontSize", () => {
  it("keeps the desktop font size on wide layouts", () => {
    expect(getResponsiveTerminalFontSize({ mountWidth: 960, viewportWidth: 1280 })).toBe(14);
  });

  it("uses a slightly denser size on tablet widths", () => {
    expect(getResponsiveTerminalFontSize({ mountWidth: 720, viewportWidth: 768 })).toBe(13);
  });

  it("uses a denser size on phone widths", () => {
    expect(getResponsiveTerminalFontSize({ mountWidth: 390, viewportWidth: 390 })).toBe(12);
  });

  it("uses the densest size on very narrow phones", () => {
    expect(getResponsiveTerminalFontSize({ mountWidth: 360, viewportWidth: 360 })).toBe(11);
  });
});

describe("resolveTerminalFontSize", () => {
  it("uses a saved absolute font size when one exists", () => {
    expect(resolveTerminalFontSize({ fontSize: 18, mountWidth: 390, viewportWidth: 390 })).toBe(18);
  });

  it("falls back to the responsive default when no size is saved", () => {
    expect(resolveTerminalFontSize({ fontSize: null, mountWidth: 390, viewportWidth: 390 })).toBe(12);
  });

  it("clamps saved absolute font sizes to supported bounds", () => {
    expect(resolveTerminalFontSize({ fontSize: 99, mountWidth: 960, viewportWidth: 1280 })).toBe(24);
    expect(resolveTerminalFontSize({ fontSize: -99, mountWidth: 960, viewportWidth: 1280 })).toBe(4);
    expect(clampTerminalFontSize(12.9)).toBe(12.9);
  });
});

describe("getTerminalDimensions", () => {
  it("reads the fitted terminal size", () => {
    const terminal = {
      cols: 84,
      rows: 24,
    };
    expect(getTerminalDimensions(terminal as never)).toEqual({ cols: 84, rows: 24 });
  });

  it("clamps very small fitted sizes to a minimum usable terminal size", () => {
    const terminal = { cols: 1, rows: 0 };
    expect(getTerminalDimensions(terminal as never)).toEqual({ cols: 20, rows: 8 });
  });
});
