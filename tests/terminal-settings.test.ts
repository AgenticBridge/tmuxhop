/**
 * tmuxhop terminal settings tests.
 *
 * Purpose: verify terminal font mode persistence and effective stack
 * selection without depending on React or browser rendering.
 *
 * Boundary: client settings helper coverage only.
 */
import { describe, expect, it, vi } from "vitest";

import {
  clampTerminalFontSizeAdjustment,
  getTerminalFontStack,
  INSTALLED_NERD_FONT_STACK,
  loadTerminalFontSizeAdjustment,
  loadTerminalFontMode,
  saveTerminalFontMode,
  saveTerminalFontSizeAdjustment,
  SYSTEM_TERMINAL_FONT_STACK,
  terminalFontModeNeedsBundledAsset,
} from "../src/client/terminal/settings.js";

describe("terminal font settings", () => {
  it("defaults to bundled mode when nothing is stored", () => {
    expect(loadTerminalFontMode({ getItem: vi.fn(() => null) })).toBe("bundled");
  });

  it("loads a persisted font mode", () => {
    expect(loadTerminalFontMode({ getItem: vi.fn(() => "system") })).toBe("system");
  });

  it("persists the selected font mode", () => {
    const setItem = vi.fn();
    saveTerminalFontMode("installed-nerd", { setItem });
    expect(setItem).toHaveBeenCalledWith("tmuxhop.terminal-font-mode", "installed-nerd");
  });

  it("defaults terminal font size adjustment to zero when nothing is stored", () => {
    expect(loadTerminalFontSizeAdjustment({ getItem: vi.fn(() => null) })).toBe(0);
  });

  it("loads a persisted terminal font size adjustment", () => {
    expect(loadTerminalFontSizeAdjustment({ getItem: vi.fn(() => "2") })).toBe(2);
  });

  it("clamps a persisted terminal font size adjustment", () => {
    expect(loadTerminalFontSizeAdjustment({ getItem: vi.fn(() => "99") })).toBe(6);
    expect(loadTerminalFontSizeAdjustment({ getItem: vi.fn(() => "-99") })).toBe(-2);
    expect(clampTerminalFontSizeAdjustment(1.8)).toBe(1);
  });

  it("persists the selected terminal font size adjustment", () => {
    const setItem = vi.fn();
    saveTerminalFontSizeAdjustment(3, { setItem });
    expect(setItem).toHaveBeenCalledWith("tmuxhop.terminal-font-size-adjustment", "3");
  });

  it("uses the bundled stack for bundled mode", () => {
    expect(getTerminalFontStack("bundled")).toContain('"Tmuxhop Terminal Nerd Font"');
  });

  it("uses the installed nerd stack for installed-nerd mode", () => {
    expect(getTerminalFontStack("installed-nerd")).toBe(INSTALLED_NERD_FONT_STACK);
  });

  it("uses the system stack for system mode", () => {
    expect(getTerminalFontStack("system")).toBe(SYSTEM_TERMINAL_FONT_STACK);
  });

  it("only preloads bundled assets for bundled mode", () => {
    expect(terminalFontModeNeedsBundledAsset("bundled")).toBe(true);
    expect(terminalFontModeNeedsBundledAsset("installed-nerd")).toBe(false);
    expect(terminalFontModeNeedsBundledAsset("system")).toBe(false);
  });

  it("falls back safely when storage access throws", () => {
    const blockedStorage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };

    expect(loadTerminalFontMode(blockedStorage)).toBe("bundled");
    expect(loadTerminalFontSizeAdjustment(blockedStorage)).toBe(0);
    expect(() => saveTerminalFontMode("system", blockedStorage)).not.toThrow();
    expect(() => saveTerminalFontSizeAdjustment(2, blockedStorage)).not.toThrow();
  });
});
