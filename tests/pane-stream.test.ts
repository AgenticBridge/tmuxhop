/**
 * tmuxhop pane stream tests.
 *
 * Purpose: verify tmux control-mode parsing helpers that back the live pane
 * stream bridge.
 *
 * Boundary: server test coverage only.
 */
import { describe, expect, it } from "vitest";

import {
  decodeControlModeText,
  formatResizeCommand,
  parseControlModeOutput,
} from "../src/server/pane-stream.js";

describe("decodeControlModeText", () => {
  it("decodes octal escaped bytes from tmux control mode", () => {
    expect(decodeControlModeText("\\033[31mred\\012")).toBe("\u001b[31mred\n");
  });

  it("decodes escaped backslashes", () => {
    expect(decodeControlModeText("path\\\\name")).toBe("path\\name");
  });
});

describe("parseControlModeOutput", () => {
  it("parses %output notifications", () => {
    expect(parseControlModeOutput("%output %1 \\033[32mhello\\012")).toEqual({
      kind: "data",
      paneId: "%1",
      data: "\u001b[32mhello\n",
    });
  });

  it("parses %extended-output notifications", () => {
    expect(parseControlModeOutput("%extended-output %2 0 : \\033[33mworld\\012")).toEqual({
      kind: "data",
      paneId: "%2",
      data: "\u001b[33mworld\n",
    });
  });

  it("preserves rich prompt ANSI sequences from shell output", () => {
    expect(
      parseControlModeOutput(
        "%output %26 \\033[38;5;240m╭─\\033[0m\\033[38;5;31m prompt\\012",
      ),
    ).toEqual({
      kind: "data",
      paneId: "%26",
      data: "\u001b[38;5;240m╭─\u001b[0m\u001b[38;5;31m prompt\n",
    });
  });

  it("preserves alternate-screen sequences from fullscreen apps", () => {
    expect(
      parseControlModeOutput(
        "%output %26 \\033[?1049h\\033[?1h\\033=\\015alpha\\012beta\\012\\033[7m(END)\\033[27m",
      ),
    ).toEqual({
      kind: "data",
      paneId: "%26",
      data: "\u001b[?1049h\u001b[?1h\u001b=\ralpha\nbeta\n\u001b[7m(END)\u001b[27m",
    });
  });

  it("parses %exit notifications", () => {
    expect(parseControlModeOutput("%exit too far behind")).toEqual({
      kind: "exit",
      reason: "too far behind",
    });
  });

  it("ignores unrelated control-mode lines", () => {
    expect(parseControlModeOutput("%window-add @1")).toEqual({ kind: "ignore" });
  });
});

describe("formatResizeCommand", () => {
  it("formats tmux control-mode client resize commands", () => {
    expect(formatResizeCommand(96, 32)).toBe("refresh-client -C 96x32");
  });

  it("clamps unrealistically small terminal sizes", () => {
    expect(formatResizeCommand(1.9, 0.4)).toBe("refresh-client -C 20x8");
  });
});
