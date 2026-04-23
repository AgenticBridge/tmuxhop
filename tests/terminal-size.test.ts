/**
 * tmuxhop terminal sizing tests.
 *
 * Purpose: verify fitted terminal size normalization independently from the DOM
 * wiring in the app shell.
 *
 * Boundary: client test coverage only.
 */
import { describe, expect, it, vi } from "vitest";

import { getTerminalDimensions } from "../src/client/terminal/size.js";

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
