import { LazyStore } from "@tauri-apps/plugin-store";
import type { ScanResult } from "./scan";
import { TASK_STATUSES, type TaskStatus } from "./tasks";

const store = new LazyStore("docsreader.settings.json");

const ROOTS_KEY = "roots";
const LAST_SELECTED_KEY = "lastSelected";
const SCAN_CACHE_KEY = "scanCache";
const VIEW_SETTINGS_KEY = "viewSettings";
const TABS_STATE_KEY = "tabsState";
const TABS_STATE_PANE1_KEY = "tabsState.pane1";
const PANE_LAYOUT_KEY = "paneLayout";
const SIDEBAR_STATE_KEY = "sidebarState";
const PINNED_KEY = "pinnedByRoot";
const CONVERT_DECLINED_KEY = "convertDeclined";
const DISMISSED_REGISTRY_KEY = "dismissedRegistry";
const COLLAPSED_TASK_STATUSES_KEY = "collapsedTaskStatusesByRoot";

export const TABS_KEY_PANE0 = TABS_STATE_KEY;
export const TABS_KEY_PANE1 = TABS_STATE_PANE1_KEY;

export type ContentWidth = "narrow" | "full";
export type FontFamily = "sans" | "serif" | "mono";
export type FontSize = "sm" | "md" | "lg";
export const RESOLVED_SCHEMES = ["light", "dark"] as const;
export type ResolvedScheme = (typeof RESOLVED_SCHEMES)[number];
export const COLOR_SCHEMES = [...RESOLVED_SCHEMES, "system"] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];
export const ACCENT_COLORS = [
  "rose",
  "orange",
  "bronze",
  "green",
  "teal",
  "blue",
  "slate",
  "violet",
  "magenta",
  "black",
] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];
export type DefaultFolderState = "expanded" | "top-level" | "collapsed";
export const SIDEBAR_LENSES = ["tree", "recent", "tags", "pinned", "tasks"] as const;
export type SidebarLens = (typeof SIDEBAR_LENSES)[number];

export const LENS_VIEWS = ["board", "list"] as const;
export type LensViewId = (typeof LENS_VIEWS)[number];

// A view is a property of a lens: each lens declares the views it can be shown
// in, first one first. A lens with fewer than two offers the reader no choice.
export const LENS_VIEW_OPTIONS: Record<SidebarLens, readonly LensViewId[]> = {
  tree: [],
  recent: [],
  tags: [],
  pinned: [],
  tasks: ["board", "list"],
};

export type LensViewByLens = Partial<Record<SidebarLens, LensViewId>>;

export function lensViewFor(views: LensViewByLens, lens: SidebarLens): LensViewId | undefined {
  const options = LENS_VIEW_OPTIONS[lens];
  const stored = views[lens];
  return stored && options.includes(stored) ? stored : options[0];
}

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
  md: 16,
  lg: 20,
};

export interface AccentSpec {
  lightness: number;
  chroma: number;
  hue: number;
}

