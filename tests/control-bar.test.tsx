// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ControlBar } from "../src/client/app/components/ControlBar.js";
import type { ControlButtonDefinition } from "../src/client/app/ui.js";

const CONTROLS: ControlButtonDefinition[] = [{ label: "Enter", input: "\r", title: "Enter" }];

describe("ControlBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("sends plain text and clears the draft", () => {
    const onShortcut = vi.fn();
    const onTextInput = vi.fn();

    render(
      <ControlBar
        controls={CONTROLS}
        onShortcut={onShortcut}
        onTextInput={onTextInput}
        showControls={true}
      />,
    );

    const input = screen.getByLabelText("Mobile terminal input");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onTextInput).toHaveBeenCalledWith("hello");
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("submits text from the send button", () => {
    const onShortcut = vi.fn();
    const onTextInput = vi.fn();

    render(
      <ControlBar
        controls={CONTROLS}
        onShortcut={onShortcut}
        onTextInput={onTextInput}
        showControls={true}
      />,
    );

    const input = screen.getByLabelText("Mobile terminal input");
    fireEvent.change(input, { target: { value: "ls -la" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onTextInput).toHaveBeenCalledWith("ls -la");
    expect((input as HTMLTextAreaElement).value).toBe("");
  });
});
