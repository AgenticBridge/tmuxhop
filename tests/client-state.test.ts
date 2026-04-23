/**
 * PaneHop client state tests.
 *
 * Purpose: verify UI-facing selection helpers using backend protocol data as
 * input.
 *
 * Boundary: client test coverage only.
 */
import { describe, expect, it } from "vitest";

import {
  getInitialSessionName,
  getInitialSelection,
  getPaneSubtitle,
  getRecoveredSelection,
  getSelectedPane,
} from "../src/client/state.js";
import type { SessionSummary, WindowInfo } from "../src/server/protocol.js";

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
        active: false,
        title: "editor",
        cwd: "/repo",
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
        title: "notes",
        cwd: "/repo/docs",
        command: "nvim",
      },
    ],
  },
];

const sessions: SessionSummary[] = [
  { name: "panehop", attached: false, windows: 2 },
  { name: "notes", attached: true, windows: 1 },
];

describe("getInitialSessionName", () => {
  it("prefers the provided default session when available", () => {
    expect(getInitialSessionName(sessions, "notes")).toBe("notes");
  });

  it("falls back to the first listed session", () => {
    expect(getInitialSessionName(sessions, "missing")).toBe("panehop");
  });
});

describe("getInitialSelection", () => {
  it("selects the window containing the active pane", () => {
    expect(getInitialSelection(windows, "%2")).toEqual({
      selectedSessionName: null,
      selectedWindowId: "@2",
      selectedPaneId: "%2",
    });
  });

  it("falls back to the first pane when no active pane is present", () => {
    expect(getInitialSelection(windows, null)).toEqual({
      selectedSessionName: null,
      selectedWindowId: "@1",
      selectedPaneId: "%1",
    });
  });
});

describe("getSelectedPane", () => {
  it("returns the selected pane when ids match", () => {
    expect(getSelectedPane(windows, "@2", "%2")?.title).toBe("notes");
  });
});

describe("getRecoveredSelection", () => {
  it("preserves the previously selected pane when it still exists", () => {
    expect(
      getRecoveredSelection(
        windows,
        {
          selectedWindowId: "@2",
          selectedPaneId: "%2",
        },
        "%1",
      ),
    ).toEqual({
      selectedSessionName: null,
      selectedWindowId: "@2",
      selectedPaneId: "%2",
    });
  });

  it("falls back to the preserved window when the pane is gone", () => {
    expect(
      getRecoveredSelection(
        windows,
        {
          selectedWindowId: "@2",
          selectedPaneId: "%missing",
        },
        "%1",
      ),
    ).toEqual({
      selectedSessionName: null,
      selectedWindowId: "@2",
      selectedPaneId: "%2",
    });
  });
});

describe("getPaneSubtitle", () => {
  it("joins cwd and command", () => {
    expect(getPaneSubtitle(windows[1]!.panes[0]!)).toBe("/repo/docs • nvim");
  });
});
