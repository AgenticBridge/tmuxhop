// @vitest-environment jsdom
/**
 * tmuxhop terminal hook tests.
 *
 * Purpose: verify terminal initialization waits for bundled webfont readiness
 * before creating and fitting xterm on first load.
 *
 * Boundary: client terminal lifecycle coverage only.
 */
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTerminal } from "../src/client/app/hooks/useTerminal.js";

const fontDiagnosticsMock = vi.hoisted(() => ({
  ensureBundledTerminalFontReady: vi.fn(),
}));

const runtimeMock = vi.hoisted(() => ({
  createTerminalRuntime: vi.fn(),
}));

vi.mock("../src/client/terminal/font-diagnostics.js", () => ({
  ensureBundledTerminalFontReady: fontDiagnosticsMock.ensureBundledTerminalFontReady,
}));

vi.mock("../src/client/terminal/runtime.js", () => ({
  createTerminalRuntime: runtimeMock.createTerminalRuntime,
}));

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

function TerminalHarness() {
  const terminal = useTerminal({
    onInput: vi.fn(),
    onReady: vi.fn(),
  });

  return <div ref={terminal.mountRef}></div>;
}

describe("useTerminal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("waits briefly for the bundled font before creating the terminal runtime", async () => {
    vi.useFakeTimers();
    let resolveFontReady: (() => void) | null = null;
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFontReady = resolve;
        }),
    );

    runtimeMock.createTerminalRuntime.mockReturnValue({
      fitAddon: { fit: vi.fn() },
      terminal: {
        dispose: vi.fn(),
        onData: vi.fn(),
        open: vi.fn(),
        reset: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
      },
    });

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    render(<TerminalHarness />);

    expect(fontDiagnosticsMock.ensureBundledTerminalFontReady).toHaveBeenCalledTimes(1);
    expect(runtimeMock.createTerminalRuntime).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    expect(runtimeMock.createTerminalRuntime).toHaveBeenCalledTimes(1);

    resolveFontReady?.();
  });

  it("resyncs terminal sizing after a late bundled font load", async () => {
    vi.useFakeTimers();
    let resolveFontReady: (() => void) | null = null;
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFontReady = resolve;
        }),
    );

    const resize = vi.fn();
    const fit = vi.fn();
    runtimeMock.createTerminalRuntime.mockReturnValue({
      fitAddon: { fit },
      terminal: {
        cols: 90,
        rows: 30,
        dispose: vi.fn(),
        onData: vi.fn(),
        open: vi.fn(),
        reset: vi.fn(),
        resize,
        write: vi.fn(),
      },
    });

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    render(<TerminalHarness />);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    expect(runtimeMock.createTerminalRuntime).toHaveBeenCalledTimes(1);

    resolveFontReady?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(fit).toHaveBeenCalled();
    expect(resize).toHaveBeenCalledWith(90, 30);
  });

  it("scrolls the terminal into view after touch interaction and viewport resize", async () => {
    vi.useFakeTimers();
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockResolvedValueOnce(undefined);
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });

    const visualViewportListeners = new Map<string, EventListener>();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 544,
        offsetTop: 0,
        addEventListener: vi.fn((eventName: string, listener: EventListener) => {
          visualViewportListeners.set(eventName, listener);
        }),
        removeEventListener: vi.fn((eventName: string) => {
          visualViewportListeners.delete(eventName);
        }),
      },
    });

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    runtimeMock.createTerminalRuntime.mockReturnValue({
      fitAddon: { fit: vi.fn() },
      terminal: {
        cols: 90,
        rows: 30,
        dispose: vi.fn(),
        onData: vi.fn(),
        open: vi.fn(),
        reset: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
      },
    });

    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    const { container } = render(<TerminalHarness />);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    const mount = container.firstElementChild as HTMLDivElement;
    fireEvent.touchStart(mount);
    expect(document.body.classList.contains("app-page--terminal-scroll-active")).toBe(true);
    await vi.advanceTimersByTimeAsync(24);

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      block: "end",
      inline: "nearest",
      behavior: "smooth",
    });

    scrollIntoViewSpy.mockClear();
    visualViewportListeners.get("resize")?.(new Event("resize"));
    await vi.advanceTimersByTimeAsync(48);

    expect(document.body.style.getPropertyValue("--terminal-scroll-offset")).toBe("300px");
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      block: "end",
      inline: "nearest",
      behavior: "smooth",
    });

    fireEvent.focusOut(mount);
    expect(document.body.classList.contains("app-page--terminal-scroll-active")).toBe(false);
    expect(document.body.style.getPropertyValue("--terminal-scroll-offset")).toBe("");

    requestAnimationFrameSpy.mockRestore();
  });

  it("ignores mouse pointer interaction for the mobile viewport assist", async () => {
    vi.useFakeTimers();
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockResolvedValueOnce(undefined);

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    runtimeMock.createTerminalRuntime.mockReturnValue({
      fitAddon: { fit: vi.fn() },
      terminal: {
        cols: 90,
        rows: 30,
        dispose: vi.fn(),
        onData: vi.fn(),
        open: vi.fn(),
        reset: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
      },
    });

    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    const { container } = render(<TerminalHarness />);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    const mount = container.firstElementChild as HTMLDivElement;
    fireEvent.pointerDown(mount, { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(24);

    expect(document.body.classList.contains("app-page--terminal-scroll-active")).toBe(false);
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });
});
