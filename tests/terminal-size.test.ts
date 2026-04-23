/**
 * PaneHop terminal sizing tests.
 *
 * Purpose: verify browser terminal size calculation independently from the DOM
 * wiring in the app shell.
 *
 * Boundary: client test coverage only.
 */
import { describe, expect, it, vi } from "vitest";

import { getTerminalDimensions } from "../src/client/terminal-size.js";

describe("getTerminalDimensions", () => {
  it("derives rows and columns from the terminal mount size", () => {
    const terminal = {
      _core: {
        _renderService: {
          dimensions: {
            css: {
              cell: {
                width: 10,
                height: 20,
              },
            },
          },
        },
      },
    };
    const mount = {
      getBoundingClientRect: () => ({ width: 420, height: 260 }),
    } as unknown;

    vi.stubGlobal("window", {
      getComputedStyle: () => ({
        paddingLeft: "10",
        paddingRight: "10",
        paddingTop: "8",
        paddingBottom: "12",
      }),
    });

    expect(getTerminalDimensions(terminal as never, mount as HTMLElement)).toEqual({
      cols: 40,
      rows: 12,
    });

    vi.unstubAllGlobals();
  });

  it("clamps very small mounts to a minimum usable terminal size", () => {
    const terminal = {};
    const mount = {
      getBoundingClientRect: () => ({ width: 10, height: 10 }),
    } as unknown;

    vi.stubGlobal("window", {
      getComputedStyle: () => ({
        paddingLeft: "0",
        paddingRight: "0",
        paddingTop: "0",
        paddingBottom: "0",
      }),
    });

    expect(getTerminalDimensions(terminal as never, mount as HTMLElement)).toEqual({
      cols: 20,
      rows: 8,
    });

    vi.unstubAllGlobals();
  });
});
