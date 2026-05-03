import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ListTree, Settings as SettingsIcon } from "lucide-react";
import type { QuickOpenFile } from "@/components/quickopen/QuickOpenDialog";
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
import { buildTree } from "@/lib/tree";
import { collectDirKeys } from "@/components/explorer/FileTree";
import { basename } from "@/lib/path";
import type { MarkdownFile } from "@/lib/scan";
import "@/styles/code-theme.css";

function App() {
  const library = useLibrary();
  const tabs = useTabs();
  const viewSettings = useViewSettings();
  const sidebar = useSidebarState();
  useTheme(viewSettings.settings.colorScheme, viewSettings.settings.accentColor);
  const deferredSettings = useDeferredValue(viewSettings.settings);
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMounted, setSettingsMounted] = useState(false);
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

  const allFiles = library.activeScan?.result.files ?? [];

  const quickOpenFiles = useMemo<QuickOpenFile[]>(() => {
    const out: QuickOpenFile[] = [];
    for (const root of library.roots) {
      const scan = library.scans[root];
      if (!scan) continue;
      for (const f of scan.result.files) out.push({ ...f, rootPath: root });
    }
    return out;
  }, [library.roots, library.scans]);

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
  const tree = useMemo(
    () => (library.activeRoot ? buildTree(library.activeRoot, filteredFiles) : undefined),
    [library.activeRoot, filteredFiles]
  );
  const rootKey = library.activeRoot ?? "";
  const handleCollapseAll = useCallback(() => {
    if (!tree) return;
    sidebar.collapseAll(collectDirKeys(tree, rootKey));
  }, [tree, rootKey, sidebar]);
  const tagList = useTags(allFiles);
  const activeFile = tabs.activeTab
    ? allFiles.find((f) => f.path === tabs.activeTab?.path)
    : undefined;
  const headerRelPath = activeFile?.relPath ?? (tabs.activeTab && basename(tabs.activeTab.path));

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider open={sidebar.open} onOpenChange={sidebar.setOpen}>
        <ExplorerSidebar
          roots={library.roots}
          activeRoot={library.activeRoot}
          activeScan={library.activeScan}
          selectedPath={tabs.activeTab?.path}
          search={search}
          filteredFiles={filteredFiles}
          tags={tagList}
          tree={tree}
          rootKey={rootKey}
          isExpanded={sidebar.isExpanded}
          onToggleExpanded={sidebar.toggleExpanded}
          onPickDirectory={() => void library.pickDirectory()}
          onSelectRoot={(path) => void library.selectRoot(path)}
          onRemoveRoot={(path) => void library.removeRoot(path)}
          onRescan={() => library.activeRoot && void library.rescan(library.activeRoot)}
          onCollapseAll={handleCollapseAll}
          onSearchChange={setSearch}
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

function useTags(files: MarkdownFile[]): string[] {
  return useMemo(() => {
    const tags = new Set<string>();
    files.forEach((f) => f.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [files]);
}

export default App;
