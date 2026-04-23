/**
 * PaneHop browser application shell.
 *
 * Purpose: wire DOM events, render the terminal UI, and manage browser-side
 * HTTP/WebSocket interactions.
 *
 * Boundary: client-only. This module may consume backend protocol types, but it
 * must not import server runtime implementation code.
 */
import { Terminal } from "@xterm/xterm";

import type {
  ClientSocketMessage,
  ServerSocketMessage,
  SessionsResponse,
  SessionSummary,
  WindowInfo,
  WindowsResponse,
} from "../server/protocol.js";
import {
  detectFontCompatibility,
  FONT_PROBE_SAMPLE,
  TERMINAL_FONT_STACK,
} from "./font.js";
import { getTerminalDimensions } from "./terminal-size.js";
import {
  getInitialSessionName,
  getInitialSelection,
  getPaneSubtitle,
  getRecoveredSelection,
  getSelectedPane,
  getSelectedWindow,
} from "./state.js";

const sessionTitle = mustElement<HTMLHeadingElement>("session-title");
const connectionStatus = mustElement<HTMLSpanElement>("connection-status");
const reconnectButton = mustElement<HTMLButtonElement>("reconnect-button");
const emptyState = mustElement<HTMLElement>("empty-state");
const appContent = mustElement<HTMLElement>("app-content");
const controls = mustElement<HTMLElement>("controls");
const sessionTabs = mustElement<HTMLElement>("session-tabs");
const windowTabs = mustElement<HTMLElement>("window-tabs");
const paneTabs = mustElement<HTMLElement>("pane-tabs");
const paneTitle = mustElement<HTMLElement>("pane-title");
const paneSubtitle = mustElement<HTMLElement>("pane-subtitle");
const fontCheckCard = mustElement<HTMLElement>("font-check");
const fontCheckHeadline = mustElement<HTMLElement>("font-check-headline");
const fontCheckDetails = mustElement<HTMLElement>("font-check-details");
const fontCheckSample = mustElement<HTMLElement>("font-check-sample");
const fontCheckRefresh = mustElement<HTMLButtonElement>("font-check-refresh");
const terminalMount = mustElement<HTMLElement>("terminal");

interface AppState {
  sessions: SessionSummary[];
  selectedSessionName: string | null;
  windows: WindowInfo[];
  selectedWindowId: string | null;
  selectedPaneId: string | null;
  socket: WebSocket | null;
  socketRevision: number;
  reconnectTimer: number | null;
  lastResize: { cols: number; rows: number } | null;
  reconnectAttempt: number;
}

const state: AppState = {
  sessions: [],
  selectedSessionName: null,
  windows: [],
  selectedWindowId: null,
  selectedPaneId: null,
  socket: null,
  socketRevision: 0,
  reconnectTimer: null,
  lastResize: null,
  reconnectAttempt: 0,
};

const terminal = new Terminal({
  cursorBlink: true,
  convertEol: true,
  fontFamily: TERMINAL_FONT_STACK,
  fontSize: 14,
  scrollback: 5000,
  theme: {
    background: "#111111",
    foreground: "#f2f2eb",
    cursor: "#f2f2eb",
  },
});

terminal.open(terminalMount);

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

function setStatus(label: string, tone: string = "default") {
  connectionStatus.textContent = label;
  connectionStatus.dataset.tone = tone;
}

function clearReconnectTimer() {
  if (state.reconnectTimer !== null) {
    window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
}

function resetPaneSelection() {
  state.windows = [];
  state.selectedWindowId = null;
  state.selectedPaneId = null;
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
      state.selectedPaneId = window.panes[0]?.id ?? null;
      render();
      attachSelectedPane();
    });
    windowTabs.appendChild(button);
  });
}

