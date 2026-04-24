// @vitest-environment jsdom
/**
 * tmuxhop utility bar tests.
 *
 * Purpose: verify compact breadcrumb rendering and bottom-sheet picker
 * selection in the top utility navigator.
 *
 * Boundary: client presentational coverage only.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  UtilityBar,
  getResponsivePathCharacterBudget,
  truncatePathLabel,
} from "../src/client/app/components/UtilityBar.js";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

afterEach(() => {
  cleanup();
});

describe("UtilityBar", () => {
  it("enforces a minimum of three visible characters for compact labels", () => {
    expect(truncatePathLabel("session", 1)).toBe("ses…");
    expect(getResponsivePathCharacterBudget(48)).toBe(3);
    expect(getResponsivePathCharacterBudget(420)).toBeGreaterThan(6);
  });

  it("renders truncated breadcrumb labels but shows full names in the picker", () => {
    const onSelectSession = vi.fn();

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    render(
      <UtilityBar
        fontReport={{
          boxDrawing: true,
          powerline: true,
          nerdFont: true,
          status: "ok",
          headline: "ok",
          details: "ok",
          recommendedFonts: [],
        }}
        onCreatePath={vi.fn(async () => undefined)}
        onDeletePath={vi.fn(async () => undefined)}
        onReconnect={vi.fn()}
        onRefreshFontReport={vi.fn()}
        onRenamePath={vi.fn(async () => undefined)}
        onSelectPane={vi.fn()}
        onSelectSession={onSelectSession}
        onSelectWindow={vi.fn()}
        selectedPaneId="%1"
        selectedSessionName="very-long-session-name"
        selectedWindowId="@1"
        selectedWindowPanes={[
          {
            id: "%1",
            windowId: "@1",
            index: 0,
            active: true,
            title: "editor-pane",
            cwd: "/repo",
            command: "zsh",
          },
        ]}
        sessions={[
          { name: "very-long-session-name", attached: true, windows: 1 },
          { name: "notes", attached: false, windows: 1 },
        ]}
        status={{ label: "Live", tone: "ok" }}
        windows={[
          {
            id: "@1",
            index: 0,
            name: "editor-window",
            active: true,
            panes: [],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "ver…" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "ver…" }));

    expect(screen.getAllByText("very-long-session-name").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "notes" }));
    expect(onSelectSession).toHaveBeenCalledWith("notes");
  });

  it("dims and disables the warning button when there are no warnings", () => {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    render(
      <UtilityBar
        fontReport={{
          boxDrawing: true,
          powerline: true,
          nerdFont: true,
          status: "ok",
          headline: "ok",
          details: "ok",
          recommendedFonts: [],
        }}
        onCreatePath={vi.fn(async () => undefined)}
        onDeletePath={vi.fn(async () => undefined)}
        onReconnect={vi.fn()}
        onRefreshFontReport={vi.fn()}
        onRenamePath={vi.fn(async () => undefined)}
        onSelectPane={vi.fn()}
        onSelectSession={vi.fn()}
        onSelectWindow={vi.fn()}
        selectedPaneId="%1"
        selectedSessionName="main"
        selectedWindowId="@1"
        selectedWindowPanes={[]}
        sessions={[{ name: "main", attached: true, windows: 1 }]}
        status={{ label: "Live", tone: "ok" }}
        windows={[]}
      />,
    );

    const warningButton = screen.getByRole("button", { name: "Warnings" });
    expect(warningButton.getAttribute("data-warning")).toBe("false");
    expect((warningButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows warning details and control sheet actions", () => {
    const onRefreshFontReport = vi.fn();

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    render(
      <UtilityBar
        fontReport={{
          boxDrawing: true,
          powerline: false,
          nerdFont: false,
          status: "warn",
          headline: "Font needs help",
          details: "Prompt icons are missing.",
          recommendedFonts: ["IosevkaTerm Nerd Font"],
        }}
        onCreatePath={vi.fn(async () => undefined)}
        onDeletePath={vi.fn(async () => undefined)}
        onReconnect={vi.fn()}
        onRefreshFontReport={onRefreshFontReport}
        onRenamePath={vi.fn(async () => undefined)}
        onSelectPane={vi.fn()}
        onSelectSession={vi.fn()}
        onSelectWindow={vi.fn()}
        selectedPaneId="%1"
        selectedSessionName="main"
        selectedWindowId="@1"
        selectedWindowPanes={[
          {
            id: "%1",
            windowId: "@1",
            index: 0,
            active: true,
            title: "editor-pane",
            cwd: "/repo",
            command: "zsh",
          },
        ]}
        sessions={[{ name: "main", attached: true, windows: 1 }]}
        status={{ label: "Session disconnected", tone: "warn" }}
        windows={[
          {
            id: "@1",
            index: 0,
            name: "editor-window",
            active: true,
            panes: [],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Warnings" }));
    expect(screen.getByText("Font")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recheck" }));
    expect(onRefreshFontReport).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    expect(screen.getByLabelText("Path actions")).not.toBeNull();
    expect(screen.getByRole("group", { name: "Path levels" })).not.toBeNull();
    expect(screen.getByText("View control")).not.toBeNull();
    expect(screen.getByText("Level: Session")).not.toBeNull();
    expect(screen.getByText("Action")).not.toBeNull();
    expect(screen.getByRole("button", { name: "main" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "editor-window" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "editor-pane" })).not.toBeNull();
  });

  it("updates the control sheet label and highlight for the selected pane level", () => {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    render(
      <UtilityBar
        fontReport={{
          boxDrawing: true,
          powerline: true,
          nerdFont: true,
          status: "ok",
          headline: "ok",
          details: "ok",
          recommendedFonts: [],
        }}
        onCreatePath={vi.fn(async () => undefined)}
        onDeletePath={vi.fn(async () => undefined)}
        onReconnect={vi.fn()}
        onRefreshFontReport={vi.fn()}
        onRenamePath={vi.fn(async () => undefined)}
        onSelectPane={vi.fn()}
        onSelectSession={vi.fn()}
        onSelectWindow={vi.fn()}
        selectedPaneId="%2"
        selectedSessionName="main"
        selectedWindowId="@1"
        selectedWindowPanes={[
          {
            id: "%1",
            windowId: "@1",
            index: 0,
            active: true,
            title: "shell",
            cwd: "/repo",
            command: "zsh",
          },
          {
            id: "%2",
            windowId: "@1",
            index: 1,
            active: false,
            title: "editor-pane",
            cwd: "/repo",
            command: "nvim",
          },
        ]}
        sessions={[{ name: "main", attached: true, windows: 1 }]}
        status={{ label: "Live", tone: "ok" }}
        windows={[
          {
            id: "@1",
            index: 0,
            name: "editor-window",
            active: true,
            panes: [],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    const paneLevelButton = screen.getByRole("button", { name: "editor-pane" });
    fireEvent.click(paneLevelButton);
    fireEvent.click(screen.getByTitle("Add"));

    expect(screen.getByText("View control")).not.toBeNull();
    expect(screen.getByText("Level: Pane")).not.toBeNull();
    expect(screen.getByText("Action")).not.toBeNull();
    expect(paneLevelButton.getAttribute("data-active")).toBe("true");
    expect(screen.getByText("Create Pane")).not.toBeNull();
  });

  it("highlights the controller-selected item instead of tmux active flags", () => {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    render(
      <UtilityBar
        fontReport={{
          boxDrawing: true,
          powerline: true,
          nerdFont: true,
          status: "ok",
          headline: "ok",
          details: "ok",
          recommendedFonts: [],
        }}
        onCreatePath={vi.fn(async () => undefined)}
        onDeletePath={vi.fn(async () => undefined)}
        onReconnect={vi.fn()}
        onRefreshFontReport={vi.fn()}
        onRenamePath={vi.fn(async () => undefined)}
        onSelectPane={vi.fn()}
        onSelectSession={vi.fn()}
        onSelectWindow={vi.fn()}
        selectedPaneId="%2"
        selectedSessionName="notes"
        selectedWindowId="@2"
        selectedWindowPanes={[
          {
            id: "%1",
            windowId: "@2",
            index: 0,
            active: true,
            title: "shell",
            cwd: "/repo",
            command: "zsh",
          },
          {
            id: "%2",
            windowId: "@2",
            index: 1,
            active: false,
            title: "editor",
            cwd: "/repo",
            command: "nvim",
          },
        ]}
        sessions={[
          { name: "main", attached: true, windows: 1 },
          { name: "notes", attached: false, windows: 1 },
        ]}
        status={{ label: "Live", tone: "ok" }}
        windows={[
          {
            id: "@1",
            index: 0,
            name: "shell",
            active: true,
            panes: [],
          },
          {
            id: "@2",
            index: 1,
            name: "editor",
            active: false,
            panes: [],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "not…" }));
    const sessionPicker = screen.getByRole("dialog", { name: "Sessions" });
    const notesOption = within(sessionPicker).getByRole("button", { name: "notes" });
    const mainOption = within(sessionPicker).getByRole("button", { name: "main" });
    expect(notesOption.getAttribute("data-active")).toBe("true");
    expect(mainOption.getAttribute("data-active")).toBeNull();

    fireEvent.click(screen.getByLabelText("Close picker"));
    fireEvent.click(screen.getByRole("button", { name: "1: …" }));
    const windowsPicker = screen.getByRole("dialog", { name: "Windows" });
    const editorWindowOption = within(windowsPicker).getByRole("button", { name: "1: editor" });
    const shellWindowOption = within(windowsPicker).getByRole("button", { name: "0: shell" });
    expect(editorWindowOption.getAttribute("data-active")).toBe("true");
    expect(shellWindowOption.getAttribute("data-active")).toBeNull();

    fireEvent.click(screen.getByLabelText("Close picker"));
    fireEvent.click(screen.getByRole("button", { name: "edi…" }));
    const panesPicker = screen.getByRole("dialog", { name: "Panes" });
    const editorPaneOption = within(panesPicker).getByRole("button", { name: "editor" });
    const shellPaneOption = within(panesPicker).getByRole("button", { name: "shell" });
    expect(editorPaneOption.getAttribute("data-active")).toBe("true");
    expect(shellPaneOption.getAttribute("data-active")).toBeNull();
  });

  it("renders without ResizeObserver support", () => {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: undefined,
    });

    render(
      <UtilityBar
        fontReport={{
          boxDrawing: true,
          powerline: true,
          nerdFont: true,
          status: "ok",
          headline: "ok",
          details: "ok",
          recommendedFonts: [],
        }}
        onCreatePath={vi.fn(async () => undefined)}
        onDeletePath={vi.fn(async () => undefined)}
        onReconnect={vi.fn()}
        onRefreshFontReport={vi.fn()}
        onRenamePath={vi.fn(async () => undefined)}
        onSelectPane={vi.fn()}
        onSelectSession={vi.fn()}
        onSelectWindow={vi.fn()}
        selectedPaneId="%1"
        selectedSessionName="main"
        selectedWindowId="@1"
        selectedWindowPanes={[]}
        sessions={[{ name: "main", attached: true, windows: 1 }]}
        status={{ label: "Live", tone: "ok" }}
        windows={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "mai…" })).not.toBeNull();
  });

  it("changes terminal font mode from the control sheet", () => {
    const onFontModeChange = vi.fn();

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    render(
      <UtilityBar
        fontMode="bundled"
        fontReport={{
          boxDrawing: true,
          powerline: true,
          nerdFont: true,
          status: "ok",
          headline: "ok",
          details: "ok",
          recommendedFonts: [],
        }}
        onCreatePath={vi.fn(async () => undefined)}
        onDeletePath={vi.fn(async () => undefined)}
        onFontModeChange={onFontModeChange}
        onReconnect={vi.fn()}
        onRefreshFontReport={vi.fn()}
        onRenamePath={vi.fn(async () => undefined)}
        onSelectPane={vi.fn()}
        onSelectSession={vi.fn()}
        onSelectWindow={vi.fn()}
        selectedPaneId="%1"
        selectedSessionName="main"
        selectedWindowId="@1"
        selectedWindowPanes={[]}
        sessions={[{ name: "main", attached: true, windows: 1 }]}
        status={{ label: "Live", tone: "ok" }}
        windows={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    fireEvent.click(screen.getByRole("button", { name: "System Mono" }));
    expect(onFontModeChange).toHaveBeenCalledWith("system");
  });
});