// The only place an accent colour is written down. A hue alone cannot describe
// an achromatic or a muted accent, so each one carries its own lightness and
// chroma; the saturated accents keep the 0.55/0.22 pair they were drawn with,
// because a stored selection must not change colour under anyone. Slate is the
// one exception: at full chroma on a blue hue it rendered as a second Blue, so
// it was rebuilt as the near-neutral its name promises.
export const ACCENT_SPEC: Record<AccentColor, AccentSpec> = {
  rose: { lightness: 0.55, chroma: 0.22, hue: 0 },
  orange: { lightness: 0.55, chroma: 0.22, hue: 40 },
  bronze: { lightness: 0.52, chroma: 0.06, hue: 70 },
  green: { lightness: 0.55, chroma: 0.22, hue: 145 },
  teal: { lightness: 0.51, chroma: 0.22, hue: 195 },
  blue: { lightness: 0.55, chroma: 0.22, hue: 240 },
  slate: { lightness: 0.52, chroma: 0.04, hue: 257 },
  violet: { lightness: 0.55, chroma: 0.22, hue: 280 },
  magenta: { lightness: 0.55, chroma: 0.22, hue: 330 },
  black: { lightness: 0.28, chroma: 0, hue: 0 },
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
  findInDocumentShortcut: string;
  workspaceSearchShortcut: string;
  defaultFolderState: DefaultFolderState;
  hidePatterns: string[];
  sidebarLens: SidebarLens;
  lensViews: LensViewByLens;
  welcomeOpened: boolean;
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
  findInDocumentShortcut: "Mod+F",
  workspaceSearchShortcut: "Mod+Shift+F",
  defaultFolderState: "top-level",
  hidePatterns: [],
  sidebarLens: "tree",
  lensViews: {},
  welcomeOpened: false,
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

// Serializes root/dismissal writes so concurrent callers (launch reconcile,
// the registry watcher, and add/remove) cannot interleave a read-modify-write
// and lose an entry.
let writeChain: Promise<unknown> = Promise.resolve();
function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeChain.then(fn, fn);
  writeChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function saveRoots(roots: string[]): Promise<void> {
  await enqueueWrite(async () => {
    await store.set(ROOTS_KEY, roots);
    await store.save();
  });
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

export async function loadConvertDeclined(): Promise<string[]> {
  const v = await store.get<string[]>(CONVERT_DECLINED_KEY);
  return Array.isArray(v) ? v : [];
}

export async function addConvertDeclined(root: string): Promise<void> {
  const current = await loadConvertDeclined();
  if (current.includes(root)) return;
  await store.set(CONVERT_DECLINED_KEY, [...current, root]);
  await store.save();
}

export async function loadDismissedRegistry(): Promise<string[]> {
  const v = await store.get<string[]>(DISMISSED_REGISTRY_KEY);
  return Array.isArray(v) ? v : [];
}

export async function addDismissedRegistry(path: string): Promise<void> {
  await enqueueWrite(async () => {
    const current = await loadDismissedRegistry();
    if (current.includes(path)) return;
    await store.set(DISMISSED_REGISTRY_KEY, [...current, path]);
    await store.save();
  });
}

export async function removeDismissedRegistry(path: string): Promise<void> {
  await enqueueWrite(async () => {
    const current = await loadDismissedRegistry();
    if (!current.includes(path)) return;
    await store.set(
      DISMISSED_REGISTRY_KEY,
      current.filter((p) => p !== path),
    );
    await store.save();
  });
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
    quickOpenShortcut: normalizeShortcut(
      v.quickOpenShortcut,
      defaultViewSettings.quickOpenShortcut
    ),
    findInDocumentShortcut: normalizeShortcut(
      v.findInDocumentShortcut,
      defaultViewSettings.findInDocumentShortcut
    ),
    workspaceSearchShortcut: normalizeShortcut(
      v.workspaceSearchShortcut,
      defaultViewSettings.workspaceSearchShortcut
    ),
    defaultFolderState: normalizeDefaultFolderState(v.defaultFolderState),
    hidePatterns: normalizeHidePatterns(v.hidePatterns),
    sidebarLens: normalizeSidebarLens(v.sidebarLens),
    lensViews: normalizeLensViews(v.lensViews),
    welcomeOpened: v.welcomeOpened === true,
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

// A cleared or malformed binding falls back to the default rather than
// leaving the action unreachable.
function normalizeShortcut(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeSidebarLens(value: unknown): SidebarLens {
  return typeof value === "string" && (SIDEBAR_LENSES as readonly string[]).includes(value)
    ? (value as SidebarLens)
    : "tree";
}

function normalizeLensViews(value: unknown): LensViewByLens {
  if (!value || typeof value !== "object") return {};
  const stored = value as Record<string, unknown>;
  const out: LensViewByLens = {};
  for (const lens of SIDEBAR_LENSES) {
    const view = stored[lens];
    const options: readonly string[] = LENS_VIEW_OPTIONS[lens];
    if (typeof view === "string" && options.includes(view)) out[lens] = view as LensViewId;
  }
  return out;
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
  return (COLOR_SCHEMES as readonly unknown[]).includes(value)
    ? (value as ColorScheme)
    : defaultViewSettings.colorScheme;
}

function normalizeAccentColor(value: unknown): AccentColor {
  return (ACCENT_COLORS as readonly unknown[]).includes(value)
    ? (value as AccentColor)
    : defaultViewSettings.accentColor;
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

export async function loadTabsState(key: string = TABS_STATE_KEY): Promise<TabsState> {
  const v = await store.get<Partial<TabsState>>(key);
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

export async function saveTabsState(
  state: TabsState,
  key: string = TABS_STATE_KEY
): Promise<void> {
  await store.set(key, state);
  await store.save();
}

export const SPLIT_MODES = ["off", "horizontal", "vertical"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export function isSplitMode(value: unknown): value is SplitMode {
  return SPLIT_MODES.some((mode) => mode === value);
}

export interface PaneLayout {
  split: SplitMode;
  splitSize: number; // pane 0 percentage (0..100); only meaningful when split !== "off"
  activePane: 0 | 1;
}

export const defaultPaneLayout: PaneLayout = {
  split: "off",
  splitSize: 50,
  activePane: 0,
};

export async function loadPaneLayout(): Promise<PaneLayout> {
  const v = await store.get<Partial<PaneLayout>>(PANE_LAYOUT_KEY);
  if (!v || typeof v !== "object") return defaultPaneLayout;
  const split: SplitMode = isSplitMode(v.split) ? v.split : defaultPaneLayout.split;
  const rawSize = typeof v.splitSize === "number" && Number.isFinite(v.splitSize) ? v.splitSize : 50;
  const splitSize = Math.min(85, Math.max(15, rawSize));
  const activePane: 0 | 1 = v.activePane === 1 ? 1 : 0;
  return { split, splitSize, activePane: split === "off" ? 0 : activePane };
}

export async function savePaneLayout(layout: PaneLayout): Promise<void> {
  await store.set(PANE_LAYOUT_KEY, layout);
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

export type CollapsedTaskStatusesByRoot = Record<string, TaskStatus[]>;

export async function loadCollapsedTaskStatuses(): Promise<CollapsedTaskStatusesByRoot> {
  const v = await store.get<Record<string, unknown>>(COLLAPSED_TASK_STATUSES_KEY);
  if (!v || typeof v !== "object") return {};
  const out: CollapsedTaskStatusesByRoot = {};
  for (const [root, statuses] of Object.entries(v)) {
    if (typeof root !== "string" || !Array.isArray(statuses)) continue;
    out[root] = TASK_STATUSES.filter((s) => statuses.includes(s));
  }
  return out;
}

export async function saveCollapsedTaskStatuses(
  collapsed: CollapsedTaskStatusesByRoot
): Promise<void> {
  await store.set(COLLAPSED_TASK_STATUSES_KEY, collapsed);
  await store.save();
}
