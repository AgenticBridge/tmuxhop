/**
 * tmuxhop server pane stream bridge.
 *
 * Purpose: bridge a live tmux pane into incremental terminal output suitable
 * for the browser while keeping the pane itself as the source of truth.
 *
 * Boundary: server-only. This module may depend on tmux and filesystem
 * primitives, but must not import client or DOM code.
 */
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";

import { capturePaneAnsi, getPaneSessionName, resolveTmuxBin, TMUX_SOCKET } from "./tmux.js";

export interface PaneStreamOptions {
  initialCols?: number;
  initialRows?: number;
}

export interface PaneStream {
  initialSnapshot: string;
  onData(listener: (chunk: string) => void): void;
  onError(listener: (error: Error) => void): void;
  resize(cols: number, rows: number): void;
  close(): Promise<void>;
}

export async function createPaneStream(
  paneId: string,
  options: PaneStreamOptions = {},
): Promise<PaneStream> {
  const emitter = new EventEmitter();
  let closed = false;
  let buffer = "";
  const tmuxBin = await resolveTmuxBin();
  const sessionName = await getPaneSessionName(paneId);
  const baseArgs = [
    "-C",
    "attach-session",
    "-t",
    sessionName,
    "-f",
    "active-pane,ignore-size,wait-exit",
  ];
  const tmuxArgs = TMUX_SOCKET ? ["-L", TMUX_SOCKET, ...baseArgs] : baseArgs;
  const child = spawn(tmuxBin, tmuxArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;

    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      handleControlModeLine(line, paneId, emitter);
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    const message = chunk.trim();
    if (message) {
      emitter.emit("error", new Error(message));
    }
  });

  child.on("exit", (exitCode, signal) => {
    if (closed) {
      return;
    }

    emitter.emit(
      "error",
      new Error(
        signal
          ? `tmux control-mode client exited with signal ${signal}.`
          : `tmux control-mode client exited with code ${exitCode}.`,
      ),
    );
  });

  if (
    typeof options.initialCols === "number" &&
    Number.isFinite(options.initialCols) &&
    typeof options.initialRows === "number" &&
    Number.isFinite(options.initialRows)
  ) {
    child.stdin.write(`${formatResizeCommand(options.initialCols, options.initialRows)}\n`);
  }

  child.stdin.write(`select-pane -t ${paneId}\n`);
  const initialSnapshot = await capturePaneAnsi(paneId);

  return {
    initialSnapshot,
    onData(listener) {
      emitter.on("data", listener);
    },
    onError(listener) {
      emitter.on("error", listener);
    },
    resize(cols, rows) {
      child.stdin.write(`${formatResizeCommand(cols, rows)}\n`);
    },
    async close() {
      if (closed) {
        return;
      }

      closed = true;
      try {
        child.stdin.write("\n");
      } finally {
        child.kill("SIGTERM");
      }
    },
  };
}

export function formatResizeCommand(cols: number, rows: number): string {
  const safeCols = Math.max(20, Math.floor(cols));
  const safeRows = Math.max(8, Math.floor(rows));
  return `refresh-client -C ${safeCols}x${safeRows}`;
}

export function decodeControlModeText(value: string): string {
  return value.replace(/\\([0-7]{3}|\\)/g, (_match, escaped: string) => {
    if (escaped === "\\") {
      return "\\";
    }

    return String.fromCharCode(Number.parseInt(escaped, 8));
  });
}

export function parseControlModeOutput(
  line: string,
): { kind: "data"; paneId: string; data: string } | { kind: "ignore" } | { kind: "exit"; reason: string } {
  if (line.startsWith("%output ")) {
    const match = line.match(/^%output (\S+) (.*)$/);
    if (!match) {
      return { kind: "ignore" };
    }

    return {
      kind: "data",
      paneId: match[1] ?? "",
      data: decodeControlModeText(match[2] ?? ""),
    };
  }

  if (line.startsWith("%extended-output ")) {
    const match = line.match(/^%extended-output (\S+) [^:]*: ?(.*)$/);
    if (!match) {
      return { kind: "ignore" };
    }

    return {
      kind: "data",
      paneId: match[1] ?? "",
      data: decodeControlModeText(match[2] ?? ""),
    };
  }

  if (line.startsWith("%exit")) {
    return {
      kind: "exit",
      reason: line.slice("%exit".length).trim(),
    };
  }

  return { kind: "ignore" };
}

function handleControlModeLine(
  line: string,
  targetPaneId: string,
  emitter: EventEmitter,
) {
  const parsed = parseControlModeOutput(line);
  if (parsed.kind === "data" && parsed.paneId === targetPaneId) {
    emitter.emit("data", parsed.data);
    return;
  }

  if (parsed.kind === "exit") {
    emitter.emit(
      "error",
      new Error(parsed.reason || "tmux control-mode client exited unexpectedly."),
    );
  }
}
