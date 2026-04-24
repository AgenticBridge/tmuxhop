/**
 * tmuxhop server integration tests.
 *
 * Purpose: verify HTTP routes and websocket pane behavior using injected server
 * dependencies instead of a live tmux process.
 *
 * Boundary: server integration coverage only.
 */
import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSessionsResponse,
  buildWindowsResponse,
  handlePaneSocket,
  type PaneSocketLike,
  type PaneStreamLike,
  type ServerDependencies,
} from "../src/server/index.js";
import type { SessionState, SessionSummary } from "../src/server/protocol.js";

class MockPaneStream implements PaneStreamLike {
  initialSnapshot: string;
  private readonly emitter = new EventEmitter();
  close = vi.fn(async () => undefined);
  resize = vi.fn((_cols: number, _rows: number) => undefined);

  constructor(initialSnapshot: string) {
    this.initialSnapshot = initialSnapshot;
  }

  onData(listener: (chunk: string) => void): void {
    this.emitter.on("data", listener);
  }

  onError(listener: (error: Error) => void): void {
    this.emitter.on("error", listener);
  }

  emitData(data: string) {
    this.emitter.emit("data", data);
  }

  emitError(error: Error) {
    this.emitter.emit("error", error);
  }
}

class MockSocket extends EventEmitter implements PaneSocketLike {
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.emit("close");
  }
}

const sessions: SessionSummary[] = [
  { name: "tmuxhop", attached: true, windows: 2 },
  { name: "notes", attached: false, windows: 1 },
];

const sessionState: SessionState = {
  exists: true,
  sessionName: "tmuxhop",
  activePaneId: "%1",
  windows: [
    {
      id: "@1",
      index: 0,
      name: "code",
      active: true,
      panes: [
        {
          id: "%1",
          windowId: "@1",
          index: 0,
          active: true,
          title: "editor",
          cwd: "/repo",
          command: "zsh",
        },
      ],
    },
  ],
};

describe("createServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeDependencies(overrides: Partial<ServerDependencies> = {}) {
    const stream = new MockPaneStream("\u001b[32minitial\u001b[0m");
    const deps: ServerDependencies = {
      listSessions: vi.fn(async () => sessions),
      pickDefaultSessionName: vi.fn((sessionList) => sessionList[0]?.name ?? null),
      getSessionState: vi.fn(async () => sessionState),
      paneExists: vi.fn(async () => true),
      createPaneStream: vi.fn(async () => stream),
      sendInput: vi.fn(async () => undefined),
      mutatePath: vi.fn(async () => ({
        sessionName: "tmuxhop",
        windowId: "@1",
        paneId: "%1",
      })),
      ...overrides,
    };

    return { deps, stream };
  }

  it("serves the session list endpoint", async () => {
    const { deps } = makeDependencies();
    const payload = await buildSessionsResponse(deps);

    expect(payload).toEqual({
      sessions,
      defaultSessionName: "tmuxhop",
    });
  });

  it("serves session-scoped windows", async () => {
    const { deps } = makeDependencies();
    const payload = await buildWindowsResponse(deps, "notes");

    expect(payload.sessionName).toBe("tmuxhop");
    expect(deps.getSessionState).toHaveBeenCalledWith("notes");
  });

  it("streams a snapshot, incremental data, and forwards input over websocket", async () => {
    const { deps, stream } = makeDependencies();
    const socket = new MockSocket();
    const messages: Array<{ type: string; [key: string]: unknown }> = [];

    await handlePaneSocket(socket, "%1", deps);

    messages.push(
      ...socket.sent.map(
        (entry) => JSON.parse(entry) as { type: string; [key: string]: unknown },
      ),
    );
    stream.emitData("\u001b[31mnext\u001b[0m");
    await Promise.resolve();
    messages.push(
      ...socket.sent
        .slice(messages.length)
        .map((entry) => JSON.parse(entry) as { type: string; [key: string]: unknown }),
    );

    socket.emit("message", JSON.stringify({ type: "input", data: "ls" }));
    await Promise.resolve();

    expect(messages[0]).toEqual({
      type: "snapshot",
      paneId: "%1",
      content: "\u001b[32minitial\u001b[0m",
    });
    expect(messages[1]).toEqual({
      type: "data",
      paneId: "%1",
      data: "\u001b[31mnext\u001b[0m",
    });
    expect(deps.sendInput).toHaveBeenCalledWith("%1", "ls");
    expect(deps.createPaneStream).toHaveBeenCalledWith("%1", {});
  });

  it("forwards terminal resize messages to the pane stream", async () => {
    const { deps, stream } = makeDependencies();
    const socket = new MockSocket();

    await handlePaneSocket(socket, "%1", deps);
    socket.emit("message", JSON.stringify({ type: "resize", cols: 98, rows: 28 }));
    await Promise.resolve();

    expect(stream.resize).toHaveBeenCalledWith(98, 28);
    expect(deps.sendInput).not.toHaveBeenCalled();
  });

  it("passes initial terminal size to the pane stream on attach", async () => {
    const { deps } = makeDependencies();
    const socket = new MockSocket();

    await handlePaneSocket(socket, "%1", deps, {
      initialCols: 120,
      initialRows: 34,
    });

    expect(deps.createPaneStream).toHaveBeenCalledWith("%1", {
      initialCols: 120,
      initialRows: 34,
    });
  });

  it("forwards ANSI-rich shell output chunks without rewriting them", async () => {
    const { deps, stream } = makeDependencies();
    const socket = new MockSocket();

    await handlePaneSocket(socket, "%1", deps);
    stream.emitData("\u001b[38;5;240m╭─\u001b[0m\u001b[38;5;31m prompt\u001b[0m\r\n");
    await Promise.resolve();

    const messages = socket.sent.map((entry) => JSON.parse(entry) as { type: string; data?: string });
    expect(messages[1]).toEqual({
      type: "data",
      paneId: "%1",
      data: "\u001b[38;5;240m╭─\u001b[0m\u001b[38;5;31m prompt\u001b[0m\r\n",
    });
  });

  it("forwards fullscreen app escape sequences unchanged", async () => {
    const { deps, stream } = makeDependencies();
    const socket = new MockSocket();

    await handlePaneSocket(socket, "%1", deps);
    stream.emitData("\u001b[?1049h\u001b[?1h\u001b=\ralpha\r\nbeta\r\n\u001b[7m(END)\u001b[27m");
    await Promise.resolve();

    const messages = socket.sent.map((entry) => JSON.parse(entry) as { type: string; data?: string });
    expect(messages[1]).toEqual({
      type: "data",
      paneId: "%1",
      data: "\u001b[?1049h\u001b[?1h\u001b=\ralpha\r\nbeta\r\n\u001b[7m(END)\u001b[27m",
    });
  });

  it("returns a websocket error when the pane does not exist", async () => {
    const { deps } = makeDependencies({
      paneExists: vi.fn(async () => false),
    });
    const socket = new MockSocket();

    await handlePaneSocket(socket, "%1", deps);
    const message = JSON.parse(socket.sent[0] ?? "{}") as { type: string; message: string };

    expect(message).toEqual({
      type: "error",
      message: "Pane %1 not found.",
    });
    expect(socket.closed).toBe(true);
  });
});
