import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import type { QuickOpenFile } from "@/components/quickopen/QuickOpenDialog";
import type { SettingsSection } from "@/components/settings/SettingsDialog";
import { BacklinksPanel } from "@/components/document/BacklinksPanel";
import { OutlinePanel } from "@/components/document/OutlinePanel";
import { matchShortcut, parseShortcut } from "@/lib/shortcuts";

const QuickOpenDialog = lazy(() => import("@/components/quickopen/QuickOpenDialog"));
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ExplorerSidebar } from "@/components/explorer/ExplorerSidebar";
import { AppToolbar } from "@/components/layout/AppToolbar";
import { ConvertWorkspacePrompt } from "@/components/explorer/ConvertWorkspacePrompt";
import { PaneView } from "@/components/document/PaneView";
import { UpdateToast } from "@/components/document/UpdateToast";

const SettingsDialog = lazy(() => import("@/components/settings/SettingsDialog"));
import { useLibrary } from "@/hooks/useLibrary";
import { useContentSearch } from "@/hooks/useContentSearch";
import { useSidebarSearch } from "@/hooks/useSidebarSearch";
import { mergeSearchEntries } from "@/lib/searchEntries";
import { useConvertPrompt } from "@/hooks/useConvertPrompt";
import { usePanes } from "@/hooks/usePanes";
import { useTheme } from "@/hooks/useTheme";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useSidebarState } from "@/hooks/useSidebarState";
import { usePinned } from "@/hooks/usePinned";
import { useUpdater } from "@/hooks/useUpdater";
import { useOpenWith } from "@/hooks/useOpenWith";
import { buildTree } from "@/lib/tree";
import { collectDirKeys } from "@/components/explorer/FileTree";
import { buildHideMatcher } from "@/lib/match";
import { basename } from "@/lib/path";
import { fetchGitHead, type GitFileStatusKind } from "@/lib/git";
import { parseFrontmatter } from "@/lib/scan";
import { DiffViewerDialog } from "@/components/document/DiffViewerDialog";
import type { MarkdownFile } from "@/lib/scan";
import { CHROME_STYLE } from "@/components/layout/chrome";
import { lensViewFor, type LensViewId, type SplitMode } from "@/lib/storage";
import "@/styles/code-theme.css";

// "off" never reaches the split branch, but the map stays total so a new
// split mode has to declare its orientation instead of silently defaulting.
const PANE_ORIENTATION: Record<SplitMode, "horizontal" | "vertical"> = {
  off: "horizontal",
  horizontal: "horizontal",
  vertical: "vertical",
};

