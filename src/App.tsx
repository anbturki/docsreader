import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ListTree, Settings as SettingsIcon } from "lucide-react";
import type { QuickOpenFile } from "@/components/quickopen/QuickOpenDialog";
import type { SettingsSection } from "@/components/settings/SettingsDialog";
import { OutlinePanel } from "@/components/document/OutlinePanel";
import { matchShortcut, parseShortcut } from "@/lib/shortcuts";

const QuickOpenDialog = lazy(() => import("@/components/quickopen/QuickOpenDialog"));
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ExplorerSidebar } from "@/components/explorer/ExplorerSidebar";
import { EmptyDocument } from "@/components/document/EmptyDocument";
import { PathBreadcrumb } from "@/components/document/PathBreadcrumb";
import { TabBar } from "@/components/document/TabBar";
import { TabScrollPane } from "@/components/document/TabScrollPane";

const SettingsDialog = lazy(() => import("@/components/settings/SettingsDialog"));
import { useLibrary } from "@/hooks/useLibrary";
import { useTabs } from "@/hooks/useTabs";
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
import type { MarkdownFile } from "@/lib/scan";
import "@/styles/code-theme.css";

function App() {
  const library = useLibrary();
  const tabs = useTabs();
  const viewSettings = useViewSettings();
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
  const [activeScrollEl, setActiveScrollEl] = useState<HTMLElement | null>(null);

  const handleActiveRefChange = useCallback((el: HTMLElement | null) => {
    setActiveScrollEl(el);
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

  const activeDocsYamlError = library.activeScan?.result.docsYamlError;
  useEffect(() => {
    if (activeDocsYamlError) {
      console.warn("[docsreader] .docs.yaml parse error:", activeDocsYamlError);
    }
  }, [activeDocsYamlError]);

  // Auto-open project.homepage once per workspace per session: only fires on
  // the first time the active scan finishes with no tabs open in that root,
  // so closing the homepage tab doesn't keep reopening it on workspace switch.
  const autoOpenedHomepageRef = useRef<Set<string>>(new Set());
  const tabsHydrated = tabs.hydrated;
  const tabsList = tabs.tabs;
  const tabsOpenInNew = tabs.openInNew;
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
    for (const root of library.roots) {
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
  }, [library.roots, library.scans, viewSettings.settings.hidePatterns]);

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
          roots={library.roots}
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
        />

        <SidebarInset className="flex h-svh flex-col">
          <header className="flex shrink-0 items-center gap-2 px-4 py-3 border-b bg-background">
            <SidebarTrigger />
            {headerRelPath && (
              <PathBreadcrumb relPath={headerRelPath} onSegmentClick={setSearch} />
            )}
            <div className="ml-auto flex items-center gap-1">
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

          <TabBar
            tabs={tabs.tabs}
            activeId={tabs.activeId}
            onActivate={tabs.activate}
            onClose={tabs.close}
          />

          <div className="flex flex-1 min-h-0">
            <div className="relative flex-1 min-h-0">
              {tabs.tabs.length === 0 ? (
                <div className="absolute inset-0 overflow-y-auto">
                  <EmptyDocument hasRoots={library.roots.length > 0} />
                </div>
              ) : (
                tabs.tabs.map((tab) => {
                  const file = allFiles.find((f) => f.path === tab.path);
                  const active = tab.id === tabs.activeId;
                  return (
                    <TabScrollPane
                      key={tab.id}
                      tab={tab}
                      file={file}
                      active={active}
                      rootPath={library.activeRoot}
                      viewSettings={deferredSettings}
                      initialScrollTop={tabs.getScrollTop(tab.path)}
                      onScrollChange={tabs.setScrollTop}
                      onNavigate={tabs.openInActive}
                      onActiveRefChange={handleActiveRefChange}
                    />
                  );
                })
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
