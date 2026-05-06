import { LazyStore } from "@tauri-apps/plugin-store";
import type { ScanResult } from "./scan";

const store = new LazyStore("docsreader.settings.json");

const ROOTS_KEY = "roots";
const LAST_SELECTED_KEY = "lastSelected";
const SCAN_CACHE_KEY = "scanCache";
const VIEW_SETTINGS_KEY = "viewSettings";
const TABS_STATE_KEY = "tabsState";
const SIDEBAR_STATE_KEY = "sidebarState";
const PINNED_KEY = "pinnedByRoot";

export type ContentWidth = "narrow" | "full";
export type FontFamily = "sans" | "serif" | "mono";
export type FontSize = "sm" | "md" | "lg";
export type ColorScheme = "light" | "dark" | "system";
export type AccentColor = "violet" | "blue" | "green" | "orange" | "rose" | "slate";
export type DefaultFolderState = "expanded" | "top-level" | "collapsed";
export type SidebarLens = "tree" | "recent" | "tags" | "pinned";
export type DiffViewMode = "unified" | "split";

export const LIGHT_CODE_THEMES = [
  "github-light",
  "vitesse-light",
  "one-light",
  "min-light",
  "light-plus",
] as const;
export const DARK_CODE_THEMES = [
  "github-dark",
  "vitesse-dark",
  "dracula",
  "one-dark-pro",
  "monokai",
  "tokyo-night",
  "nord",
] as const;
export type LightCodeTheme = (typeof LIGHT_CODE_THEMES)[number];
export type DarkCodeTheme = (typeof DARK_CODE_THEMES)[number];

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
  codeThemeLight: LightCodeTheme;
  codeThemeDark: DarkCodeTheme;
  outlineOpen: boolean;
  quickOpenShortcut: string;
  defaultFolderState: DefaultFolderState;
  hidePatterns: string[];
  sidebarLens: SidebarLens;
  welcomeOpened: boolean;
  showInternal: boolean;
  autoReloadOnExternalChange: boolean;
  diffViewMode: DiffViewMode;
}

export const defaultViewSettings: ViewSettings = {
  width: "narrow",
  fontFamily: "sans",
  fontSize: "md",
  colorScheme: "system",
  accentColor: "violet",
  codeThemeLight: "github-light",
  codeThemeDark: "github-dark",
  outlineOpen: true,
  quickOpenShortcut: "Mod+P",
  defaultFolderState: "top-level",
  hidePatterns: [],
  sidebarLens: "tree",
  welcomeOpened: false,
  showInternal: true,
  autoReloadOnExternalChange: false,
  diffViewMode: "unified",
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
    codeThemeLight: (LIGHT_CODE_THEMES as readonly string[]).includes(
      v.codeThemeLight as string
    )
      ? (v.codeThemeLight as LightCodeTheme)
      : defaultViewSettings.codeThemeLight,
    codeThemeDark: (DARK_CODE_THEMES as readonly string[]).includes(
      v.codeThemeDark as string
    )
      ? (v.codeThemeDark as DarkCodeTheme)
      : defaultViewSettings.codeThemeDark,
    outlineOpen: typeof v.outlineOpen === "boolean" ? v.outlineOpen : defaultViewSettings.outlineOpen,
    quickOpenShortcut:
      typeof v.quickOpenShortcut === "string" && v.quickOpenShortcut.length > 0
        ? v.quickOpenShortcut
        : defaultViewSettings.quickOpenShortcut,
    defaultFolderState: normalizeDefaultFolderState(v.defaultFolderState),
    hidePatterns: normalizeHidePatterns(v.hidePatterns),
    sidebarLens: normalizeSidebarLens(v.sidebarLens),
    welcomeOpened: v.welcomeOpened === true,
    showInternal: typeof v.showInternal === "boolean" ? v.showInternal : true,
    autoReloadOnExternalChange: v.autoReloadOnExternalChange === true,
    diffViewMode: v.diffViewMode === "split" ? "split" : "unified",
  };
}

function normalizeDefaultFolderState(value: unknown): DefaultFolderState {
  return value === "expanded" || value === "collapsed" ? value : "top-level";
}

function normalizeHidePatterns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

function normalizeSidebarLens(value: unknown): SidebarLens {
  return value === "recent" || value === "tags" || value === "pinned" ? value : "tree";
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

export interface TabsState {
  paths: string[];
  activePath?: string;
  scrollByPath: Record<string, number>;
}

const emptyTabsState: TabsState = { paths: [], scrollByPath: {} };

export async function loadTabsState(): Promise<TabsState> {
  const v = await store.get<Partial<TabsState>>(TABS_STATE_KEY);
  if (!v || typeof v !== "object") return emptyTabsState;
  const paths = Array.isArray(v.paths) ? v.paths.filter((p) => typeof p === "string") : [];
  const activePath =
    typeof v.activePath === "string" && paths.includes(v.activePath) ? v.activePath : undefined;
  const scrollByPath: Record<string, number> = {};
  if (v.scrollByPath && typeof v.scrollByPath === "object") {
    for (const [k, n] of Object.entries(v.scrollByPath)) {
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) scrollByPath[k] = n;
    }
  }
  return { paths, activePath, scrollByPath };
}

export async function saveTabsState(state: TabsState): Promise<void> {
  await store.set(TABS_STATE_KEY, state);
  await store.save();
}

export interface SidebarState {
  open: boolean;
  expanded: Record<string, boolean>;
}

const defaultSidebarState: SidebarState = { open: true, expanded: {} };

export async function loadSidebarState(): Promise<SidebarState> {
  const v = await store.get<Partial<SidebarState>>(SIDEBAR_STATE_KEY);
  if (!v || typeof v !== "object") return defaultSidebarState;
  const expanded: Record<string, boolean> = {};
  if (v.expanded && typeof v.expanded === "object") {
    for (const [k, val] of Object.entries(v.expanded)) {
      if (typeof k === "string" && typeof val === "boolean") expanded[k] = val;
    }
  }
  return {
    open: typeof v.open === "boolean" ? v.open : defaultSidebarState.open,
    expanded,
  };
}

export async function saveSidebarState(state: SidebarState): Promise<void> {
  await store.set(SIDEBAR_STATE_KEY, state);
  await store.save();
}

export type PinnedByRoot = Record<string, string[]>;

export async function loadPinned(): Promise<PinnedByRoot> {
  const v = await store.get<PinnedByRoot>(PINNED_KEY);
  if (!v || typeof v !== "object") return {};
  const out: PinnedByRoot = {};
  for (const [root, paths] of Object.entries(v)) {
    if (typeof root !== "string" || !Array.isArray(paths)) continue;
    out[root] = paths.filter((p) => typeof p === "string");
  }
  return out;
}

export async function savePinned(pinned: PinnedByRoot): Promise<void> {
  await store.set(PINNED_KEY, pinned);
  await store.save();
}
