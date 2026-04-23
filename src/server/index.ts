/**
 * tmuxhop server entrypoint.
 *
 * Purpose: create the HTTP server, serve static assets, expose API routes, and
 * manage the WebSocket lifecycle for pane attachment.
 *
 * Boundary: server-only. This module may depend on server protocol and tmux
 * integration, but must not import browser UI code.
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { WebSocketServer, type WebSocket } from "ws";

import type {
  PaneInfo,
  ClientSocketMessage,
  ServerSocketMessage,
  SessionState,
  SessionSummary,
  SessionsResponse,
  WindowsResponse,
} from "./protocol.js";
import { createPaneStream, type PaneStreamOptions } from "./pane-stream.js";
import {
  getSessionState,
  listSessions,
  paneExists,
  pickDefaultSessionName,
  sendInput,
} from "./tmux.js";
import { DEFAULT_SESSION } from "./tmux.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const clientDistDir = path.join(__dirname, "..", "..", "dist", "client");
const clientPagesDir = path.join(clientDistDir, "pages");

export interface PaneStreamLike {
  initialSnapshot: string;
  onData(listener: (chunk: string) => void): void;
  onError(listener: (error: Error) => void): void;
  resize(cols: number, rows: number): void;
  close(): Promise<void>;
}

export interface ServerDependencies {
  listSessions(): Promise<SessionSummary[]>;
  pickDefaultSessionName(
    sessions: SessionSummary[],
    preferredSessionName?: string,
  ): string | null;
  getSessionState(sessionName?: string): Promise<SessionState>;
  paneExists(paneId: string): Promise<boolean>;
  createPaneStream(paneId: string, options?: PaneStreamOptions): Promise<PaneStreamLike>;
  sendInput(paneId: string, data: string): Promise<void>;
}

export interface PaneSocketLike {
  send(data: string): void;
  close(): void;
  on(event: "message", listener: (message: string | Buffer) => void): void;
  on(event: "close", listener: () => void): void;
}

const defaultDependencies: ServerDependencies = {
  listSessions,
  pickDefaultSessionName,
  getSessionState,
  paneExists,
  createPaneStream,
  sendInput,
};

export async function buildSessionsResponse(
  dependencies: ServerDependencies,
): Promise<SessionsResponse> {
  const sessions = await dependencies.listSessions();
  return {
    sessions,
    defaultSessionName: dependencies.pickDefaultSessionName(sessions),
  };
}

export async function buildWindowsResponse(
  dependencies: ServerDependencies,
  sessionName: string,
): Promise<WindowsResponse> {
  const state = await dependencies.getSessionState(sessionName);
  return {
    exists: state.exists,
    sessionName: state.sessionName,
    windows: state.windows,
    activePaneId: state.activePaneId,
  };
}

export function createApp(dependencies: ServerDependencies = defaultDependencies) {
  const app = express();

  app.use(express.json());
  app.use(express.static(clientDistDir));

  app.get("/", (_req: Request, res: Response) => {
    res.sendFile(path.join(clientPagesDir, "index.html"));
  });

  app.get("/app", (_req: Request, res: Response) => {
    res.sendFile(path.join(clientPagesDir, "app.html"));
  });

  app.get("/api/sessions", async (_req: Request, res: Response<SessionsResponse>, next: NextFunction) => {
    try {
      res.json(await buildSessionsResponse(dependencies));
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/windows",
    async (_req: Request, res: Response<WindowsResponse>, next: NextFunction) => {
      try {
        const sessionName = getRequestedSessionName(_req);
        res.json(await buildWindowsResponse(dependencies, sessionName));
      } catch (error) {
        next(error);
      }
    },
  );

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected server error",
    });
  });

  return app;
}

function getRequestedSessionName(request: Request): string {
  const sessionQuery = request.query.session;
  if (typeof sessionQuery === "string" && sessionQuery.trim()) {
    return sessionQuery;
  }
  return DEFAULT_SESSION;
}

function sendMessage(socket: Pick<PaneSocketLike, "send">, message: ServerSocketMessage) {
  socket.send(JSON.stringify(message));
}

function parseClientMessage(raw: string): ClientSocketMessage | null {
  const payload = JSON.parse(raw) as Partial<ClientSocketMessage>;
  if (
    payload.type === "resize" &&
    typeof payload.cols === "number" &&
    Number.isFinite(payload.cols) &&
    typeof payload.rows === "number" &&
    Number.isFinite(payload.rows)
  ) {
    return {
      type: "resize",
      cols: payload.cols,
      rows: payload.rows,
    };
  }

  if (
    (payload.type === "input" || payload.type === "shortcut") &&
    typeof payload.data === "string"
  ) {
    return payload as ClientSocketMessage;
  }
  return null;
}

export async function handlePaneSocket(
  socket: PaneSocketLike,
  paneId: string,
  dependencies: ServerDependencies,
  streamOptions: PaneStreamOptions = {},
) {
  if (!(await dependencies.paneExists(paneId))) {
    sendMessage(socket, { type: "error", message: `Pane ${paneId} not found.` });
    socket.close();
    return;
  }

  let stream;
  try {
    stream = await dependencies.createPaneStream(paneId, streamOptions);
  } catch (error) {
    sendMessage(socket, {
      type: "error",
      message: error instanceof Error ? error.message : "Failed to open pane stream.",
    });
    socket.close();
    return;
  }

  sendMessage(socket, {
    type: "snapshot",
    paneId,
    content: stream.initialSnapshot,
  });

  stream.onData((data) => {
    sendMessage(socket, { type: "data", paneId, data });
  });

  stream.onError((error) => {
    sendMessage(socket, {
      type: "error",
      message: error.message,
    });
    socket.close();
  });

  socket.on("message", async (message) => {
    try {
      const payload = parseClientMessage(message.toString());
      if (!payload) {
        return;
      }

      if (payload.type === "resize") {
        stream.resize(payload.cols, payload.rows);
        return;
      }

      await dependencies.sendInput(paneId, payload.data);
    } catch (error) {
      sendMessage(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "Failed to handle pane input.",
      });
    }
  });

  socket.on("close", () => {
    void stream.close();
  });
}

function parsePaneStreamOptions(requestUrl: URL): PaneStreamOptions {
  const cols = parsePositiveInteger(requestUrl.searchParams.get("cols"));
  const rows = parsePositiveInteger(requestUrl.searchParams.get("rows"));

  if (cols === null || rows === null) {
    return {};
  }

  return {
    initialCols: cols,
    initialRows: rows,
  };
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function createServer(dependencies: ServerDependencies = defaultDependencies) {
  const app = createApp(dependencies);
  const server = http.createServer(app);
  const webSocketServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const match = url.pathname.match(/^\/api\/panes\/(.+)\/attach$/);

    if (!match) {
      socket.destroy();
      return;
    }

    const paneId = decodeURIComponent(match[1] ?? "");
    const streamOptions = parsePaneStreamOptions(url);
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      void handlePaneSocket(webSocket, paneId, dependencies, streamOptions);
    });
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    if (HOST === "0.0.0.0") {
      console.log(`tmuxhop listening on all interfaces at port ${PORT}`);
    }
    console.log(`tmuxhop listening on http://${HOST}:${PORT}`);
    console.log(`Using tmux session: ${DEFAULT_SESSION}`);
  });
}
