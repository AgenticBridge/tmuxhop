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
  getTerminalFontStack,
  INSTALLED_NERD_FONT_STACK,
  loadTerminalFontSize,
  loadTerminalFontMode,
  saveTerminalFontMode,
  saveTerminalFontSize,
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

  it("defaults terminal font size to unset when nothing is stored", () => {
    expect(loadTerminalFontSize({ getItem: vi.fn(() => null) })).toBeNull();
  });

  it("loads a persisted terminal font size", () => {
    expect(loadTerminalFontSize({ getItem: vi.fn(() => "18") })).toBe(18);
  });

  it("migrates the legacy font-size adjustment into the new absolute-size key", () => {
    const getItem = vi.fn((key: string) => {
      if (key === "tmuxhop.terminal-font-size") {
        return null;
      }
      if (key === "tmuxhop.terminal-font-size-adjustment") {
        return "2";
      }
      return null;
    });
    const setItem = vi.fn();
    const removeItem = vi.fn();

    expect(loadTerminalFontSize({ getItem, setItem, removeItem }, 390)).toBe(14);
    expect(setItem).toHaveBeenCalledWith("tmuxhop.terminal-font-size", "14");
    expect(removeItem).toHaveBeenCalledWith("tmuxhop.terminal-font-size-adjustment");
  });

  it("prefers the new absolute-size key over the legacy adjustment key", () => {
    const getItem = vi.fn((key: string) => {
      if (key === "tmuxhop.terminal-font-size") {
        return "18";
      }
      if (key === "tmuxhop.terminal-font-size-adjustment") {
        return "2";
      }
      return null;
    });
    const setItem = vi.fn();
    const removeItem = vi.fn();

    expect(loadTerminalFontSize({ getItem, setItem, removeItem }, 390)).toBe(18);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it("clamps a persisted terminal font size to supported bounds", () => {
    expect(loadTerminalFontSize({ getItem: vi.fn(() => "99") })).toBe(24);
    expect(loadTerminalFontSize({ getItem: vi.fn(() => "-99") })).toBe(4);
  });

  it("persists the selected terminal font size", () => {
    const setItem = vi.fn();
    saveTerminalFontSize(18, { setItem });
    expect(setItem).toHaveBeenCalledWith("tmuxhop.terminal-font-size", "18");
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
    expect(loadTerminalFontSize(blockedStorage)).toBeNull();
    expect(() => saveTerminalFontMode("system", blockedStorage)).not.toThrow();
    expect(() => saveTerminalFontSize(18, blockedStorage)).not.toThrow();
  });
});
