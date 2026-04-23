/**
 * tmuxhop terminal font diagnostics.
 *
 * Purpose: detect whether the browser can render terminal-critical glyph sets
 * and produce actionable font recommendations for the current terminal UI.
 *
 * Boundary: client-only. This module belongs to terminal support. Pure report
 * builders may be unit-tested in Node, while browser probing stays limited to
 * DOM and canvas APIs.
 */
import "./nerd-font.css";

export interface FontCoverageFlags {
  boxDrawing: boolean;
  powerline: boolean;
  nerdFont: boolean;
}

export interface FontCompatibilityReport extends FontCoverageFlags {
  status: "checking" | "ok" | "warn";
  headline: string;
  details: string;
  recommendedFonts: string[];
}

const MISSING_GLYPH_SENTINEL = "\u0378";
const PROBE_CANVAS_SIZE = 48;
const PROBE_FONT_SIZE = 28;

export const TERMINAL_FONT_STACK =
  '"Tmuxhop Terminal Nerd Font", "JetBrainsMono Nerd Font", "MesloLGS NF", "SauceCodePro Nerd Font", "CaskaydiaCove Nerd Font", "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

export const FONT_PROBE_SAMPLE = "┌─┐ ││ └─┘       ";

const GLYPH_GROUPS = {
  boxDrawing: ["┌", "─", "│", "┘"],
  powerline: ["", "", ""],
  nerdFont: ["", "", ""],
} satisfies Record<keyof FontCoverageFlags, string[]>;

interface GlyphSignature {
  inkPixels: number;
  hash: number;
}

export function createPendingFontCompatibilityReport(): FontCompatibilityReport {
  return {
    boxDrawing: true,
    powerline: true,
    nerdFont: true,
    status: "checking",
    headline: "Checking bundled font support",
    details:
      "tmuxhop is loading the bundled Nerd Font before checking terminal glyph coverage.",
    recommendedFonts: [],
  };
}

export function buildFontCompatibilityReport(
  flags: FontCoverageFlags,
): FontCompatibilityReport {
  const missing = Object.entries(flags)
    .filter(([, supported]) => !supported)
    .map(([name]) => name) as Array<keyof FontCoverageFlags>;

  if (missing.length === 0) {
    return {
      ...flags,
      status: "ok",
      headline: "Browser font coverage looks good",
      details:
        "The bundled Nerd Font covers pane borders, prompt icons, and fullscreen terminal apps reliably.",
      recommendedFonts: [],
    };
  }

  const recommendedFonts =
    missing.includes("powerline") || missing.includes("nerdFont")
      ? ["JetBrainsMono Nerd Font", "MesloLGS NF", "CaskaydiaCove Nerd Font"]
      : ["JetBrainsMono Nerd Font", "JetBrains Mono", "Menlo"];

  if (missing.length === 1 && missing[0] === "boxDrawing") {
    return {
      ...flags,
      status: "warn",
      headline: "Terminal borders may render incorrectly",
      details:
        "Even with the bundled Nerd Font, box-drawing glyphs are missing, so pane borders and text UIs can look broken in the browser.",
      recommendedFonts,
    };
  }

  return {
    ...flags,
    status: "warn",
    headline: "Prompt icons are not rendering",
    details:
      "The bundled Nerd Font glyphs are not available in this browser session, so themed prompts like oh-my-zsh may show empty boxes or fallback glyphs.",
    recommendedFonts,
  };
}

export async function ensureBundledTerminalFontReady(
  documentFonts: FontFaceSet | undefined = globalThis.document?.fonts,
): Promise<void> {
  if (!documentFonts) {
    return;
  }

  const regularReady = documentFonts.check('400 16px "Tmuxhop Terminal Nerd Font"');
  const boldReady = documentFonts.check('700 16px "Tmuxhop Terminal Nerd Font"');

  if (regularReady && boldReady) {
    return;
  }

  const pendingLoads: Promise<FontFace[]>[] = [];
  if (!regularReady) {
    pendingLoads.push(documentFonts.load('400 16px "Tmuxhop Terminal Nerd Font"'));
  }
  if (!boldReady) {
    pendingLoads.push(documentFonts.load('700 16px "Tmuxhop Terminal Nerd Font"'));
  }

  await Promise.allSettled(pendingLoads);
}

export function detectFontCompatibility(
  fontFamily: string = TERMINAL_FONT_STACK,
): FontCompatibilityReport {
  const context = createProbeContext();

  if (!context) {
    return {
      ...buildFontCompatibilityReport({
        boxDrawing: false,
        powerline: false,
        nerdFont: false,
      }),
      details:
        "tmuxhop could not run the browser font probe. The bundled Nerd Font should still cover terminal layout and prompt icons, but install a local Nerd Font if glyphs still look wrong.",
    };
  }

  return buildFontCompatibilityReport({
    boxDrawing: glyphSetSupported(context, GLYPH_GROUPS.boxDrawing, fontFamily),
    powerline: glyphSetSupported(context, GLYPH_GROUPS.powerline, fontFamily),
    nerdFont: glyphSetSupported(context, GLYPH_GROUPS.nerdFont, fontFamily),
  });
}

function createProbeContext(): CanvasRenderingContext2D | null {
  const canvas = document.createElement("canvas");
  canvas.width = PROBE_CANVAS_SIZE;
  canvas.height = PROBE_CANVAS_SIZE;
  return canvas.getContext("2d");
}

function glyphSetSupported(
  context: CanvasRenderingContext2D,
  glyphs: string[],
  fontFamily: string,
): boolean {
  return glyphs.every((glyph) => glyphSupported(context, glyph, fontFamily));
}

function glyphSupported(
  context: CanvasRenderingContext2D,
  glyph: string,
  fontFamily: string,
): boolean {
  const glyphSignature = renderGlyphSignature(context, glyph, fontFamily);
  const missingSignature = renderGlyphSignature(context, MISSING_GLYPH_SENTINEL, fontFamily);

  return (
    glyphSignature.inkPixels > 0 &&
    (glyphSignature.inkPixels !== missingSignature.inkPixels ||
      glyphSignature.hash !== missingSignature.hash)
  );
}

function renderGlyphSignature(
  context: CanvasRenderingContext2D,
  glyph: string,
  fontFamily: string,
): GlyphSignature {
  context.clearRect(0, 0, PROBE_CANVAS_SIZE, PROBE_CANVAS_SIZE);
  context.fillStyle = "#000000";
  context.textBaseline = "top";
  context.font = `${PROBE_FONT_SIZE}px ${fontFamily}`;
  context.fillText(glyph, 4, 6);

  const pixels = context.getImageData(0, 0, PROBE_CANVAS_SIZE, PROBE_CANVAS_SIZE).data;
  let hash = 2166136261;
  let inkPixels = 0;

  for (let index = 3; index < pixels.length; index += 4) {
    const alpha = pixels[index] ?? 0;
    if (alpha === 0) {
      continue;
    }

    inkPixels += 1;
    hash ^= alpha;
    hash = Math.imul(hash, 16777619);
  }

  return { inkPixels, hash: hash >>> 0 };
}
