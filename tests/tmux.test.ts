/**
 * PaneHop tmux adapter tests.
 *
 * Purpose: verify tmux parsing and backend selection behavior in isolation from
 * browser code.
 *
 * Boundary: server test coverage only.
 */
import { describe, expect, it } from "vitest";

import {
  decodeInput,
  parseRows,
  pickActivePaneId,
  pickDefaultSessionName,
} from "../src/server/tmux.js";
import type { SessionSummary, WindowInfo } from "../src/server/protocol.js";

describe("parseRows", () => {
  it("parses tab and newline separated tmux rows", () => {
    const rows = parseRows("a\t1\nb\t2", ["id", "index"] as const);

    expect(rows).toEqual([
      { id: "a", index: "1" },
      { id: "b", index: "2" },
    ]);
  });

  it("returns an empty array for blank output", () => {
    expect(parseRows("", ["id"] as const)).toEqual([]);
  });
});

describe("pickActivePaneId", () => {
  it("prefers the active pane from the active window", () => {
    const windows: WindowInfo[] = [
      {
        id: "@1",
        index: 0,
        name: "code",
        active: false,
        panes: [
          {
            id: "%1",
            windowId: "@1",
            index: 0,
            active: true,
            title: "code",
            cwd: "/tmp",
            command: "zsh",
          },
        ],
      },
      {
        id: "@2",
        index: 1,
        name: "docs",
        active: true,
        panes: [
          {
            id: "%2",
            windowId: "@2",
            index: 0,
            active: true,
            title: "docs",
            cwd: "/tmp",
            command: "zsh",
          },
        ],
      },
    ];

    expect(pickActivePaneId(windows)).toBe("%2");
  });
});

describe("pickDefaultSessionName", () => {
  it("prefers the configured default session when present", () => {
    const sessions: SessionSummary[] = [
      { name: "notes", attached: false, windows: 1 },
      { name: "panehop", attached: true, windows: 2 },
    ];

    expect(pickDefaultSessionName(sessions, "panehop")).toBe("panehop");
  });

  it("falls back to the first session when the preferred one is missing", () => {
    const sessions: SessionSummary[] = [
      { name: "notes", attached: false, windows: 1 },
      { name: "work", attached: true, windows: 3 },
    ];

    expect(pickDefaultSessionName(sessions, "panehop")).toBe("notes");
  });
});

describe("decodeInput", () => {
  it("maps common control sequences to tmux keys", () => {
    expect(decodeInput("\r")).toEqual({ mode: "key", value: "Enter" });
    expect(decodeInput("\u001b[A")).toEqual({ mode: "key", value: "Up" });
    expect(decodeInput("\u0003")).toEqual({ mode: "key", value: "C-c" });
  });

  it("passes through literal text", () => {
    expect(decodeInput("git status")).toEqual({
      mode: "literal",
      value: "git status",
    });
  });
});
