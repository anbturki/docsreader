import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import { Columns2, ListTree, Rows2, Square, Settings as SettingsIcon } from "lucide-react";
import type { QuickOpenFile } from "@/components/quickopen/QuickOpenDialog";
import type { SettingsSection } from "@/components/settings/SettingsDialog";
import { OutlinePanel } from "@/components/document/OutlinePanel";
import { matchShortcut, parseShortcut } from "@/lib/shortcuts";

const QuickOpenDialog = lazy(() => import("@/components/quickopen/QuickOpenDialog"));
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ExplorerSidebar,
  type ResolvedCrossLink,
} from "@/components/explorer/ExplorerSidebar";
import { PathBreadcrumb } from "@/components/document/PathBreadcrumb";
import { PaneView } from "@/components/document/PaneView";

const SettingsDialog = lazy(() => import("@/components/settings/SettingsDialog"));
import { useLibrary } from "@/hooks/useLibrary";
import { usePanes } from "@/hooks/usePanes";
import type { SplitMode } from "@/lib/storage";
import { useTheme } from "@/hooks/useTheme";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useSidebarState } from "@/hooks/useSidebarState";
import { usePinned } from "@/hooks/usePinned";
import { buildTree } from "@/lib/tree";
import { buildCuratedTree } from "@/lib/curatedTree";
import { collectDirKeys } from "@/components/explorer/FileTree";
import { buildHideMatcher } from "@/lib/match";
import { basename } from "@/lib/path";
import {
  getIgnorePatterns,
  getProjectMeta,
  hasNavigation,
  type ProjectMeta,
} from "@/lib/docsYaml";
import { computeManifestIssues } from "@/lib/manifestIssues";
import { fetchGitHead, type GitFileStatusKind } from "@/lib/git";
import { parseFrontmatter } from "@/lib/scan";
import { DiffViewerDialog } from "@/components/document/DiffViewerDialog";
import type { MarkdownFile } from "@/lib/scan";
import "@/styles/code-theme.css";

