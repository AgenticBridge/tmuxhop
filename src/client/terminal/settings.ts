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
export const MIN_TERMINAL_FONT_SIZE_ADJUSTMENT = -2;
export const MAX_TERMINAL_FONT_SIZE_ADJUSTMENT = 6;

export interface TerminalFontModeOption {
  description: string;
  label: string;
  value: TerminalFontMode;
}

const STORAGE_KEY = "tmuxhop.terminal-font-mode";
const FONT_SIZE_ADJUSTMENT_STORAGE_KEY = "tmuxhop.terminal-font-size-adjustment";

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
  storage: Pick<Storage, "getItem"> | undefined = getSafeStorage(),
): TerminalFontMode {
  const value = readStorageValue(storage, STORAGE_KEY);
  if (value === "bundled" || value === "installed-nerd" || value === "system") {
    return value;
  }
  return "bundled";
}

export function saveTerminalFontMode(
  mode: TerminalFontMode,
  storage: Pick<Storage, "setItem"> | undefined = getSafeStorage(),
) {
  writeStorageValue(storage, STORAGE_KEY, mode);
}

export function clampTerminalFontSizeAdjustment(adjustment: number): number {
  return Math.max(
    MIN_TERMINAL_FONT_SIZE_ADJUSTMENT,
    Math.min(MAX_TERMINAL_FONT_SIZE_ADJUSTMENT, Math.trunc(adjustment)),
  );
}

export function loadTerminalFontSizeAdjustment(
  storage: Pick<Storage, "getItem"> | undefined = getSafeStorage(),
): number {
  const value = readStorageValue(storage, FONT_SIZE_ADJUSTMENT_STORAGE_KEY);
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return clampTerminalFontSizeAdjustment(parsed);
}

export function saveTerminalFontSizeAdjustment(
  adjustment: number,
  storage: Pick<Storage, "setItem"> | undefined = getSafeStorage(),
) {
  writeStorageValue(
    storage,
    FONT_SIZE_ADJUSTMENT_STORAGE_KEY,
    String(clampTerminalFontSizeAdjustment(adjustment)),
  );
}

function getSafeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function readStorageValue(
  storage: Pick<Storage, "getItem"> | undefined,
  key: string,
): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorageValue(
  storage: Pick<Storage, "setItem"> | undefined,
  key: string,
  value: string,
) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Ignore storage-restricted environments and keep the current in-memory state.
  }
}
