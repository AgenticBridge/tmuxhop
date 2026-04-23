/**
 * PaneHop server tmux adapter.
 *
 * Purpose: isolate all direct interaction with the local `tmux` process and
 * translate tmux state into backend protocol shapes.
 *
 * Boundary: server-only. This module must not import DOM, browser, or client
 * UI code.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  PaneInfo,
  SessionState,
  SessionSummary,
  WindowInfo,
} from "./protocol.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_SESSION = process.env.PANEHOP_SESSION || "panehop";
export const TMUX_BIN = process.env.TMUX_BIN || "/opt/homebrew/bin/tmux";
export const DEFAULT_SCROLLBACK_LINES = Number(process.env.PANEHOP_SCROLLBACK_LINES || 1000);
const FIELD_SEPARATOR = "\t";
const ROW_SEPARATOR = "\n";

type DecodedInput =
  | { mode: "key"; value: string }
  | { mode: "literal"; value: string };

interface RawPaneRow {
  id: string;
  windowId: string;
  index: string;
  active: string;
  title: string;
  cwd: string;
  command: string;
}

interface RawWindowRow {
  id: string;
  index: string;
  name: string;
  active: string;
}

interface RawSessionRow {
  name: string;
  attached: string;
  windows: string;
}

export async function runTmux(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(TMUX_BIN, args, {
      maxBuffer: 1024 * 1024 * 8,
    });
    return stdout.trimEnd();
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function sessionExists(sessionName = DEFAULT_SESSION): Promise<boolean> {
  try {
    await runTmux(["has-session", "-t", sessionName]);
    return true;
  } catch (error) {
    if (getErrorMessage(error).includes("can't find session")) {
      return false;
    }
    throw error;
  }
}

export function pickDefaultSessionName(
  sessions: SessionSummary[],
  preferredSessionName = DEFAULT_SESSION,
): string | null {
  return (
    sessions.find((session) => session.name === preferredSessionName)?.name ??
    sessions[0]?.name ??
    null
  );
}

export function parseRows<T extends string>(
  raw: string,
  fields: readonly T[],
): Array<Record<T, string>> {
  if (!raw) {
    return [];
  }

  return raw
    .split(ROW_SEPARATOR)
    .filter(Boolean)
    .map((row) => {
      const values = row.split(FIELD_SEPARATOR);
      return Object.fromEntries(
        fields.map((field, index) => [field, values[index] ?? ""]),
      ) as Record<T, string>;
    });
}

export function pickActivePaneId(windows: WindowInfo[]): string | null {
  const activeWindow = windows.find((window) => window.active) ?? windows[0] ?? null;
  const activePane =
    activeWindow?.panes.find((pane) => pane.active) ?? activeWindow?.panes[0] ?? null;
  return activePane?.id ?? null;
}

function mapPaneRow(pane: RawPaneRow): PaneInfo {
  return {
    id: pane.id,
    windowId: pane.windowId,
    index: Number(pane.index),
    active: pane.active === "1",
    title: pane.title || `Pane ${pane.index}`,
    cwd: pane.cwd || "",
    command: pane.command || "",
  };
}

function mapWindowRow(window: RawWindowRow, panes: PaneInfo[]): WindowInfo {
  return {
    id: window.id,
    index: Number(window.index),
    name: window.name,
    active: window.active === "1",
    panes: panes.filter((pane) => pane.windowId === window.id),
  };
}

function mapSessionRow(session: RawSessionRow): SessionSummary {
  return {
    name: session.name,
    attached: session.attached !== "0",
    windows: Number(session.windows),
  };
}

export async function listSessions(): Promise<SessionSummary[]> {
  const sessionFormat = [
    "#{session_name}",
    "#{session_attached}",
    "#{session_windows}",
  ].join(FIELD_SEPARATOR);

  try {
    const rawSessions = await runTmux([
      "list-sessions",
      "-F",
      `${sessionFormat}${ROW_SEPARATOR}`,
    ]);

    return parseRows(rawSessions, ["name", "attached", "windows"]).map((session) =>
      mapSessionRow(session as RawSessionRow),
    );
  } catch (error) {
    if (getErrorMessage(error).includes("no server running")) {
      return [];
    }
    throw error;
  }
}

export async function getSessionState(sessionName = DEFAULT_SESSION): Promise<SessionState> {
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
  ]).map((pane) => mapPaneRow(pane as RawPaneRow));

  const windows = parseRows(rawWindows, ["id", "index", "name", "active"]).map((window) =>
    mapWindowRow(window as RawWindowRow, panes),
  );

  return {
    exists: true,
    sessionName,
    windows,
    activePaneId: pickActivePaneId(windows),
  };
}

export async function capturePane(
  paneId: string,
  lines = `-${DEFAULT_SCROLLBACK_LINES}`,
): Promise<string> {
  return runTmux(["capture-pane", "-p", "-J", "-S", lines, "-t", paneId]);
}

export async function capturePaneAnsi(
  paneId: string,
  lines = `-${DEFAULT_SCROLLBACK_LINES}`,
): Promise<string> {
  return runTmux(["capture-pane", "-p", "-e", "-J", "-S", lines, "-t", paneId]);
}

export async function getPaneSessionName(paneId: string): Promise<string> {
  return runTmux(["display-message", "-p", "-t", paneId, "#{session_name}"]);
}

export async function paneExists(paneId: string): Promise<boolean> {
  try {
    await runTmux(["display-message", "-p", "-t", paneId, "#{pane_id}"]);
    return true;
  } catch (error) {
    if (getErrorMessage(error).includes("can't find pane")) {
      return false;
    }
    throw error;
  }
}

export function decodeInput(data: string): DecodedInput {
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

export async function sendInput(paneId: string, data: string): Promise<void> {
  const decoded = decodeInput(data);
  if (decoded.mode === "key") {
    await runTmux(["send-keys", "-t", paneId, decoded.value]);
    return;
  }

  await runTmux(["send-keys", "-l", "-t", paneId, decoded.value]);
}

export async function enablePanePipe(paneId: string, outputPath: string): Promise<void> {
  const command = `cat >> ${quoteShellArg(outputPath)}`;
  await runTmux(["pipe-pane", "-O", "-t", paneId, command]);
}

export async function disablePanePipe(paneId: string): Promise<void> {
  await runTmux(["pipe-pane", "-t", paneId]);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const stderr = (error as Error & { stderr?: Buffer | string }).stderr;
    if (typeof stderr === "string") {
      return stderr.trim() || error.message;
    }
    if (stderr) {
      return stderr.toString().trim() || error.message;
    }
    return error.message;
  }

  return "Unexpected tmux error";
}

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