function App() {
  const library = useLibrary();
  const viewSettings = useViewSettings();
  const managedRoots = useMemo(
    () => library.roots.filter((root) => library.scans[root]?.result.marker),
    [library.roots, library.scans]
  );
  const isManagedPath = useCallback(
    (path: string) =>
      managedRoots.some((root) => path === root || path.startsWith(root + "/")),
    [managedRoots]
  );
  const panes = usePanes({
    autoReloadOnExternalChange: viewSettings.settings.autoReloadOnExternalChange,
    isManagedPath,
  });
  const tabs = panes.activePane;
  const sidebar = useSidebarState(viewSettings.settings.defaultFolderState);
  const pinned = usePinned();
  const updater = useUpdater();
  useOpenWith({
    hydrated: library.hydrated && panes.hydrated,
    roots: library.roots,
    addRoot: library.addRoot,
    selectRoot: library.selectRoot,
    openFile: panes.openInActivePane,
  });
  useTheme(viewSettings.settings.colorScheme, viewSettings.settings.accentColor);
  const deferredSettings = useDeferredValue(viewSettings.settings);
  const setSidebarOpen = sidebar.setOpen;
  const revealSidebar = useCallback(() => setSidebarOpen(true), [setSidebarOpen]);
  // Mirrors the split every editor uses: Cmd+F searches the open document,
  // Shift+Cmd+F searches the sidebar. Find-in-document owns Cmd+F in
  // TabScrollPane, so the two never contend for the same chord.
  const search = useSidebarSearch({
    shortcut: viewSettings.settings.workspaceSearchShortcut,
    onReveal: revealSidebar,
  });
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

  const hideMatcher = useMemo(
    () => buildHideMatcher(viewSettings.settings.hidePatterns),
    [viewSettings.settings.hidePatterns]
  );

  const convertPrompt = useConvertPrompt(
    library.activeRoot,
    library.activeScan,
    library.rescan
  );

  const workspaceNamesByRoot = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const root of library.roots) {
      const name = library.scans[root]?.result.marker?.name?.trim();
      if (name) out[root] = name;
    }
    return out;
  }, [library.roots, library.scans]);

  // Auto-open the marker homepage once per workspace per session: only fires on
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

    const homepage = scan.result.marker?.homepage?.trim();
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
    for (const root of library.roots) {
      const scan = library.scans[root];
      if (!scan) continue;
      for (const f of scan.result.files) {
        if (!hideMatcher.empty && hideMatcher.matchesPath(f.relPath)) continue;
        out.push({ ...f, rootPath: root });
      }
    }
    return out;
  }, [library.roots, library.scans, hideMatcher]);

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
  const filteredFiles = useFilteredFiles(allFiles, search.query);
  const activeRoots = useMemo(
    () => (library.activeRoot ? [library.activeRoot] : []),
    [library.activeRoot]
  );
  // The tasks lens filters its own board, so it needs no content search.
  const contentSearchEnabled =
    search.open && viewSettings.settings.sidebarLens !== "tasks";
  const contentSearch = useContentSearch(
    activeRoots,
    search.query,
    contentSearchEnabled,
    search.scope
  );
  const searchEntries = useMemo(
    () => mergeSearchEntries(filteredFiles, contentSearch.hits, search.scope),
    [filteredFiles, contentSearch.hits, search.scope]
  );
  const tree = useMemo(() => {
    if (!library.activeRoot) return undefined;
    return buildTree(library.activeRoot, filteredFiles);
  }, [library.activeRoot, filteredFiles]);
  const rootKey = library.activeRoot ?? "";
  const handleCollapseAll = useCallback(() => {
    if (!tree) return;
    sidebar.collapseAll(collectDirKeys(tree, rootKey));
  }, [tree, rootKey, sidebar]);
  const activeFile = tabs.activeTab
    ? allFiles.find((f) => f.path === tabs.activeTab?.path)
    : undefined;
  const headerRelPath = activeFile?.relPath ?? (tabs.activeTab && basename(tabs.activeTab.path));
  // Resolve the effective scheme so the toggle reflects what is actually
  // rendered, including when colorScheme is "system".
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const isDark =
    viewSettings.settings.colorScheme === "dark" ||
    (viewSettings.settings.colorScheme === "system" && systemDark);

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

  const handleLensViewChange = useCallback(
    (view: LensViewId) => {
      viewSettings.update({
        ...viewSettings.settings,
        lensViews: {
          ...viewSettings.settings.lensViews,
          [viewSettings.settings.sidebarLens]: view,
        },
      });
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
      // The welcome workspace is a guided tour, not an agent target; never
      // greet a first-time user with the convert dialog.
      convertPrompt.declineRoot(path);
      await library.addRoot(path);
      viewSettings.update({ ...viewSettings.settings, welcomeOpened: true });
    } catch (err) {
      console.error("install_welcome_workspace failed", err);
    }
  }, [library, viewSettings, convertPrompt]);

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
      {/* The toolbar is fixed, so the wrapper's padding is what reserves its
          row; both the inset panel and the content card then start at the
          same y without either restating the offset. */}
      <SidebarProvider
        open={sidebar.open}
        onOpenChange={sidebar.setOpen}
        style={CHROME_STYLE}
        // The variant sizes itself off the viewport with a minimum, which
        // leaves no definite height for the panes to divide and lets a long
        // document push the whole window taller. Anchored to the root instead.
        className="h-full min-h-0 pt-(--toolbar-height)"
      >
        <AppToolbar
          roots={library.roots}
          activeRoot={library.activeRoot}
          workspaceNamesByRoot={workspaceNamesByRoot}
          onSelectRoot={(path) => void library.selectRoot(path)}
          onRemoveRoot={(path) => void library.removeRoot(path)}
          onPickDirectory={() => void library.pickDirectory()}
          breadcrumbPath={headerRelPath || undefined}
          onBreadcrumbSegmentClick={search.reveal}
          quickOpenShortcut={viewSettings.settings.quickOpenShortcut}
          onOpenQuickOpen={() => {
            setQuickOpenMounted(true);
            setQuickOpen(true);
          }}
          canCollapseAll={
            !!library.activeRoot && viewSettings.settings.sidebarLens === "tree"
          }
          onCollapseAll={handleCollapseAll}
          split={panes.layout.split}
          onSplitChange={panes.setSplit}
          canToggleOutline={!!tabs.activeTab}
          outlineOpen={viewSettings.settings.outlineOpen}
          onToggleOutline={toggleOutline}
          isDark={isDark}
          onToggleTheme={() =>
            viewSettings.update({
              ...viewSettings.settings,
              colorScheme: isDark ? "light" : "dark",
            })
          }
          onOpenSettings={() => {
            setSettingsMounted(true);
            setSettingsSection(undefined);
            setSettingsOpen(true);
          }}
          onPrefetchSettings={() => setSettingsMounted(true)}
        />
        {settingsMounted && (
          <Suspense fallback={null}>
            <SettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              settings={viewSettings.settings}
              onChange={viewSettings.update}
              initialSection={settingsSection}
              onOpenWelcome={() => void handleOpenWelcome()}
              updater={updater}
            />
          </Suspense>
        )}
        <ExplorerSidebar
          roots={library.roots}
          activeRoot={library.activeRoot}
          activeScan={library.activeScan}
          onPickDirectory={() => void library.pickDirectory()}
          onRefresh={() => library.activeRoot && void library.rescan(library.activeRoot)}
          onOpenWelcome={
            viewSettings.settings.welcomeOpened
              ? undefined
              : () => void handleOpenWelcome()
          }
          gitStatusByPath={gitStatusByPath}
          onShowGitDiff={
            activeGitStatus ? (path) => void handleShowGitDiff(path) : undefined
          }
          lens={viewSettings.settings.sidebarLens}
          onLensChange={handleLensChange}
          lensView={lensViewFor(
            viewSettings.settings.lensViews,
            viewSettings.settings.sidebarLens
          )}
          onLensViewChange={handleLensViewChange}
          search={search}
          searchEntries={searchEntries}
          searchingContents={contentSearch.searching}
          searchError={contentSearch.error}
          searchTruncated={contentSearch.truncated}
          filteredFiles={filteredFiles}
          pinnedFiles={pinnedFiles}
          tree={tree}
          rootKey={rootKey}
          isExpanded={sidebar.isExpanded}
          onToggleExpanded={sidebar.toggleExpanded}
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

        {/* The inset variant sets the card's gap with a hardcoded `m-2`, and its
            flow position comes from a spacer the sidebar reserves at the same
            hardcoded size; both are restated from the shared token, the second
            as a pull-back so the card stays flush against the sidebar in either
            state. Radius and drop shadow are restated at the same modifiers,
            which is what lets tailwind-merge drop them rather than leaving two
            rules to race: the seam is one hairline, not a line plus a halo. */}
        <SidebarInset className="flex flex-col overflow-hidden md:peer-data-[variant=inset]:m-(--chrome-inset) md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-[calc(var(--chrome-inset)-var(--spacing)*4)] md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:rounded-r-md md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-none">

          <UpdateToast
            phase={updater.phase}
            pendingVersion={updater.pendingVersion}
            currentVersion={updater.currentVersion}
            progressBytes={updater.progressBytes}
            totalBytes={updater.totalBytes}
            onInstall={updater.install}
            onDismiss={updater.dismiss}
          />

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
                  orientation={PANE_ORIENTATION[panes.layout.split]}
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
                <BacklinksPanel
                  files={allFiles}
                  activePath={tabs.activeTab.path}
                  onNavigate={tabs.openInActive}
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
            roots={library.roots}
              onSelect={(path) => tabs.openInActive(path)}
            />
          </Suspense>
        )}
        {convertPrompt.candidateRoot && (
          <ConvertWorkspacePrompt
            folderName={basename(convertPrompt.candidateRoot)}
            onConvert={() => void convertPrompt.convert()}
            onDecline={() =>
              convertPrompt.candidateRoot &&
              convertPrompt.declineRoot(convertPrompt.candidateRoot)
            }
          />
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
