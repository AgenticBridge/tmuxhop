/**
 * tmuxhop client UI definition tests.
 *
 * Purpose: verify static UI configuration used by the React frontend.
 *
 * Boundary: client test coverage only.
 */
import { describe, expect, it } from "vitest";

import { CONTROL_BUTTONS, formatScopeLabel, NAV_SCOPES } from "../src/client/app/ui.js";

describe("formatScopeLabel", () => {
  it("formats every nav scope", () => {
    expect(NAV_SCOPES.map((scope) => formatScopeLabel(scope))).toEqual([
      "Sessions",
      "Windows",
      "Panes",
    ]);
  });
});

describe("CONTROL_BUTTONS", () => {
  it("keeps core terminal shortcuts in order", () => {
    expect(CONTROL_BUTTONS.map((control) => control.label)).toEqual([
      "Esc",
      "Tab",
      "Ctrl+C",
      "Alt+Enter",
      "Ctrl+L",
      "↑",
      "←",
      "↓",
      "→",
      "Enter",
    ]);
  });
});
