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
  getPreferredTerminalFontSize,
  getTerminalDimensions,
} from "../src/client/terminal/size.js";

describe("getPreferredTerminalFontSize", () => {
  it("keeps the desktop font size on wide layouts", () => {
    expect(getPreferredTerminalFontSize({ mountWidth: 960, viewportWidth: 1280 })).toBe(14);
  });

  it("uses a slightly denser size on tablet widths", () => {
    expect(getPreferredTerminalFontSize({ mountWidth: 720, viewportWidth: 768 })).toBe(13);
  });

  it("uses a denser size on phone widths", () => {
    expect(getPreferredTerminalFontSize({ mountWidth: 390, viewportWidth: 390 })).toBe(12);
  });

  it("uses the densest size on very narrow phones", () => {
    expect(getPreferredTerminalFontSize({ mountWidth: 360, viewportWidth: 360 })).toBe(11);
  });

  it("applies a user font-size adjustment on top of the responsive default", () => {
    expect(getPreferredTerminalFontSize({ mountWidth: 390, viewportWidth: 390, adjustment: 2 })).toBe(14);
    expect(getPreferredTerminalFontSize({ mountWidth: 360, viewportWidth: 360, adjustment: -4 })).toBe(7);
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