function App() {
  const library = useLibrary();
  const viewSettings = useViewSettings();
  const panes = usePanes({
    autoReloadOnExternalChange: viewSettings.settings.autoReloadOnExternalChange,
  });
  const tabs = panes.activePane;
  const sidebar = useSidebarState(viewSettings.settings.defaultFolderState);
  const pinned = usePinned();
  useTheme(viewSettings.settings.colorScheme, viewSettings.settings.accentColor);
  const deferredSettings = useDeferredValue(viewSettings.settings);
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | undefined>();
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickOpenMounted, setQuickOpenMounted] = useState(false);
  const [scrollElByPane, setScrollElByPane] = useState<[HTMLElement | null, HTMLElement | null]>([
    null,
    null,
  ]);
  const activeScrollEl = scrollElByPane[panes.layout.activePane];

  const handleScrollElChange0 = useCallback((el: HTMLElement | null) => {
    setScrollElByPane(([_, b]) => [el, b]);
  }, []);
  const handleScrollElChange1 = useCallback((el: HTMLElement | null) => {
    setScrollElByPane(([a, _]) => [a, el]);
  }, []);

  const toggleOutline = useCallback(() => {
    viewSettings.update({
      ...viewSettings.settings,
      outlineOpen: !viewSettings.settings.outlineOpen,
    });
  }, [viewSettings]);

  const activeDocsIgnore = useMemo(
    () => getIgnorePatterns(library.activeScan?.result.docsYaml),
    [library.activeScan?.result.docsYaml]
  );

  const hideMatcher = useMemo(
    () => buildHideMatcher([...viewSettings.settings.hidePatterns, ...activeDocsIgnore]),
    [viewSettings.settings.hidePatterns, activeDocsIgnore]
  );

  const projectMetaByRoot = useMemo<Record<string, ProjectMeta>>(() => {
    const out: Record<string, ProjectMeta> = {};
    for (const root of library.roots) {
      const meta = getProjectMeta(library.scans[root]?.result.docsYaml);
      if (meta) out[root] = meta;
    }
    return out;
  }, [library.roots, library.scans]);

  // Visibility filter: internal-only workspaces are hidden from the switcher
  // and QuickOpen when the user is in "preview public" mode (showInternal=off).
  const showInternal = viewSettings.settings.showInternal;
  const visibleRoots = useMemo(() => {
    if (showInternal) return library.roots;
    return library.roots.filter(
      (root) => library.scans[root]?.result.docsYaml?.visibility !== "internal"
    );
  }, [library.roots, library.scans, showInternal]);

  // If the currently active workspace is now hidden by the visibility filter,
  // switch to the first visible one. If no visible workspace exists, clear
  // activeRoot - otherwise the content area would render files from a tab
  // the user can no longer see in the switcher.
  useEffect(() => {
    if (showInternal) return;
    if (!library.activeRoot) return;
    if (visibleRoots.includes(library.activeRoot)) return;
    void library.selectRoot(visibleRoots[0]);
  }, [showInternal, library, library.activeRoot, visibleRoots]);

  const rootBySlug = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const root of library.roots) {
      const slug = library.scans[root]?.result.docsYaml?.project?.slug?.trim();
      if (slug) map.set(slug, root);
    }
    return map;
  }, [library.roots, library.scans]);

  const manifestIssues = useMemo(() => {
    const scan = library.activeScan;
    if (!scan) return [];
    return computeManifestIssues({
      docsYaml: scan.result.docsYaml,
      docsYamlError: scan.result.docsYamlError,
      files: scan.result.files,
      knownSlugs: new Set(rootBySlug.keys()),
      ownSlug: scan.result.docsYaml?.project?.slug,
    });
  }, [library.activeScan, rootBySlug]);

  const crossLinks = useMemo<ResolvedCrossLink[]>(() => {
    const list = library.activeScan?.result.docsYaml?.cross_links;
    if (!Array.isArray(list) || list.length === 0) return [];
    const out: ResolvedCrossLink[] = [];
    for (const link of list) {
      const targetRoot = rootBySlug.get(link.project);
      if (!targetRoot) continue;
      if (targetRoot === library.activeRoot) continue; // don't link to self
      const targetName =
        library.scans[targetRoot]?.result.docsYaml?.project?.name?.trim() ||
        targetRoot.split("/").pop() ||
        link.project;
      out.push({
        label: link.label,
        description: link.description,
        targetRoot,
        targetName,
      });
    }
    return out;
  }, [library.activeScan, library.activeRoot, library.scans, rootBySlug]);

  const activeDocsYamlError = library.activeScan?.result.docsYamlError;
  useEffect(() => {
    if (activeDocsYamlError) {
      console.warn("[docsreader] .docs.yaml parse error:", activeDocsYamlError);
    }
  }, [activeDocsYamlError]);

  // Auto-open project.homepage once per workspace per session: only fires on
  // the first time the active scan finishes with no tabs open in that root,
  // so closing the homepage tab doesn't keep reopening it on workspace switch.
  // Homepage auto-open targets pane 0 specifically, regardless of which
  // pane is currently active. Pane 0 is the canonical "main" pane and
  // is the only one rendered when split is off.
  const autoOpenedHomepageRef = useRef<Set<string>>(new Set());
  const pane0 = panes.panes[0];
  const tabsHydrated = pane0.hydrated;
  const tabsList = pane0.tabs;
  const tabsOpenInNew = pane0.openInNew;
  useEffect(() => {
    if (!tabsHydrated) return;
    if (!library.activeRoot) return;
    const scan = library.activeScan;
    if (!scan || scan.scanning) return;
    const root = library.activeRoot;
    if (autoOpenedHomepageRef.current.has(root)) return;

    const homepage = scan.result.docsYaml?.project?.homepage?.trim();
    if (!homepage) return;

    const homepageRel = homepage.replace(/\\/g, "/").replace(/^\.\//, "");
    const file = scan.result.files.find(
      (f) => f.relPath.replace(/\\/g, "/") === homepageRel
    );
    if (!file) return;

    const hasTabInRoot = tabsList.some(
      (t) => t.path.startsWith(root + "/") || t.path === root
    );
    if (hasTabInRoot) {
      autoOpenedHomepageRef.current.add(root);
      return;
    }

    autoOpenedHomepageRef.current.add(root);
    tabsOpenInNew(file.path);
  }, [tabsHydrated, library.activeRoot, library.activeScan, tabsList, tabsOpenInNew]);

  const rawFiles = library.activeScan?.result.files ?? [];
  const allFiles = useMemo(() => {
    if (hideMatcher.empty) return rawFiles;
    return rawFiles.filter((f) => !hideMatcher.matchesPath(f.relPath));
  }, [rawFiles, hideMatcher]);

  const quickOpenFiles = useMemo<QuickOpenFile[]>(() => {
    const out: QuickOpenFile[] = [];
    for (const root of visibleRoots) {
      const scan = library.scans[root];
      if (!scan) continue;
      const docsIgnore = getIgnorePatterns(scan.result.docsYaml);
      const matcher =
        docsIgnore.length === 0
          ? buildHideMatcher(viewSettings.settings.hidePatterns)
          : buildHideMatcher([...viewSettings.settings.hidePatterns, ...docsIgnore]);
      for (const f of scan.result.files) {
        if (!matcher.empty && matcher.matchesPath(f.relPath)) continue;
        out.push({ ...f, rootPath: root });
      }
    }
    return out;
  }, [visibleRoots, library.scans, viewSettings.settings.hidePatterns]);

  const quickOpenShortcut = useMemo(
    () => parseShortcut(viewSettings.settings.quickOpenShortcut),
    [viewSettings.settings.quickOpenShortcut]
  );

  useEffect(() => {
    if (!quickOpenShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (matchShortcut(e, quickOpenShortcut)) {
        e.preventDefault();
        setQuickOpenMounted(true);
        setQuickOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickOpenShortcut]);

  // Split-pane keyboard shortcuts. Cmd+\ toggles horizontal, Cmd+Shift+\
  // toggles vertical, Cmd+1 / Cmd+2 focus pane 0 / pane 1. All no-op for
  // form inputs so they don't fire while the user is typing.
  const splitHorizontalShortcut = useMemo(() => parseShortcut("Mod+\\"), []);
  const splitVerticalShortcut = useMemo(() => parseShortcut("Mod+Shift+\\"), []);
  const focusPane0Shortcut = useMemo(() => parseShortcut("Mod+1"), []);
  const focusPane1Shortcut = useMemo(() => parseShortcut("Mod+2"), []);
  const currentSplit = panes.layout.split;
  const panesSetSplit = panes.setSplit;
  const panesFocusPane = panes.focusPane;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (splitHorizontalShortcut && matchShortcut(e, splitHorizontalShortcut)) {
        e.preventDefault();
        panesSetSplit(currentSplit === "horizontal" ? "off" : "horizontal");
        return;
      }
      if (splitVerticalShortcut && matchShortcut(e, splitVerticalShortcut)) {
        e.preventDefault();
        panesSetSplit(currentSplit === "vertical" ? "off" : "vertical");
        return;
      }
      if (focusPane0Shortcut && matchShortcut(e, focusPane0Shortcut)) {
        e.preventDefault();
        panesFocusPane(0);
        return;
      }
      if (focusPane1Shortcut && matchShortcut(e, focusPane1Shortcut)) {
        e.preventDefault();
        panesFocusPane(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    splitHorizontalShortcut,
    splitVerticalShortcut,
    focusPane0Shortcut,
    focusPane1Shortcut,
    currentSplit,
    panesSetSplit,
    panesFocusPane,
  ]);

  useEffect(() => {
    if (quickOpenMounted) return;
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (cb: () => void) =>
            (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(cb)
        : (cb: () => void) => window.setTimeout(cb, 800);
    const id = idle(() => setQuickOpenMounted(true));
    return () => {
      if (typeof id === "number") clearTimeout(id);
    };
  }, [quickOpenMounted]);
  const filteredFiles = useFilteredFiles(allFiles, search);
  const activeDocsYaml = library.activeScan?.result.docsYaml;
  const tree = useMemo(() => {
    if (!library.activeRoot) return undefined;
    if (hasNavigation(activeDocsYaml)) {
      return buildCuratedTree(library.activeRoot, filteredFiles, activeDocsYaml);
    }
    return buildTree(library.activeRoot, filteredFiles);
  }, [library.activeRoot, filteredFiles, activeDocsYaml]);
  const rootKey = library.activeRoot ?? "";
  const handleCollapseAll = useCallback(() => {
    if (!tree) return;
    sidebar.collapseAll(collectDirKeys(tree, rootKey));
  }, [tree, rootKey, sidebar]);
  const activeFile = tabs.activeTab
    ? allFiles.find((f) => f.path === tabs.activeTab?.path)
    : undefined;
  const headerRelPath = activeFile?.relPath ?? (tabs.activeTab && basename(tabs.activeTab.path));

  const pinnedFiles = useMemo(() => {
    if (!library.activeRoot) return [];
    const set = new Set(pinned.pinnedFor(library.activeRoot));
    return allFiles.filter((f) => set.has(f.path));
  }, [library.activeRoot, pinned, allFiles]);

  const handleTogglePin = useCallback(
    (path: string) => {
      if (!library.activeRoot) return;
      pinned.togglePinned(library.activeRoot, path);
    },
    [library.activeRoot, pinned]
  );

  const handleHide = useCallback(
    (absolutePath: string) => {
      if (!library.activeRoot) return;
      const root = library.activeRoot;
      const fileEntry = allFiles.find((f) => f.path === absolutePath);
      let rel = fileEntry?.relPath;
      if (!rel) {
        rel = absolutePath.startsWith(root + "/")
          ? absolutePath.slice(root.length + 1)
          : basename(absolutePath);
      }
      const isDir = !fileEntry;
      const pattern = isDir ? `${rel}/**` : rel;
      const current = viewSettings.settings.hidePatterns;
      if (current.includes(pattern)) return;
      viewSettings.update({
        ...viewSettings.settings,
        hidePatterns: [...current, pattern],
      });
    },
    [library.activeRoot, allFiles, viewSettings]
  );

  const handleLensChange = useCallback(
    (lens: typeof viewSettings.settings.sidebarLens) => {
      viewSettings.update({ ...viewSettings.settings, sidebarLens: lens });
    },
    [viewSettings]
  );

  const activeGitStatus = library.activeScan?.gitStatus;
  const gitStatusByPath = useMemo(() => {
    if (!activeGitStatus) return undefined;
    const map = new Map<string, GitFileStatusKind>();
    for (const f of activeGitStatus.files) {
      if (!f.path) continue;
      map.set(f.path.replace(/\\/g, "/"), f.status as GitFileStatusKind);
    }
    return map;
  }, [activeGitStatus]);

  const [gitDiffState, setGitDiffState] = useState<
    | undefined
    | { before: string; after: string; title: string }
  >();
  const handleShowGitDiff = useCallback(
    async (absolutePath: string) => {
      if (!library.activeRoot) return;
      const root = library.activeRoot;
      const rel = absolutePath.startsWith(root + "/")
        ? absolutePath.slice(root.length + 1)
        : absolutePath;
      try {
        const [headRaw, diskRaw] = await Promise.all([
          fetchGitHead(root, rel),
          readTextFile(absolutePath),
        ]);
        const before = headRaw === undefined ? "" : parseFrontmatter(headRaw).content;
        const after = parseFrontmatter(diskRaw).content;
        setGitDiffState({ before, after, title: rel });
      } catch (err) {
        console.error("git diff failed", err);
        const detail = err instanceof Error ? err.message : String(err);
        void message(`Could not load git diff for ${rel}.\n\n${detail}`, {
          title: "Git diff",
          kind: "error",
        });
      }
    },
    [library.activeRoot]
  );

  const handleOpenWelcome = useCallback(async () => {
    try {
      const path = await invoke<string>("install_welcome_workspace");
      await library.addRoot(path);
      viewSettings.update({ ...viewSettings.settings, welcomeOpened: true });
    } catch (err) {
      console.error("install_welcome_workspace failed", err);
    }
  }, [library, viewSettings]);

  // Auto-open the welcome workspace exactly once for true first-time users:
  // both stores hydrated, no roots persisted from previous sessions, and the
  // welcomeOpened flag still false. The ref guards against React re-running
  // the effect after handleOpenWelcome finishes (which sets the flag).
  const autoInstalledWelcomeRef = useRef(false);
  useEffect(() => {
    if (autoInstalledWelcomeRef.current) return;
    if (!viewSettings.hydrated || !library.hydrated) return;
    if (viewSettings.settings.welcomeOpened) return;
    if (library.roots.length > 0) return;
    autoInstalledWelcomeRef.current = true;
    void handleOpenWelcome();
  }, [
    viewSettings.hydrated,
    viewSettings.settings.welcomeOpened,
    library.hydrated,
    library.roots.length,
    handleOpenWelcome,
  ]);

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider open={sidebar.open} onOpenChange={sidebar.setOpen}>
        <ExplorerSidebar
          roots={visibleRoots}
          activeRoot={library.activeRoot}
          activeScan={library.activeScan}
          projectMetaByRoot={projectMetaByRoot}
          onPickDirectory={() => void library.pickDirectory()}
          onSelectRoot={(path) => void library.selectRoot(path)}
          onRemoveRoot={(path) => void library.removeRoot(path)}
          onRescan={() => library.activeRoot && void library.rescan(library.activeRoot)}
          onOpenWelcome={
            viewSettings.settings.welcomeOpened
              ? undefined
              : () => void handleOpenWelcome()
          }
          crossLinks={crossLinks}
          manifestIssues={manifestIssues}
          gitStatusByPath={gitStatusByPath}
          onShowGitDiff={
            activeGitStatus ? (path) => void handleShowGitDiff(path) : undefined
          }
          lens={viewSettings.settings.sidebarLens}
          onLensChange={handleLensChange}
          search={search}
          onSearchChange={setSearch}
          filteredFiles={filteredFiles}
          pinnedFiles={pinnedFiles}
          tree={tree}
          rootKey={rootKey}
          isExpanded={sidebar.isExpanded}
          onToggleExpanded={sidebar.toggleExpanded}
          onCollapseAll={handleCollapseAll}
          isPinned={(path) =>
            library.activeRoot ? pinned.isPinned(library.activeRoot, path) : false
          }
          onTogglePin={handleTogglePin}
          onHide={handleHide}
          hiddenCount={Math.max(0, rawFiles.length - allFiles.length)}
          onOpenSettings={() => {
            setSettingsMounted(true);
            setSettingsSection("explorer");
            setSettingsOpen(true);
          }}
          selectedPath={tabs.activeTab?.path}
          onSelectFile={tabs.openInActive}
          onOpenInNewTab={tabs.openInNew}
          onOpenInOtherPane={panes.openInOtherPane}
        />

        <SidebarInset className="flex h-svh flex-col">
          <header className="flex shrink-0 items-center gap-2 px-4 py-3 border-b bg-background">
            <SidebarTrigger />
            {headerRelPath && (
              <PathBreadcrumb relPath={headerRelPath} onSegmentClick={setSearch} />
            )}
            <div className="ml-auto flex items-center gap-1">
              <ToggleGroup
                type="single"
                value={panes.layout.split}
                onValueChange={(v) => v && panes.setSplit(v as SplitMode)}
                variant="outline"
                spacing={4}
                aria-label="Split layout"
              >
                <ToggleGroupItem
                  value="off"
                  className="h-7 px-2 text-xs"
                  title="Single pane"
                  aria-label="Single pane"
                >
                  <Square className="size-3" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="horizontal"
                  className="h-7 px-2 text-xs"
                  title="Side by side"
                  aria-label="Side by side"
                >
                  <Columns2 className="size-3" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="vertical"
                  className="h-7 px-2 text-xs"
                  title="Stacked"
                  aria-label="Stacked"
                >
                  <Rows2 className="size-3" />
                </ToggleGroupItem>
              </ToggleGroup>
              {tabs.activeTab && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  title={viewSettings.settings.outlineOpen ? "Hide outline" : "Show outline"}
                  aria-label="Toggle outline"
                  aria-pressed={viewSettings.settings.outlineOpen}
                  onClick={toggleOutline}
                >
                  <ListTree />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                title="Settings"
                aria-label="Settings"
                onMouseEnter={() => setSettingsMounted(true)}
                onFocus={() => setSettingsMounted(true)}
                onClick={() => {
                  setSettingsMounted(true);
                  setSettingsSection(undefined);
                  setSettingsOpen(true);
                }}
              >
                <SettingsIcon />
              </Button>
              {settingsMounted && (
                <Suspense fallback={null}>
                  <SettingsDialog
                    open={settingsOpen}
                    onOpenChange={setSettingsOpen}
                    settings={viewSettings.settings}
                    onChange={viewSettings.update}
                    initialSection={settingsSection}
                    onOpenWelcome={() => void handleOpenWelcome()}
                  />
                </Suspense>
              )}
            </div>
          </header>

          <div className="flex flex-1 min-h-0">
            <div className="relative flex-1 min-h-0">
              {panes.layout.split === "off" ? (
                <PaneView
                  pane={panes.panes[0]}
                  files={allFiles}
                  rootPath={library.activeRoot}
                  viewSettings={deferredSettings}
                  splitActive={false}
                  isActivePane
                  onFocusPane={() => panes.focusPane(0)}
                  onActiveScrollElChange={handleScrollElChange0}
                  onDiffViewModeChange={(mode) =>
                    viewSettings.update({ ...viewSettings.settings, diffViewMode: mode })
                  }
                  onAlwaysAutoReload={() =>
                    viewSettings.update({
                      ...viewSettings.settings,
                      autoReloadOnExternalChange: true,
                    })
                  }
                  hasRoots={library.roots.length > 0}
                />
              ) : (
                <ResizablePanelGroup
                  key={panes.layout.split}
                  orientation={panes.layout.split === "horizontal" ? "horizontal" : "vertical"}
                  onLayoutChanged={(layout) => {
                    const v = layout["pane0"];
                    if (typeof v === "number") panes.setSplitSize(v);
                  }}
                >
                  <ResizablePanel id="pane0" defaultSize={panes.layout.splitSize} minSize={15}>
                    <PaneView
                      pane={panes.panes[0]}
                      files={allFiles}
                      rootPath={library.activeRoot}
                      viewSettings={deferredSettings}
                      splitActive
                      isActivePane={panes.layout.activePane === 0}
                      onFocusPane={() => panes.focusPane(0)}
                      onActiveScrollElChange={handleScrollElChange0}
                      onDiffViewModeChange={(mode) =>
                        viewSettings.update({ ...viewSettings.settings, diffViewMode: mode })
                      }
                      onAlwaysAutoReload={() =>
                        viewSettings.update({
                          ...viewSettings.settings,
                          autoReloadOnExternalChange: true,
                        })
                      }
                      hasRoots={library.roots.length > 0}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel id="pane1" defaultSize={100 - panes.layout.splitSize} minSize={15}>
                    <PaneView
                      pane={panes.panes[1]}
                      files={allFiles}
                      rootPath={library.activeRoot}
                      viewSettings={deferredSettings}
                      splitActive
                      isActivePane={panes.layout.activePane === 1}
                      onFocusPane={() => panes.focusPane(1)}
                      onActiveScrollElChange={handleScrollElChange1}
                      onDiffViewModeChange={(mode) =>
                        viewSettings.update({ ...viewSettings.settings, diffViewMode: mode })
                      }
                      onAlwaysAutoReload={() =>
                        viewSettings.update({
                          ...viewSettings.settings,
                          autoReloadOnExternalChange: true,
                        })
                      }
                      hasRoots={library.roots.length > 0}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </div>
            {viewSettings.settings.outlineOpen && tabs.activeTab && !tabs.activeTab.loading && (
              <aside className="hidden w-60 shrink-0 overflow-y-auto border-l bg-background px-2 lg:block">
                <OutlinePanel
                  content={tabs.activeTab.content}
                  scrollContainer={activeScrollEl}
                />
              </aside>
            )}
          </div>
        </SidebarInset>
        {quickOpenMounted && (
          <Suspense fallback={null}>
            <QuickOpenDialog
              open={quickOpen}
              onOpenChange={setQuickOpen}
              files={quickOpenFiles}
              onSelect={(path) => tabs.openInActive(path)}
            />
          </Suspense>
        )}
        {gitDiffState && (
          <DiffViewerDialog
            open
            onOpenChange={(o) => !o && setGitDiffState(undefined)}
            before={gitDiffState.before}
            after={gitDiffState.after}
            title={`Git diff: ${gitDiffState.title} (working tree vs HEAD)`}
            mode={viewSettings.settings.diffViewMode}
            onModeChange={(mode) =>
              viewSettings.update({ ...viewSettings.settings, diffViewMode: mode })
            }
          />
        )}
      </SidebarProvider>
    </TooltipProvider>
  );
}

function useFilteredFiles(files: MarkdownFile[], search: string): MarkdownFile[] {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      if (f.name.toLowerCase().includes(q)) return true;
      if (f.relPath.toLowerCase().includes(q)) return true;
      if (f.title?.toLowerCase().includes(q)) return true;
      return f.tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [files, search]);
}

export default App;
