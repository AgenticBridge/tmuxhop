const sessionTitle = document.getElementById("session-title");
const connectionStatus = document.getElementById("connection-status");
const emptyState = document.getElementById("empty-state");
const appContent = document.getElementById("app-content");
const controls = document.getElementById("controls");
const windowTabs = document.getElementById("window-tabs");
const paneTabs = document.getElementById("pane-tabs");
const paneTitle = document.getElementById("pane-title");
const paneSubtitle = document.getElementById("pane-subtitle");
const terminalMount = document.getElementById("terminal");

const state = {
  windows: [],
  selectedWindowId: null,
  selectedPaneId: null,
  socket: null,
};

const terminal = new window.Terminal({
  cursorBlink: true,
  convertEol: true,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: 14,
  theme: {
    background: "#111111",
    foreground: "#f2f2eb",
    cursor: "#f2f2eb",
  },
});

terminal.open(terminalMount);

function setStatus(label, tone = "default") {
  connectionStatus.textContent = label;
  connectionStatus.dataset.tone = tone;
}

function getSelectedWindow() {
  return state.windows.find((window) => window.id === state.selectedWindowId) || null;
}

function getSelectedPane() {
  return getSelectedWindow()?.panes.find((pane) => pane.id === state.selectedPaneId) || null;
}

function renderWindowTabs() {
  windowTabs.innerHTML = "";

  state.windows.forEach((window) => {
    const button = document.createElement("button");
    button.className = "tab-button";
    if (window.id === state.selectedWindowId) {
      button.dataset.active = "true";
    }
    button.textContent = `${window.index}: ${window.name}`;
    button.addEventListener("click", () => {
      state.selectedWindowId = window.id;
      state.selectedPaneId = window.panes[0]?.id || null;
      render();
      attachSelectedPane();
    });
    windowTabs.appendChild(button);
  });
}

function renderPaneTabs() {
  paneTabs.innerHTML = "";
  const selectedWindow = getSelectedWindow();
  if (!selectedWindow) {
    return;
  }

  selectedWindow.panes.forEach((pane) => {
    const button = document.createElement("button");
    button.className = "tab-button";
    if (pane.id === state.selectedPaneId) {
      button.dataset.active = "true";
    }
    button.textContent = pane.title || `Pane ${pane.index}`;
    button.addEventListener("click", () => {
      state.selectedPaneId = pane.id;
      render();
      attachSelectedPane();
    });
    paneTabs.appendChild(button);
  });
}

function renderMeta() {
  const pane = getSelectedPane();
  paneTitle.textContent = pane?.title || "Pane";
  paneSubtitle.textContent = pane ? [pane.cwd, pane.command].filter(Boolean).join(" • ") : "";
}

function render() {
  renderWindowTabs();
  renderPaneTabs();
  renderMeta();
}

function teardownSocket() {
  if (state.socket) {
    state.socket.close();
    state.socket = null;
  }
}

function attachSelectedPane() {
  const pane = getSelectedPane();
  teardownSocket();
  terminal.reset();

  if (!pane) {
    setStatus("No Pane", "warn");
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(
    `${protocol}://${window.location.host}/api/panes/${encodeURIComponent(pane.id)}/attach`,
  );

  state.socket = socket;
  setStatus("Connecting", "warn");

  socket.addEventListener("open", () => {
    setStatus("Live", "ok");
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "snapshot") {
      terminal.reset();
      terminal.write(payload.content);
      return;
    }

    if (payload.type === "error") {
      setStatus("Error", "error");
      console.error(payload.message);
    }
  });

  socket.addEventListener("close", () => {
    if (state.socket === socket) {
      setStatus("Disconnected", "warn");
    }
  });
}

async function loadState() {
  const [sessionResponse, windowsResponse] = await Promise.all([
    fetch("/api/session"),
    fetch("/api/windows"),
  ]);

  const session = await sessionResponse.json();
  const windowsPayload = await windowsResponse.json();

  sessionTitle.textContent = session.sessionName || "Shared Session";

  if (!session.exists) {
    emptyState.classList.remove("hidden");
    setStatus("Missing", "warn");
    return;
  }

  emptyState.classList.add("hidden");
  appContent.classList.remove("hidden");
  controls.classList.remove("hidden");

  state.windows = windowsPayload.windows;
  const activePaneId = windowsPayload.activePaneId;
  const activeWindow =
    state.windows.find((window) => window.panes.some((pane) => pane.id === activePaneId)) ||
    state.windows[0];

  state.selectedWindowId = activeWindow?.id || null;
  state.selectedPaneId =
    activeWindow?.panes.find((pane) => pane.id === activePaneId)?.id ||
    activeWindow?.panes[0]?.id ||
    null;

  render();
  attachSelectedPane();
}

terminal.onData((data) => {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  state.socket.send(JSON.stringify({ type: "input", data }));
});

controls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-input]");
  if (!button || !state.socket || state.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  state.socket.send(JSON.stringify({ type: "shortcut", data: button.dataset.input }));
});

loadState().catch((error) => {
  console.error(error);
  setStatus("Error", "error");
});