function renderSessionTabs() {
  sessionTabs.innerHTML = "";

  state.sessions.forEach((session) => {
    const button = document.createElement("button");
    button.className = "tab-button";
    if (session.name === state.selectedSessionName) {
      button.dataset.active = "true";
    }
    button.textContent = `${session.name}${session.attached ? " • attached" : ""}`;
    button.addEventListener("click", () => {
      if (state.selectedSessionName === session.name) {
        return;
      }
      state.selectedSessionName = session.name;
      void loadWindowsForSelectedSession();
    });
    sessionTabs.appendChild(button);
  });
}

function renderPaneTabs() {
  paneTabs.innerHTML = "";
  const selectedWindow = getSelectedWindow(state.windows, state.selectedWindowId);
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
  const pane = getSelectedPane(state.windows, state.selectedWindowId, state.selectedPaneId);
  paneTitle.textContent = pane?.title || "Pane";
  paneSubtitle.textContent = getPaneSubtitle(pane);
}

function render() {
  renderSessionTabs();
  renderWindowTabs();
  renderPaneTabs();
  renderMeta();
}

function renderFontCheck() {
  const report = detectFontCompatibility(TERMINAL_FONT_STACK);

  fontCheckCard.dataset.tone = report.status;
  fontCheckHeadline.textContent = report.headline;
  fontCheckDetails.textContent =
    report.recommendedFonts.length === 0
      ? report.details
      : `${report.details} Install one of: ${report.recommendedFonts.join(", ")}.`;
  fontCheckSample.textContent = FONT_PROBE_SAMPLE;
}

function teardownSocket({ intentional = true }: { intentional?: boolean } = {}) {
  clearReconnectTimer();

  const socket = state.socket;
  state.socket = null;

  if (socket && intentional) {
    socket.close();
  }
}

function sendSocketMessage(payload: ClientSocketMessage) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  state.socket.send(JSON.stringify(payload));
}

function getCurrentTerminalSize() {
  return getTerminalDimensions(terminal, terminalMount);
}

function syncTerminalSize() {
  const dimensions = getCurrentTerminalSize();
  const previous = state.lastResize;

  if (previous?.cols === dimensions.cols && previous.rows === dimensions.rows) {
    return;
  }

  state.lastResize = dimensions;
  terminal.resize(dimensions.cols, dimensions.rows);
  sendSocketMessage({
    type: "resize",
    cols: dimensions.cols,
    rows: dimensions.rows,
  });
}

function buildPaneSocketUrl(paneId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const dimensions = getCurrentTerminalSize();
  const url = new URL(
    `${protocol}://${window.location.host}/api/panes/${encodeURIComponent(paneId)}/attach`,
  );
  url.searchParams.set("cols", String(dimensions.cols));
  url.searchParams.set("rows", String(dimensions.rows));
  return url.toString();
}

