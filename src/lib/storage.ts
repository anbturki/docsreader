import { LazyStore } from "@tauri-apps/plugin-store";
import type { ScanResult } from "./scan";

const store = new LazyStore("docsreader.settings.json");

const ROOTS_KEY = "roots";
const LAST_SELECTED_KEY = "lastSelected";
const SCAN_CACHE_KEY = "scanCache";
const VIEW_SETTINGS_KEY = "viewSettings";

export type ContentWidth = "narrow" | "full";
export type FontFamily = "sans" | "serif" | "mono";
export type FontSize = "sm" | "md" | "lg";
export type ColorScheme = "light" | "dark" | "system";
export type AccentColor = "violet" | "blue" | "green" | "orange" | "rose" | "slate";

export const FONT_SIZE_PX: Record<FontSize, number> = {
  sm: 13,
  md: 15,
  lg: 17,
};

export const ACCENT_HUE: Record<AccentColor, number> = {
  violet: 280,
  blue: 240,
  green: 145,
  orange: 40,
  rose: 0,
  slate: 250,
};

export interface ViewSettings {
  width: ContentWidth;
  fontFamily: FontFamily;
  fontSize: FontSize;
  colorScheme: ColorScheme;
  accentColor: AccentColor;
}

export const defaultViewSettings: ViewSettings = {
  width: "narrow",
  fontFamily: "sans",
  fontSize: "md",
  colorScheme: "system",
  accentColor: "violet",
};

interface CachedScan {
  result: ScanResult;
  cachedAt: number;
}

export async function loadRoots(): Promise<string[]> {
  const v = await store.get<string[]>(ROOTS_KEY);
  return Array.isArray(v) ? v : [];
}

export async function saveRoots(roots: string[]): Promise<void> {
  await store.set(ROOTS_KEY, roots);
  await store.save();
}

export async function loadLastSelected(): Promise<string | undefined> {
  const v = await store.get<string>(LAST_SELECTED_KEY);
  return typeof v === "string" ? v : undefined;
}

export async function saveLastSelected(path: string | undefined): Promise<void> {
  if (path) await store.set(LAST_SELECTED_KEY, path);
  else await store.delete(LAST_SELECTED_KEY);
  await store.save();
}

export async function loadScanCache(root: string): Promise<CachedScan | undefined> {
  const all = await store.get<Record<string, CachedScan>>(SCAN_CACHE_KEY);
  if (!all || typeof all !== "object") return undefined;
  const v = all[root];
  if (!v || typeof v !== "object") return undefined;
  if (!v.result || !Array.isArray(v.result.files)) return undefined;
  return v;
}

export async function saveScanCache(root: string, result: ScanResult): Promise<void> {
  const all = (await store.get<Record<string, CachedScan>>(SCAN_CACHE_KEY)) ?? {};
  all[root] = { result, cachedAt: Date.now() };
  await store.set(SCAN_CACHE_KEY, all);
  await store.save();
}

export async function deleteScanCache(root: string): Promise<void> {
  const all = await store.get<Record<string, CachedScan>>(SCAN_CACHE_KEY);
  if (!all) return;
  delete all[root];
  await store.set(SCAN_CACHE_KEY, all);
  await store.save();
}

export async function loadViewSettings(): Promise<ViewSettings> {
  const v = await store.get<Partial<ViewSettings> & { fontSize?: unknown }>(
    VIEW_SETTINGS_KEY
  );
  if (!v || typeof v !== "object") return defaultViewSettings;
  return {
    width: v.width === "full" ? "full" : "narrow",
    fontFamily:
      v.fontFamily === "serif" || v.fontFamily === "mono" ? v.fontFamily : "sans",
    fontSize: normalizeFontSize(v.fontSize),
    colorScheme: normalizeColorScheme(v.colorScheme),
    accentColor: normalizeAccentColor(v.accentColor),
  };
}

function normalizeFontSize(value: unknown): FontSize {
  if (value === "sm" || value === "md" || value === "lg") return value;
  if (typeof value === "number") {
    if (value <= 13) return "sm";
    if (value >= 17) return "lg";
    return "md";
  }
  return defaultViewSettings.fontSize;
}

function normalizeColorScheme(value: unknown): ColorScheme {
  return value === "light" || value === "dark" ? value : "system";
}

function normalizeAccentColor(value: unknown): AccentColor {
  return value === "blue" ||
    value === "green" ||
    value === "orange" ||
    value === "rose" ||
    value === "slate"
    ? value
    : "violet";
}

export async function saveViewSettings(settings: ViewSettings): Promise<void> {
  await store.set(VIEW_SETTINGS_KEY, settings);
  await store.save();
}
