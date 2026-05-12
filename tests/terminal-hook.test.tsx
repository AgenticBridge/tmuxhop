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

const onInputSpy = vi.fn();
const onReadySpy = vi.fn();

interface TerminalHarnessProps {
  fontFamily?: string;
  fontSize?: number | null;
  fontMode?: "bundled" | "installed-nerd" | "system";
}

function TerminalHarness(props: TerminalHarnessProps = {}) {
  const {
    fontFamily = '"Tmuxhop Terminal Nerd Font", monospace',
    fontSize = null,
    fontMode = "bundled",
  } = props;
  const terminal = useTerminal({
    fontFamily,
    fontSize,
    fontMode,
    onInput: onInputSpy,
    onReady: onReadySpy,
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
        options: { fontSize: 14 },
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
        options: { fontSize: 14 },
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

  it("locks page scrolling after keyboard resize while keeping the terminal revealed", async () => {
    vi.useFakeTimers();
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockResolvedValueOnce(undefined);
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    let currentScrollY = 20;
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => currentScrollY,
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
        options: { fontSize: 14 },
        open: vi.fn(),
        reset: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
      },
    });

    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation((value: number | ScrollToOptions) => {
      if (typeof value === "number") {
        currentScrollY = value;
        return;
      }
      currentScrollY = value.top ?? currentScrollY;
    });

    const { container } = render(<TerminalHarness />);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    const mount = container.firstElementChild as HTMLDivElement;
    const controls = document.createElement("footer");
    controls.id = "controls";
    Object.defineProperty(controls, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: 840,
        bottom: 940,
        left: 0,
        right: 0,
        width: 0,
        height: 100,
        x: 0,
        y: 840,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(controls);
    Object.defineProperty(mount, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: 120,
        bottom: 880,
        left: 0,
        right: 0,
        width: 0,
        height: 760,
        x: 0,
        y: 120,
        toJSON: () => ({}),
      }),
    });

    fireEvent.touchStart(mount);
    expect(document.body.classList.contains("app-page--keyboard-scroll-locked")).toBe(false);
    await vi.advanceTimersByTimeAsync(24);

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(document.body.classList.contains("app-page--keyboard-scroll-locked")).toBe(false);

    scrollToSpy.mockClear();
    visualViewportListeners.get("resize")?.(new Event("resize"));
    await vi.advanceTimersByTimeAsync(48);

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 428,
      behavior: "smooth",
    });
    await vi.advanceTimersByTimeAsync(240);
    expect(document.body.classList.contains("app-page--keyboard-scroll-locked")).toBe(true);
    expect(document.body.style.getPropertyValue("--terminal-locked-scroll-top")).toBe("");

    const outsideTouchMove = new Event("touchmove", { cancelable: true });
    document.dispatchEvent(outsideTouchMove);
    expect(outsideTouchMove.defaultPrevented).toBe(true);

    fireEvent.focusOut(mount);
    expect(document.body.classList.contains("app-page--keyboard-scroll-locked")).toBe(false);
    expect(document.body.style.getPropertyValue("--terminal-locked-scroll-top")).toBe("");
    controls.remove();
    requestAnimationFrameSpy.mockRestore();
    scrollToSpy.mockRestore();
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
        options: { fontSize: 14 },
        open: vi.fn(),
        reset: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
      },
    });

    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    const { container } = render(<TerminalHarness />);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    const mount = container.firstElementChild as HTMLDivElement;
    fireEvent.pointerDown(mount, { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(24);

    expect(scrollToSpy).not.toHaveBeenCalled();
    scrollToSpy.mockRestore();
  });

  it("switches to a denser terminal font on narrow mobile mounts", async () => {
    vi.useFakeTimers();
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockResolvedValueOnce(undefined);

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });

    const fit = vi.fn();
    const resize = vi.fn();
    const terminal = {
      cols: 90,
      rows: 30,
      dispose: vi.fn(),
      onData: vi.fn(),
      options: { fontSize: 14 },
      open: vi.fn(),
      reset: vi.fn(),
      resize,
      write: vi.fn(),
    };

    runtimeMock.createTerminalRuntime.mockReturnValue({
      fitAddon: { fit },
      terminal,
    });

    const { container } = render(<TerminalHarness />);
    const mount = container.firstElementChild as HTMLDivElement;
    Object.defineProperty(mount, "clientWidth", {
      configurable: true,
      value: 390,
    });

    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    await Promise.resolve();

    expect(terminal.options.fontSize).toBe(12);
    expect(fit).toHaveBeenCalled();
    expect(resize).toHaveBeenCalledWith(90, 30);
  });

  it("refits when the configured terminal font size changes from the settings pane", async () => {
    vi.useFakeTimers();
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockResolvedValue(undefined);

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });

    const fit = vi.fn();
    const resize = vi.fn();
    const terminal = {
      cols: 90,
      rows: 30,
      dispose: vi.fn(),
      onData: vi.fn(),
      options: { fontFamily: '"Tmuxhop Terminal Nerd Font", monospace', fontSize: 14 },
      open: vi.fn(),
      reset: vi.fn(),
      resize,
      write: vi.fn(),
    };

    runtimeMock.createTerminalRuntime.mockReturnValue({
      fitAddon: { fit },
      terminal,
    });

    const { container, rerender } = render(<TerminalHarness />);
    const mount = container.firstElementChild as HTMLDivElement;
    Object.defineProperty(mount, "clientWidth", {
      configurable: true,
      value: 390,
    });

    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    fit.mockClear();
    resize.mockClear();

    rerender(<TerminalHarness fontSize={16} />);
    await Promise.resolve();
    await Promise.resolve();

    expect(terminal.options.fontSize).toBe(16);
    expect(fit).toHaveBeenCalled();
    expect(resize).toHaveBeenCalledWith(90, 30);
  });

  it("keeps a saved absolute terminal font size across viewport changes", async () => {
    vi.useFakeTimers();
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockResolvedValue(undefined);

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });

    const fit = vi.fn();
    const resize = vi.fn();
    const terminal = {
      cols: 90,
      rows: 30,
      dispose: vi.fn(),
      onData: vi.fn(),
      options: { fontFamily: '"Tmuxhop Terminal Nerd Font", monospace', fontSize: 18 },
      open: vi.fn(),
      reset: vi.fn(),
      resize,
      write: vi.fn(),
    };

    runtimeMock.createTerminalRuntime.mockReturnValue({
      fitAddon: { fit },
      terminal,
    });

    const { container } = render(<TerminalHarness fontSize={18} />);
    const mount = container.firstElementChild as HTMLDivElement;
    Object.defineProperty(mount, "clientWidth", {
      configurable: true,
      value: 960,
    });

    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    await Promise.resolve();

    fit.mockClear();
    resize.mockClear();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
    Object.defineProperty(mount, "clientWidth", {
      configurable: true,
      value: 360,
    });

    fireEvent(window, new Event("resize"));
    await Promise.resolve();

    expect(terminal.options.fontSize).toBe(18);
    expect(fit).toHaveBeenCalled();
    expect(resize).not.toHaveBeenCalled();
  });

  it("waits for bundled font loading before refitting when switching from system mode", async () => {
    vi.useFakeTimers();
    let resolveBundledReady: (() => void) | null = null;
    fontDiagnosticsMock.ensureBundledTerminalFontReady.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveBundledReady = resolve;
        }),
    );

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });

    const fit = vi.fn();
    const resize = vi.fn();
    const terminal = {
      cols: 90,
      rows: 30,
      dispose: vi.fn(),
      onData: vi.fn(),
      options: { fontFamily: "system-ui, monospace", fontSize: 14 },
      open: vi.fn(),
      reset: vi.fn(),
      resize,
      write: vi.fn(),
    };

    runtimeMock.createTerminalRuntime.mockReturnValue({
      fitAddon: { fit },
      terminal,
    });

    const { rerender } = render(
      <TerminalHarness fontFamily="system-ui, monospace" fontMode="system" />,
    );
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    fit.mockClear();
    resize.mockClear();

    rerender(<TerminalHarness fontFamily='"Tmuxhop Terminal Nerd Font", monospace' fontMode="bundled" />);
    await Promise.resolve();

    expect(terminal.options.fontFamily).toBe("system-ui, monospace");
    expect(fit).not.toHaveBeenCalled();
    expect(resize).not.toHaveBeenCalled();

    resolveBundledReady?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(terminal.options.fontFamily).toBe('"Tmuxhop Terminal Nerd Font", monospace');
    expect(fit).toHaveBeenCalled();
    expect(resize).toHaveBeenCalledWith(90, 30);
  });

});