function attachSelectedPane({ preserveTerminal = false }: { preserveTerminal?: boolean } = {}) {
  const pane = getSelectedPane(state.windows, state.selectedWindowId, state.selectedPaneId);
  teardownSocket();
  if (!preserveTerminal) {
    terminal.reset();
  }
  state.lastResize = null;

  if (!pane) {
    setStatus("No Pane", "warn");
    return;
  }

  clearReconnectTimer();
  const socket = new WebSocket(buildPaneSocketUrl(pane.id));
  const revision = state.socketRevision + 1;

  state.socket = socket;
  state.socketRevision = revision;
  setStatus("Connecting", "warn");

  socket.addEventListener("open", () => {
    if (state.socket !== socket) {
      return;
    }

    state.reconnectAttempt = 0;
    setStatus("Live", "ok");
    clearReconnectTimer();
    syncTerminalSize();
  });

  socket.addEventListener("message", (event) => {
    if (state.socket !== socket || state.socketRevision !== revision) {
      return;
    }

    const payload = JSON.parse(event.data) as ServerSocketMessage;

    if (payload.type === "snapshot") {
      terminal.reset();
      terminal.write(payload.content);
      return;
    }

    if (payload.type === "data") {
      terminal.write(payload.data);
      return;
    }

    if (payload.type === "error") {
      setStatus("Error", "error");
      console.error(payload.message);
    }
  });

  socket.addEventListener("close", () => {
    if (state.socket === socket) {
      state.socket = null;
      clearReconnectTimer();
      state.reconnectAttempt += 1;
      setStatus(`Reconnecting (${state.reconnectAttempt})`, "warn");
      state.reconnectTimer = window.setTimeout(() => {
        if (state.socket !== null) {
          return;
        }
        void reconnectSelectedPane();
      }, 1000);
    }
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function loadWindowsForSelectedSession({
  preserveSelection = false,
  preserveTerminal = false,
}: {
  preserveSelection?: boolean;
  preserveTerminal?: boolean;
} = {}) {
  const previousSelection = {
    selectedWindowId: state.selectedWindowId,
    selectedPaneId: state.selectedPaneId,
  };

  teardownSocket();
  resetPaneSelection();
  if (!preserveTerminal) {
    terminal.reset();
  }
  state.lastResize = null;
  render();

  if (!state.selectedSessionName) {
    emptyState.classList.remove("hidden");
    appContent.classList.add("hidden");
    controls.classList.add("hidden");
    sessionTitle.textContent = "Select Session";
    setStatus("Missing", "warn");
    return;
  }

  setStatus("Loading", "warn");
  const windowsPayload = await fetchJson<WindowsResponse>(
    `/api/windows?session=${encodeURIComponent(state.selectedSessionName)}`,
  );

  sessionTitle.textContent = windowsPayload.sessionName || "Shared Session";

  if (!windowsPayload.exists) {
    emptyState.classList.remove("hidden");
    setStatus("Missing", "warn");
    return;
  }

  emptyState.classList.add("hidden");
  appContent.classList.remove("hidden");
  controls.classList.remove("hidden");

  state.windows = windowsPayload.windows;
  const selection = preserveSelection
    ? getRecoveredSelection(state.windows, previousSelection, windowsPayload.activePaneId)
    : getInitialSelection(state.windows, windowsPayload.activePaneId);
  state.selectedWindowId = selection.selectedWindowId;
  state.selectedPaneId = selection.selectedPaneId;

  render();
  attachSelectedPane({ preserveTerminal });
}

async function reconnectSelectedPane() {
  if (!state.selectedSessionName) {
    setStatus("Missing", "warn");
    return;
  }

  try {
    await loadWindowsForSelectedSession({
      preserveSelection: true,
      preserveTerminal: true,
    });
  } catch (error) {
    console.error(error);
    setStatus("Error", "error");
    clearReconnectTimer();
    state.reconnectAttempt += 1;
    state.reconnectTimer = window.setTimeout(() => {
      if (state.socket !== null) {
        return;
      }
      void reconnectSelectedPane();
    }, Math.min(5000, 1000 * state.reconnectAttempt));
  }
}

async function loadState() {
  const sessionsPayload = await fetchJson<SessionsResponse>("/api/sessions");

  state.sessions = sessionsPayload.sessions;
  state.selectedSessionName = getInitialSessionName(
    state.sessions,
    sessionsPayload.defaultSessionName,
  );

  if (state.sessions.length === 0) {
    sessionTitle.textContent = "No Sessions";
    emptyState.classList.remove("hidden");
    setStatus("Missing", "warn");
    render();
    return;
  }

  render();
  await loadWindowsForSelectedSession();
}

terminal.onData((data) => {
  sendSocketMessage({ type: "input", data });
});

const resizeObserver = new ResizeObserver(() => {
  syncTerminalSize();
});

resizeObserver.observe(terminalMount);

window.addEventListener("resize", () => {
  syncTerminalSize();
});

controls.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
    "button[data-input]",
  );
  const data = button?.dataset.input;
  if (!data) {
    return;
  }

  sendSocketMessage({ type: "shortcut", data });
});

reconnectButton.addEventListener("click", () => {
  void reconnectSelectedPane();
});

fontCheckRefresh.addEventListener("click", () => {
  renderFontCheck();
});

renderFontCheck();

void loadState().catch((error) => {
  console.error(error);
  setStatus("Error", "error");
});
