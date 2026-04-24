/**
 * tmuxhop terminal settings helpers.
 *
 * Purpose: define the supported terminal font modes, their effective font
 * stacks, and the lightweight browser persistence used by the settings UI.
 *
 * Boundary: client-only. This module must stay free of React and server code.
 */
import { TERMINAL_FONT_STACK } from "./font-diagnostics.js";

export type TerminalFontMode = "bundled" | "installed-nerd" | "system";

export interface TerminalFontModeOption {
  description: string;
  label: string;
  value: TerminalFontMode;
}

const STORAGE_KEY = "tmuxhop.terminal-font-mode";

export const TERMINAL_FONT_MODE_OPTIONS: TerminalFontModeOption[] = [
  {
    value: "bundled",
    label: "IosevkaTerm Nerd Font Mono",
    description: "Use tmuxhop's bundled IosevkaTerm Nerd Font Mono.",
  },
  {
    value: "installed-nerd",
    label: "Installed Nerd Font",
    description: "Prefer a locally installed Nerd Font before falling back.",
  },
  {
    value: "system",
    label: "System Mono",
    description: "Use the browser's system monospace stack.",
  },
];

export const SYSTEM_TERMINAL_FONT_STACK =
  '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

export const INSTALLED_NERD_FONT_STACK =
  '"IosevkaTerm Nerd Font Mono", "IosevkaTerm Nerd Font", "JetBrainsMono Nerd Font", "MesloLGS NF", "SauceCodePro Nerd Font", "CaskaydiaCove Nerd Font", "Iosevka Term", "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

export function getTerminalFontStack(mode: TerminalFontMode): string {
  switch (mode) {
    case "bundled":
      return TERMINAL_FONT_STACK;
    case "installed-nerd":
      return INSTALLED_NERD_FONT_STACK;
    case "system":
      return SYSTEM_TERMINAL_FONT_STACK;
  }
}

export function terminalFontModeNeedsBundledAsset(mode: TerminalFontMode): boolean {
  return mode === "bundled";
}

export function loadTerminalFontMode(
  storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage,
): TerminalFontMode {
  const value = storage?.getItem(STORAGE_KEY);
  if (value === "bundled" || value === "installed-nerd" || value === "system") {
    return value;
  }
  return "bundled";
}

export function saveTerminalFontMode(
  mode: TerminalFontMode,
  storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage,
) {
  storage?.setItem(STORAGE_KEY, mode);
}
