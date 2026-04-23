const path = require("node:path");
const http = require("node:http");
const express = require("express");
const { WebSocketServer } = require("ws");

const {
  DEFAULT_SESSION,
  capturePane,
  getSessionState,
  paneExists,
  sendInput,
} = require("./tmux");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "..", "public");
const xtermDir = path.join(__dirname, "..", "node_modules", "@xterm", "xterm");

const app = express();

app.use(express.json());
app.use("/vendor/xterm", express.static(xtermDir));
app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/app", (_req, res) => {
  res.sendFile(path.join(publicDir, "app.html"));
});

app.get("/api/session", async (_req, res, next) => {
  try {
    const state = await getSessionState();
    res.json({
      exists: state.exists,
      sessionName: state.sessionName,
      localOnly: true,
      activePaneId: state.activePaneId,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/windows", async (_req, res, next) => {
  try {
    const state = await getSessionState();
    res.json({
      exists: state.exists,
      sessionName: state.sessionName,
      windows: state.windows,
      activePaneId: state.activePaneId,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: error.message || "Unexpected server error",
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/api\/panes\/(%[^/]+|[^/]+)\/attach$/);

  if (!match) {
    socket.destroy();
    return;
  }

  const paneId = decodeURIComponent(match[1]);
  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.paneId = paneId;
    wss.emit("connection", ws);
  });
});

wss.on("connection", async (ws) => {
  const paneId = ws.paneId;
  let previousSnapshot = "";

  if (!(await paneExists(paneId))) {
    ws.send(JSON.stringify({ type: "error", message: `Pane ${paneId} not found.` }));
    ws.close();
    return;
  }

  const publishSnapshot = async () => {
    try {
      const snapshot = await capturePane(paneId);
      if (snapshot === previousSnapshot) {
        return;
      }

      previousSnapshot = snapshot;
      ws.send(JSON.stringify({ type: "snapshot", paneId, content: snapshot }));
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", message: error.message }));
      ws.close();
    }
  };

  await publishSnapshot();
  const interval = setInterval(publishSnapshot, 350);

  ws.on("message", async (message) => {
    try {
      const payload = JSON.parse(message.toString());
      if ((payload.type === "input" || payload.type === "shortcut") && typeof payload.data === "string") {
        await sendInput(paneId, payload.data);
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", message: error.message }));
    }
  });

  ws.on("close", () => {
    clearInterval(interval);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`PaneHop listening on http://${HOST}:${PORT}`);
  console.log(`Using tmux session: ${DEFAULT_SESSION}`);
});
