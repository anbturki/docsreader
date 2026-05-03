import { FolderPlus, ListCollapse, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { MarkdownFile } from "@/lib/scan";
import type { TreeNode } from "@/lib/tree";
import type { RootScan } from "@/hooks/useLibrary";
import { FileTree } from "./FileTree";
import { FolderList } from "./FolderList";
import { ScanProgressView } from "./ScanProgressView";
import { SearchInput } from "./SearchInput";
import { TagsBar } from "./TagsBar";

interface Props {
  roots: string[];
  activeRoot: string | undefined;
  activeScan: RootScan | undefined;
  selectedPath: string | undefined;
  search: string;
  filteredFiles: MarkdownFile[];
  tags: string[];
  tree: TreeNode | undefined;
  rootKey: string;
  isExpanded: (key: string, depth: number) => boolean;
  onToggleExpanded: (key: string, currentlyOpen: boolean) => void;
  onPickDirectory: () => void;
  onSelectRoot: (path: string) => void;
  onRemoveRoot: (path: string) => void;
  onRescan: () => void;
  onCollapseAll: () => void;
  onSearchChange: (value: string) => void;
  onSelectFile: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
}

export function ExplorerSidebar({
  roots,
  activeRoot,
  activeScan,
  selectedPath,
  search,
  filteredFiles,
  tags,
  tree,
  rootKey,
  isExpanded,
  onToggleExpanded,
  onPickDirectory,
  onSelectRoot,
  onRemoveRoot,
  onRescan,
  onCollapseAll,
  onSearchChange,
  onSelectFile,
  onOpenInNewTab,
}: Props) {
  return (
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
                  onClick={onCollapseAll}
                  title="Collapse all"
                  className="size-8"
                >
                  <ListCollapse />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onRescan}
                  disabled={!!activeScan?.scanning}
                  title="Refresh"
                  className="size-8"
                >
                  <RefreshCw className={activeScan?.scanning ? "animate-spin" : ""} />
                </Button>
              </>
            )}
            <Button size="sm" onClick={onPickDirectory}>
              <FolderPlus />
              Add
            </Button>
          </div>
        </div>

        <SearchInput value={search} onChange={onSearchChange} />
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
            <Button onClick={onPickDirectory}>
              <FolderPlus />
              Add Folder
            </Button>
          </Empty>
        ) : (
          <>
            <FolderList
              roots={roots}
              activeRoot={activeRoot}
              onSelect={onSelectRoot}
              onRemove={onRemoveRoot}
            />

            <TagsBar tags={tags} activeTag={search} onTagClick={(tag) => onSearchChange(tag === search ? "" : tag)} />

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
                    node={tree}
                    rootKey={rootKey}
                    selectedPath={selectedPath}
                    onSelect={onSelectFile}
                    onOpenInNewTab={onOpenInNewTab}
                    isExpanded={isExpanded}
                    onToggleExpanded={onToggleExpanded}
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
        <ExplorerFooter activeScan={activeScan} search={search} matchCount={filteredFiles.length} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function ExplorerFooter({
  activeScan,
  search,
  matchCount,
}: {
  activeScan: RootScan | undefined;
  search: string;
  matchCount: number;
}) {
  if (!activeScan) return null;
  if (activeScan.scanning) {
    return (
      <span className="animate-pulse px-2">
        Scanning… {activeScan.progress?.filesFound ?? 0} files,{" "}
        {activeScan.progress?.dirsVisited ?? 0} dirs
      </span>
    );
  }
  const elapsed =
    activeScan.startedAt && activeScan.finishedAt
      ? Math.max(1, Math.round(activeScan.finishedAt - activeScan.startedAt))
      : null;
  return (
    <span className="px-2">
      {activeScan.result.files.length} files
      {activeScan.result.truncated && " (50k cap)"}
      {elapsed !== null && <> · scanned in {elapsed}ms</>}
      {search && ` · ${matchCount} match`}
    </span>
  );
}
