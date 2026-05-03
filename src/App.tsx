import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { FolderPlus, ListCollapse, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { FileTree } from "./components/FileTree";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { ScanProgressView } from "./components/ScanProgressView";
import { ViewSettingsMenu } from "./components/ViewSettingsMenu";
import {
  scanDirectory,
  parseFrontmatter,
  type MarkdownFile,
  type ScanResult,
  type ScanProgress,
} from "./lib/scan";
import { buildTree } from "./lib/tree";
import {
  defaultViewSettings,
  deleteScanCache,
  loadLastSelected,
  loadRoots,
  loadScanCache,
  loadViewSettings,
  saveLastSelected,
  saveRoots,
  saveScanCache,
  saveViewSettings,
  type ViewSettings,
} from "./lib/storage";
import "highlight.js/styles/github-dark.css";

type EventKind = "create" | "remove" | "modify" | "rename" | "access" | "any" | "other";

function describeEventKind(type: unknown): EventKind {
  if (type === "any") return "any";
  if (type === "other") return "other";
  if (typeof type !== "object" || type === null) return "other";
  if ("create" in type) return "create";
  if ("remove" in type) return "remove";
  if ("modify" in type) {
    const modify = (type as { modify: unknown }).modify;
    if (typeof modify === "object" && modify !== null && "kind" in modify) {
      const kind = (modify as { kind: unknown }).kind;
      if (kind === "rename") return "rename";
    }
    return "modify";
  }
  if ("access" in type) return "access";
  return "other";
}

interface RootScan {
  result: ScanResult;
  scanning: boolean;
  progress?: ScanProgress;
  startedAt?: number;
  finishedAt?: number;
  cachedAt?: number;
}

function App() {
  const [roots, setRoots] = useState<string[]>([]);
  const [activeRoot, setActiveRoot] = useState<string | undefined>();
  const [scans, setScans] = useState<Record<string, RootScan>>({});
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [content, setContent] = useState<string>("");
  const [contentMeta, setContentMeta] = useState<Record<string, unknown>>({});
  const [contentError, setContentError] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [treeVersion, setTreeVersion] = useState(0);
  const [viewSettings, setViewSettings] = useState<ViewSettings>(defaultViewSettings);

  const selectedPathRef = useRef<string | undefined>(undefined);
  selectedPathRef.current = selectedPath;

  useEffect(() => {
    (async () => {
      const [stored, last, settings] = await Promise.all([
        loadRoots(),
        loadLastSelected(),
        loadViewSettings(),
      ]);
      setRoots(stored);
      setViewSettings(settings);
      if (stored.length > 0) {
        const initial = stored.includes(last ?? "") ? (last as string) : stored[0];
        setActiveRoot(initial);
        await hydrateFromCache(initial);
      }
    })();
  }, []);

  function updateViewSettings(next: ViewSettings) {
    setViewSettings(next);
    void saveViewSettings(next);
  }

  async function hydrateFromCache(root: string) {
    const cached = await loadScanCache(root);
    if (!cached) return;
    setScans((s) => ({
      ...s,
      [root]: {
        result: cached.result,
        scanning: false,
        cachedAt: cached.cachedAt,
      },
    }));
  }

  async function scan(root: string) {
    const startedAt = performance.now();
    setScans((s) => {
      const prev = s[root];
      const result = prev?.result ?? { root, files: [], truncated: false };
      return {
        ...s,
        [root]: { ...prev, result, scanning: true, startedAt, progress: undefined },
      };
    });
    try {
      const result = await scanDirectory(root, (progress) => {
        setScans((s) => {
          const prev = s[root];
          if (!prev) return s;
          return { ...s, [root]: { ...prev, progress } };
        });
      });
      void saveScanCache(root, result).catch(console.error);
      setScans((s) => ({
        ...s,
        [root]: {
          result,
          scanning: false,
          startedAt,
          finishedAt: performance.now(),
          progress: s[root]?.progress,
          cachedAt: Date.now(),
        },
      }));
    } catch (err) {
      console.error(err);
      setScans((s) => {
        const prev = s[root];
        const result = prev?.result ?? { root, files: [], truncated: false };
        return {
          ...s,
          [root]: { ...prev, result, scanning: false, startedAt },
        };
      });
    }
  }

  async function pickDirectory() {
    const picked = await open({
      directory: true,
      multiple: false,
      title: "Select docs folder",
    });
    if (!picked || typeof picked !== "string") return;
    if (!roots.includes(picked)) {
      const next = [...roots, picked];
      setRoots(next);
      await saveRoots(next);
    }
    setActiveRoot(picked);
    await saveLastSelected(picked);
    await hydrateFromCache(picked);
    void scan(picked);
  }

  async function removeRoot(path: string) {
    const next = roots.filter((r) => r !== path);
    setRoots(next);
    await saveRoots(next);
    await deleteScanCache(path);
    setScans((s) => {
      const c = { ...s };
      delete c[path];
      return c;
    });
    if (activeRoot === path) {
      const fallback = next[0];
      setActiveRoot(fallback);
      await saveLastSelected(fallback);
      if (fallback) await hydrateFromCache(fallback);
    }
  }

  async function selectRoot(path: string) {
    setActiveRoot(path);
    await saveLastSelected(path);
    if (!scans[path]) await hydrateFromCache(path);
  }

  async function reloadFile(path: string, withSpinner = true) {
    if (withSpinner) setLoading(true);
    setContentError(undefined);
    try {
      const raw = await readTextFile(path);
      const { data, content: body } = parseFrontmatter(raw);
      setContentMeta(data);
      setContent(body);
    } catch (err) {
      setContentError(err instanceof Error ? err.message : String(err));
      setContent("");
      setContentMeta({});
    } finally {
      if (withSpinner) setLoading(false);
    }
  }

  async function openFile(path: string) {
    setSelectedPath(path);
    await reloadFile(path);
  }

  useEffect(() => {
    const open = selectedPath;
    if (!open || !activeRoot) return;

    let unwatch: UnwatchFn | null = null;
    let cancelled = false;

    (async () => {
      try {
        unwatch = await watch(
          open,
          (event) => {
            if (cancelled) return;
            const kind = describeEventKind(event.type);
            if (kind === "remove" || kind === "access") return;
            const current = selectedPathRef.current;
            if (current === open) void reloadFile(current, false);
          },
          { recursive: false, delayMs: 400 }
        );
      } catch (err) {
        console.error("watch failed", err);
      }
    })();

    return () => {
      cancelled = true;
      if (unwatch) void unwatch();
    };
  }, [activeRoot, selectedPath]);

  const activeScan = activeRoot ? scans[activeRoot] : undefined;

  const filteredFiles = useMemo<MarkdownFile[]>(() => {
    const files = activeScan?.result.files ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      if (f.name.toLowerCase().includes(q)) return true;
      if (f.relPath.toLowerCase().includes(q)) return true;
      if (f.title?.toLowerCase().includes(q)) return true;
      if (f.tags.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [activeScan, search]);

  const tree = useMemo(() => {
    if (!activeRoot) return undefined;
    return buildTree(activeRoot, filteredFiles);
  }, [activeRoot, filteredFiles]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    activeScan?.result.files.forEach((f) => f.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [activeScan]);

  const selectedFile = filteredFiles.find((f) => f.path === selectedPath);

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <Sidebar collapsible="offcanvas">
          <SidebarHeader className="gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold tracking-tight">DocsReader</span>
              <div className="flex items-center gap-1">
                {activeRoot && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setTreeVersion((v) => v + 1)}
                      title="Collapse all"
                      className="size-8"
                    >
                      <ListCollapse />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void scan(activeRoot)}
                      disabled={!!activeScan?.scanning}
                      title="Refresh"
                      className="size-8"
                    >
                      <RefreshCw className={activeScan?.scanning ? "animate-spin" : ""} />
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={pickDirectory}>
                  <FolderPlus />
                  Add
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <SidebarInput
                placeholder="Search files, titles, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7"
              />
            </div>
          </SidebarHeader>

          <SidebarContent className="overflow-x-hidden">
            {roots.length === 0 ? (
              <Empty className="my-auto">
                <EmptyHeader>
                  <EmptyTitle>No folders yet</EmptyTitle>
                  <EmptyDescription>
                    Add a directory to start reading markdown files.
                  </EmptyDescription>
                </EmptyHeader>
                <Button onClick={pickDirectory}>
                  <FolderPlus />
                  Add Folder
                </Button>
              </Empty>
            ) : (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>Folders</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {roots.map((r) => {
                        const label = r.split("/").filter(Boolean).pop() || r;
                        return (
                          <SidebarMenuItem key={r}>
                            <SidebarMenuButton
                              isActive={r === activeRoot}
                              tooltip={{ children: r, hidden: false }}
                              onClick={() => selectRoot(r)}
                            >
                              <span>{label}</span>
                            </SidebarMenuButton>
                            <SidebarMenuAction
                              showOnHover
                              title="Remove folder"
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeRoot(r);
                              }}
                            >
                              <X />
                              <span className="sr-only">Remove folder</span>
                            </SidebarMenuAction>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                {allTags.length > 0 && (
                  <SidebarGroup>
                    <SidebarGroupLabel>Tags</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <div className="flex flex-wrap gap-1 px-2">
                        {allTags.slice(0, 32).map((t) => {
                          const active = search.toLowerCase() === t.toLowerCase();
                          return (
                            <Badge
                              key={t}
                              variant={active ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => setSearch(active ? "" : t)}
                            >
                              #{t}
                            </Badge>
                          );
                        })}
                      </div>
                    </SidebarGroupContent>
                  </SidebarGroup>
                )}

                <SidebarSeparator />

                <SidebarGroup>
                  <SidebarGroupLabel>Files</SidebarGroupLabel>
                  <SidebarGroupContent>
                    {activeScan?.scanning ? (
                      <ScanProgressView
                        progress={activeScan.progress}
                        startedAt={activeScan.startedAt}
                      />
                    ) : tree && filteredFiles.length > 0 ? (
                      <FileTree
                        key={treeVersion}
                        node={tree}
                        selectedPath={selectedPath}
                        onSelect={openFile}
                        startCollapsed={treeVersion > 0}
                      />
                    ) : (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No markdown files found.
                      </p>
                    )}
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="text-xs text-muted-foreground">
            {activeScan?.scanning ? (
              <span className="animate-pulse px-2">
                Scanning… {activeScan.progress?.filesFound ?? 0} files,{" "}
                {activeScan.progress?.dirsVisited ?? 0} dirs
              </span>
            ) : activeScan ? (
              <span className="px-2">
                {activeScan.result.files.length} files
                {activeScan.result.truncated && " (50k cap)"}
                {activeScan.startedAt && activeScan.finishedAt && (
                  <>
                    {" "}
                    · scanned in{" "}
                    {Math.max(
                      1,
                      Math.round(activeScan.finishedAt - activeScan.startedAt)
                    )}
                    ms
                  </>
                )}
                {search && ` · ${filteredFiles.length} match`}
              </span>
            ) : null}
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        <SidebarInset className="flex flex-col">
          <header className="flex items-center gap-2 px-4 py-3 border-b bg-background sticky top-0 z-10">
            <SidebarTrigger />
            {selectedFile && (
              <PathBreadcrumb
                relPath={selectedFile.relPath}
                onSegmentClick={(segment) => setSearch(segment)}
              />
            )}
            <div className="ml-auto flex items-center gap-1">
              <ViewSettingsMenu settings={viewSettings} onChange={updateViewSettings} />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {selectedFile ? (
              <article
                className={
                  viewSettings.width === "full"
                    ? "px-10 pt-6 pb-16 w-full"
                    : "px-10 pt-6 pb-16 max-w-4xl mx-auto"
                }
              >
                <h2 className="text-2xl font-semibold tracking-tight">
                  {selectedFile.title || selectedFile.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {selectedFile.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      #{t}
                    </Badge>
                  ))}
                  {selectedFile.modified && (
                    <span className="text-muted-foreground">
                      Modified{" "}
                      {new Date(selectedFile.modified * 1000).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {Object.keys(contentMeta).length > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Frontmatter
                    </summary>
                    <pre className="mt-1 bg-muted border rounded-md p-2 overflow-x-auto text-[11px]">
                      {JSON.stringify(contentMeta, null, 2)}
                    </pre>
                  </details>
                )}
                <div className="mt-6">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : contentError ? (
                    <p className="text-sm text-destructive">{contentError}</p>
                  ) : (
                    <MarkdownViewer
                      content={content}
                      fontFamily={viewSettings.fontFamily}
                      fontSize={viewSettings.fontSize}
                    />
                  )}
                </div>
              </article>
            ) : (
              <Empty className="h-full">
                <EmptyHeader>
                  <EmptyTitle>Pick a file to start reading</EmptyTitle>
                  <EmptyDescription>
                    {roots.length === 0
                      ? "Add a folder of markdown files using the sidebar."
                      : "Select a file from the tree on the left."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function PathBreadcrumb({
  relPath,
  onSegmentClick,
}: {
  relPath: string;
  onSegmentClick: (segment: string) => void;
}) {
  const segments = relPath.split(/[\\/]/).filter(Boolean);
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1;
          return (
            <Fragment key={i}>
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="truncate">{segment}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer hover:text-foreground truncate"
                    onClick={() => onSegmentClick(segment)}
                  >
                    {segment}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default App;
