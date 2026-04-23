/**
 * tmuxhop app UI definitions.
 *
 * Purpose: hold stable UI configuration and labels owned by the React app
 * shell.
 *
 * Boundary: client-only. This module contains declarative app-shell UI data
 * and should stay free of DOM and transport side effects.
 */
export type NavScope = "sessions" | "windows" | "panes";
export type StatusTone = "default" | "ok" | "warn" | "error";

export interface StatusState {
  label: string;
  tone: StatusTone;
}

export interface ControlButtonDefinition {
  label: string;
  input: string;
  title?: string;
}

export const NAV_SCOPES: NavScope[] = ["sessions", "windows", "panes"];

export const CONTROL_BUTTONS: ControlButtonDefinition[] = [
  { label: "Esc", input: "\u001b", title: "Escape" },
  { label: "Tab", input: "\t", title: "Tab" },
  { label: "Ctrl+C", input: "\u0003", title: "Interrupt process" },
  { label: "Ctrl+L", input: "\u000c", title: "Clear screen" },
  { label: "↑", input: "\u001b[A", title: "Arrow up" },
  { label: "←", input: "\u001b[D", title: "Arrow left" },
  { label: "↓", input: "\u001b[B", title: "Arrow down" },
  { label: "→", input: "\u001b[C", title: "Arrow right" },
  { label: "Enter", input: "\r", title: "Enter" },
];

export function formatScopeLabel(scope: NavScope): string {
  switch (scope) {
    case "sessions":
      return "Sessions";
    case "windows":
      return "Windows";
    case "panes":
      return "Panes";
  }
}
