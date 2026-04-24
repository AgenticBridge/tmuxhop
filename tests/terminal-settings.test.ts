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
  loadTerminalFontMode,
  saveTerminalFontMode,
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
});
