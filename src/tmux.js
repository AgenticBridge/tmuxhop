const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const DEFAULT_SESSION = process.env.PANEHOP_SESSION || "panehop";
const FIELD_SEPARATOR = "\t";
const ROW_SEPARATOR = "\n";

async function runTmux(args) {
  try {
    const { stdout } = await execFileAsync("tmux", args, {
      maxBuffer: 1024 * 1024 * 8,
    });
    return stdout.trimEnd();
  } catch (error) {
    const stderr = error.stderr?.toString() || "";
    const message = stderr.trim() || error.message;
    error.message = message;
    throw error;
  }
}

async function sessionExists(sessionName = DEFAULT_SESSION) {
  try {
    await runTmux(["has-session", "-t", sessionName]);
    return true;
  } catch (error) {
    if (error.message.includes("can't find session")) {
      return false;
    }
    throw error;
  }
}

function parseRows(raw, fields) {
  if (!raw) {
    return [];
  }

  return raw
    .split(ROW_SEPARATOR)
    .filter(Boolean)
    .map((row) => {
      const values = row.split(FIELD_SEPARATOR);
      return Object.fromEntries(fields.map((field, index) => [field, values[index] ?? ""]));
    });
}

async function getSessionState(sessionName = DEFAULT_SESSION) {
  const exists = await sessionExists(sessionName);
  if (!exists) {
    return {
      exists: false,
      sessionName,
      windows: [],
      activePaneId: null,
    };
  }

  const windowFormat = [
    "#{window_id}",
    "#{window_index}",
    "#{window_name}",
    "#{window_active}",
  ].join(FIELD_SEPARATOR);

  const paneFormat = [
    "#{pane_id}",
    "#{window_id}",
    "#{pane_index}",
    "#{pane_active}",
    "#{pane_title}",
    "#{pane_current_path}",
    "#{pane_current_command}",
  ].join(FIELD_SEPARATOR);

  const [rawWindows, rawPanes] = await Promise.all([
    runTmux(["list-windows", "-t", sessionName, "-F", `${windowFormat}${ROW_SEPARATOR}`]),
    runTmux(["list-panes", "-t", `${sessionName}:`, "-a", "-F", `${paneFormat}${ROW_SEPARATOR}`]),
  ]);

  const panes = parseRows(rawPanes, [
    "id",
    "windowId",
    "index",
    "active",
    "title",
    "cwd",
    "command",
  ]).map((pane) => ({
    id: pane.id,
    windowId: pane.windowId,
    index: Number(pane.index),
    active: pane.active === "1",
    title: pane.title || `Pane ${pane.index}`,
    cwd: pane.cwd || "",
    command: pane.command || "",
  }));

  const windows = parseRows(rawWindows, ["id", "index", "name", "active"]).map((window) => ({
    id: window.id,
    index: Number(window.index),
    name: window.name,
    active: window.active === "1",
    panes: panes.filter((pane) => pane.windowId === window.id),
  }));

  const activeWindow = windows.find((window) => window.active) || windows[0] || null;
  const activePane =
    activeWindow?.panes.find((pane) => pane.active) || activeWindow?.panes[0] || null;

  return {
    exists: true,
    sessionName,
    windows,
    activePaneId: activePane?.id ?? null,
  };
}

async function capturePane(paneId, lines = "-200") {
  return runTmux(["capture-pane", "-p", "-J", "-S", lines, "-t", paneId]);
}

async function paneExists(paneId) {
  try {
    await runTmux(["display-message", "-p", "-t", paneId, "#{pane_id}"]);
    return true;
  } catch (error) {
    if (error.message.includes("can't find pane")) {
      return false;
    }
    throw error;
  }
}

function decodeInput(data) {
  switch (data) {
    case "\r":
      return { mode: "key", value: "Enter" };
    case "\u007f":
      return { mode: "key", value: "BSpace" };
    case "\t":
      return { mode: "key", value: "Tab" };
    case "\u001b":
      return { mode: "key", value: "Escape" };
    case "\u001b[A":
      return { mode: "key", value: "Up" };
    case "\u001b[B":
      return { mode: "key", value: "Down" };
    case "\u001b[C":
      return { mode: "key", value: "Right" };
    case "\u001b[D":
      return { mode: "key", value: "Left" };
    case "\u0003":
      return { mode: "key", value: "C-c" };
    case "\u000c":
      return { mode: "key", value: "C-l" };
    default:
      return { mode: "literal", value: data };
  }
}

async function sendInput(paneId, data) {
  const decoded = decodeInput(data);
  if (decoded.mode === "key") {
    await runTmux(["send-keys", "-t", paneId, decoded.value]);
    return;
  }

  await runTmux(["send-keys", "-l", "-t", paneId, decoded.value]);
}

module.exports = {
  DEFAULT_SESSION,
  capturePane,
  getSessionState,
  paneExists,
  sendInput,
  sessionExists,
};
