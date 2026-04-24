/**
 * tmuxhop font compatibility tests.
 *
 * Purpose: verify recommendation logic for browser font coverage without
 * depending on DOM canvas APIs.
 *
 * Boundary: client test coverage only.
 */
import { describe, expect, it, vi } from "vitest";

import {
  buildFontCompatibilityReport,
  createPendingFontCompatibilityReport,
  detectFontCompatibility,
  ensureBundledTerminalFontReady,
  TERMINAL_FONT_STACK,
} from "../src/client/terminal/font-diagnostics.js";

describe("TERMINAL_FONT_STACK", () => {
  it("prefers the bundled tmuxhop Nerd Font first", () => {
    expect(TERMINAL_FONT_STACK.startsWith('"Tmuxhop Terminal Nerd Font"')).toBe(true);
  });
});

describe("buildFontCompatibilityReport", () => {
  it("starts in a checking state before bundled font probing completes", () => {
    expect(createPendingFontCompatibilityReport()).toMatchObject({
      status: "checking",
      headline: "Checking bundled font support",
      details:
        "tmuxhop is loading the bundled Nerd Font before checking terminal glyph coverage.",
      recommendedFonts: [],
    });
  });

  it("marks a fully supported font stack as healthy", () => {
    expect(
      buildFontCompatibilityReport({
        boxDrawing: true,
        powerline: true,
        nerdFont: true,
      }),
    ).toMatchObject({
      status: "ok",
      details:
        "The bundled Nerd Font covers pane borders, prompt icons, and fullscreen terminal apps reliably.",
      recommendedFonts: [],
    });
  });

  it("recommends a terminal-safe monospace when box drawing is missing", () => {
    expect(
      buildFontCompatibilityReport({
        boxDrawing: false,
        powerline: true,
        nerdFont: true,
      }),
    ).toMatchObject({
      status: "warn",
      headline: "Terminal borders may render incorrectly",
      details:
        "Even with the bundled Nerd Font, box-drawing glyphs are missing, so pane borders and text UIs can look broken in the browser.",
      recommendedFonts: ["IosevkaTerm Nerd Font", "Iosevka Term", "Menlo"],
    });
  });

  it("warns when bundled Nerd Font icons are not available", () => {
    expect(
      buildFontCompatibilityReport({
        boxDrawing: true,
        powerline: false,
        nerdFont: false,
      }),
    ).toMatchObject({
      status: "warn",
      headline: "Prompt icons are not rendering",
      details:
        "The bundled Nerd Font glyphs are not available in this browser session, so themed prompts like oh-my-zsh may show empty boxes or fallback glyphs.",
      recommendedFonts: [
        "IosevkaTerm Nerd Font",
        "JetBrainsMono Nerd Font",
        "MesloLGS NF",
      ],
    });
  });
});

describe("detectFontCompatibility", () => {
  it("waits for the bundled terminal font when the browser exposes document.fonts", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const check = vi.fn().mockReturnValue(false);

    await ensureBundledTerminalFontReady({
      check,
      load,
    } as unknown as FontFaceSet);

    expect(check).toHaveBeenNthCalledWith(1, '400 16px "Tmuxhop Terminal Nerd Font"');
    expect(check).toHaveBeenNthCalledWith(2, '700 16px "Tmuxhop Terminal Nerd Font"');
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledWith('400 16px "Tmuxhop Terminal Nerd Font"');
    expect(load).toHaveBeenCalledWith('700 16px "Tmuxhop Terminal Nerd Font"');
  });

  it("skips reloading only when both bundled font weights are already ready", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const check = vi.fn().mockReturnValue(true);

    await ensureBundledTerminalFontReady({
      check,
      load,
    } as unknown as FontFaceSet);

    expect(load).not.toHaveBeenCalled();
  });

  it("loads only the missing bundled font weight", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const check = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);

    await ensureBundledTerminalFontReady({
      check,
      load,
    } as unknown as FontFaceSet);

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('700 16px "Tmuxhop Terminal Nerd Font"');
  });

  it("falls back to the bundled-font guidance when canvas probing is unavailable", () => {
    const originalDocument = globalThis.document;
    const createElement = (originalDocument?.createElement?.bind(originalDocument) ??
      (() => ({} as HTMLCanvasElement)));
    const documentStub = {
      ...originalDocument,
      createElement(tagName: string) {
        if (tagName !== "canvas") {
          return createElement(tagName);
        }

        return {
          width: 0,
          height: 0,
          getContext: () => null,
        } as unknown as HTMLCanvasElement;
      },
    };

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: documentStub,
    });

    try {
      expect(detectFontCompatibility()).toMatchObject({
        status: "warn",
        details:
          "tmuxhop could not run the browser font probe. The bundled Nerd Font should still cover terminal layout and prompt icons, but install a local Nerd Font if glyphs still look wrong.",
      });
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      });
    }
  });
});
