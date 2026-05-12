/**
 * tmuxhop terminal settings helpers.
 *
 * Purpose: define the supported terminal font modes, their effective font
 * stacks, and the lightweight browser persistence used by the settings UI.
 *
 * Boundary: client-only. This module must stay free of React and server code.
 */
import { TERMINAL_FONT_STACK } from "./font-diagnostics.js";
import { clampTerminalFontSize, getResponsiveTerminalFontSize } from "./size.js";

export type TerminalFontMode = "bundled" | "installed-nerd" | "system";
type TerminalSettingsStorage = Partial<Pick<Storage, "getItem" | "setItem" | "removeItem">>;

export interface TerminalFontModeOption {
  description: string;
  label: string;
  value: TerminalFontMode;
}

const STORAGE_KEY = "tmuxhop.terminal-font-mode";
const FONT_SIZE_STORAGE_KEY = "tmuxhop.terminal-font-size";
// TODO: Remove this migration fallback after v0.3.0 ships.
const LEGACY_FONT_SIZE_ADJUSTMENT_STORAGE_KEY = "tmuxhop.terminal-font-size-adjustment";
const MIN_LEGACY_FONT_SIZE_ADJUSTMENT = -2;
const MAX_LEGACY_FONT_SIZE_ADJUSTMENT = 6;

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
  storage: TerminalSettingsStorage | undefined = getSafeStorage(),
): TerminalFontMode {
  const value = readStorageValue(storage, STORAGE_KEY);
  if (value === "bundled" || value === "installed-nerd" || value === "system") {
    return value;
  }
  return "bundled";
}

export function saveTerminalFontMode(
  mode: TerminalFontMode,
  storage: TerminalSettingsStorage | undefined = getSafeStorage(),
) {
  writeStorageValue(storage, STORAGE_KEY, mode);
}

export function loadTerminalFontSize(
  storage: TerminalSettingsStorage | undefined = getSafeStorage(),
  viewportWidth: number | undefined = getSafeViewportWidth(),
): number | null {
  const value = readStorageValue(storage, FONT_SIZE_STORAGE_KEY);
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed)) {
    return clampTerminalFontSize(parsed);
  }

  const legacyAdjustment = loadLegacyTerminalFontSizeAdjustment(storage);
  if (legacyAdjustment === null) {
    return null;
  }

  const migratedFontSize = clampTerminalFontSize(
    getResponsiveTerminalFontSize({
      mountWidth: viewportWidth ?? 0,
      viewportWidth,
    }) + legacyAdjustment,
  );

  if (writeStorageValue(storage, FONT_SIZE_STORAGE_KEY, String(migratedFontSize))) {
    removeStorageValue(storage, LEGACY_FONT_SIZE_ADJUSTMENT_STORAGE_KEY);
  }

  return migratedFontSize;
}

export function saveTerminalFontSize(
  fontSize: number,
  storage: TerminalSettingsStorage | undefined = getSafeStorage(),
) {
  writeStorageValue(
    storage,
    FONT_SIZE_STORAGE_KEY,
    String(clampTerminalFontSize(fontSize)),
  );
}

function loadLegacyTerminalFontSizeAdjustment(
  storage: TerminalSettingsStorage | undefined,
): number | null {
  const value = readStorageValue(storage, LEGACY_FONT_SIZE_ADJUSTMENT_STORAGE_KEY);
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(
    MIN_LEGACY_FONT_SIZE_ADJUSTMENT,
    Math.min(MAX_LEGACY_FONT_SIZE_ADJUSTMENT, Math.trunc(parsed)),
  );
}

function getSafeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function getSafeViewportWidth(): number | undefined {
  try {
    return globalThis.window?.innerWidth;
  } catch {
    return undefined;
  }
}

function readStorageValue(
  storage: TerminalSettingsStorage | undefined,
  key: string,
): string | null {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorageValue(
  storage: TerminalSettingsStorage | undefined,
  key: string,
  value: string,
) {
  try {
    storage?.setItem?.(key, value);
    return true;
  } catch {
    // Ignore storage-restricted environments and keep the current in-memory state.
    return false;
  }
}

function removeStorageValue(
  storage: TerminalSettingsStorage | undefined,
  key: string,
) {
  try {
    storage?.removeItem?.(key);
  } catch {
    // Ignore storage-restricted environments and keep the current in-memory state.
  }
}
