/**
 * PaneHop font compatibility tests.
 *
 * Purpose: verify recommendation logic for browser font coverage without
 * depending on DOM canvas APIs.
 *
 * Boundary: client test coverage only.
 */
import { describe, expect, it } from "vitest";

import { buildFontCompatibilityReport } from "../src/client/font.js";

describe("buildFontCompatibilityReport", () => {
  it("marks a fully supported font stack as healthy", () => {
    expect(
      buildFontCompatibilityReport({
        boxDrawing: true,
        powerline: true,
        nerdFont: true,
      }),
    ).toMatchObject({
      status: "ok",
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
      recommendedFonts: ["JetBrains Mono", "Cascadia Mono", "Menlo"],
    });
  });

  it("recommends Nerd Fonts when prompt icons are missing", () => {
    expect(
      buildFontCompatibilityReport({
        boxDrawing: true,
        powerline: false,
        nerdFont: false,
      }),
    ).toMatchObject({
      status: "warn",
      headline: "Prompt icons need a Nerd Font",
      recommendedFonts: [
        "JetBrainsMono Nerd Font",
        "MesloLGS NF",
        "CaskaydiaCove Nerd Font",
      ],
    });
  });
});
