import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import type { MarkdownFile } from "@/lib/scan";
import type { TreeNode } from "@/lib/tree";
import type { LensViewId, SidebarLens } from "@/lib/storage";
import type { RootScan } from "@/hooks/useLibrary";
import type { GitFileStatusKind } from "@/lib/git";
import { ExplorerHeader } from "./ExplorerHeader";
import { FileTree } from "./FileTree";
import { LensRail } from "./LensRail";
import { PinnedList } from "./PinnedList";
import { RecentList } from "./RecentList";
import { ScanProgressView } from "./ScanProgressView";
import { RAIL_ITEM } from "./railItem";
import { SearchResults } from "./SearchResults";
import { SidebarToggle } from "./SidebarToggle";
import { TagsList } from "./TagsList";
import { TaskFilterProvider } from "./TaskFilterContext";
import type { SearchEntry } from "@/lib/searchEntries";
import type { SidebarSearch } from "@/hooks/useSidebarSearch";
import { TasksBoard } from "@/components/tasks/TasksBoard";

interface Props {
  // workspaces
  roots: string[];
  activeRoot: string | undefined;
  activeScan: RootScan | undefined;
  onPickDirectory: () => void;
  onOpenWelcome: (() => void) | undefined;
  onRefresh: () => void;

  // lens
  lens: SidebarLens;
  onLensChange: (lens: SidebarLens) => void;
  lensView: LensViewId | undefined;
  onLensViewChange: (view: LensViewId) => void;

  // search
  search: SidebarSearch;
  searchEntries: SearchEntry[];
  searchingContents: boolean;
  searchError: string | undefined;
  searchTruncated: boolean;

  // files
  filteredFiles: MarkdownFile[];
  pinnedFiles: MarkdownFile[];

  // tree
  tree: TreeNode | undefined;
  rootKey: string;
  isExpanded: (key: string, depth: number) => boolean;
  onToggleExpanded: (key: string, currentlyOpen: boolean) => void;

  // pin / hide
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
  onHide: (path: string) => void;
  hiddenCount: number;
  onOpenSettings: () => void;

  // file ops
  selectedPath: string | undefined;
  onSelectFile: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;

  // git
  gitStatusByPath?: Map<string, GitFileStatusKind>;
  onShowGitDiff?: (path: string) => void;
}

export function ExplorerSidebar(props: Props) {
  return (
    <TaskFilterProvider view={props.lensView} onViewChange={props.onLensViewChange}>
      <SidebarPanels {...props} />
    </TaskFilterProvider>
  );
}

function SidebarPanels({
  roots,
  activeRoot,
  activeScan,
  onPickDirectory,
  onOpenWelcome,
  onRefresh,
  lens,
  onLensChange,
  search,
  searchEntries,
  searchingContents,
  searchError,
  searchTruncated,
  filteredFiles,
  pinnedFiles,
  tree,
  rootKey,
  isExpanded,
  onToggleExpanded,
  isPinned,
  onTogglePin,
  onHide,
  hiddenCount,
  onOpenSettings,
  selectedPath,
  onSelectFile,
  onOpenInNewTab,
  onOpenInOtherPane,
  gitStatusByPath,
  onShowGitDiff,
}: Props) {
  const { state, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const showingResults = search.query.trim() !== "" && lens !== "tasks";

  // One refresh control serves the whole sidebar, but each lens draws from a
  // different source: the file lenses from the workspace scan, the task board
  // from its own list. The header rescans and signals the board; a lens that
  // needs no reload simply ignores the signal.
  const [refreshSignal, setRefreshSignal] = useState(0);
  const refreshLens = () => {
    onRefresh();
    setRefreshSignal((n) => n + 1);
  };

  const selectLens = (next: SidebarLens) => {
    onLensChange(next);
    setOpen(true);
  };

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      // The variant's own gap is a hardcoded `p-2`, so both the inset and the
      // collapsed width it derives from that gap are restated off the shared
      // token; left alone, the collapsed panel is wider than the rail it holds.
      // No padding on the right: that edge meets the content card, not the window.
      className="top-(--toolbar-height) h-auto overflow-hidden p-(--chrome-inset) pr-0 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--chrome-inset))] *:data-[sidebar=sidebar]:flex-row"
    >
      {roots.length > 0 ? (
        <LensRail active={lens} onChange={selectLens} />
      ) : (
        collapsed && (
          <div className="w-(--sidebar-width-icon) p-1">
            <SidebarToggle className={RAIL_ITEM} />
          </div>
        )
      )}

      {!collapsed && (
        <Sidebar
          collapsible="none"
          // Its own panel rather than an area bleeding into the window, gapped
          // from the rail but flush with the content card: the right edge is
          // left open so the seam between them is the card's border alone.
          className="ml-(--chrome-inset) min-w-0 flex-1 rounded-l-md border border-r-0 border-sidebar-border"
        >
          {roots.length > 0 && (
            <ExplorerHeader
              lens={lens}
              search={search}
              scanning={!!activeScan?.scanning}
              onRefresh={refreshLens}
            />
          )}

          <SidebarContent className="overflow-x-hidden">
            {roots.length === 0 ? (
              <Empty className="my-auto">
                <EmptyHeader>
                  <EmptyTitle>No workspaces yet</EmptyTitle>
                  <EmptyDescription>
                    Add a folder of markdown to start.
                  </EmptyDescription>
                </EmptyHeader>
                <div className="flex flex-col items-center gap-2">
                  <Button onClick={onPickDirectory}>Add folder</Button>
                  {onOpenWelcome && (
                    <Button variant="ghost" size="sm" onClick={onOpenWelcome}>
                      Or open the welcome workspace
                    </Button>
                  )}
                </div>
              </Empty>
            ) : activeScan?.scanning && activeScan.result.files.length === 0 ? (
              <ScanProgressView
                progress={activeScan.progress}
                startedAt={activeScan.startedAt}
              />
            ) : showingResults ? (
              <SearchResults
                query={search.query}
                entries={searchEntries}
                scope={search.scope}
                searching={searchingContents}
                error={searchError}
                truncated={searchTruncated}
                selectedPath={selectedPath}
                onSelect={onSelectFile}
                onOpenInNewTab={onOpenInNewTab}
                onOpenInOtherPane={onOpenInOtherPane}
                isPinned={isPinned}
                onTogglePin={onTogglePin}
              />
            ) : (
              <LensView
                lens={lens}
                activeRoot={activeRoot}
                taskQuery={search.query}
                refreshSignal={refreshSignal}
                tree={tree}
                rootKey={rootKey}
                filteredFiles={filteredFiles}
                pinnedFiles={pinnedFiles}
                selectedPath={selectedPath}
                isExpanded={isExpanded}
                onToggleExpanded={onToggleExpanded}
                isPinned={isPinned}
                onTogglePin={onTogglePin}
                onHide={onHide}
                onSelect={onSelectFile}
                onOpenInNewTab={onOpenInNewTab}
                onOpenInOtherPane={onOpenInOtherPane}
                gitStatusByPath={gitStatusByPath}
                onShowGitDiff={onShowGitDiff}
              />
            )}
          </SidebarContent>

          {hiddenCount > 0 && (
            <SidebarFooter className="p-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={onOpenSettings}
                className="self-start rounded-sm underline-offset-2 hover:underline focus:underline focus:outline-none"
                title="Manage hidden files in Settings"
              >
                {hiddenCount} hidden
              </button>
            </SidebarFooter>
          )}
        </Sidebar>
      )}
    </Sidebar>
  );
}

interface LensViewProps {
  lens: SidebarLens;
  activeRoot: string | undefined;
  taskQuery: string;
  refreshSignal: number;
  tree: TreeNode | undefined;
  rootKey: string;
  filteredFiles: MarkdownFile[];
  pinnedFiles: MarkdownFile[];
  selectedPath: string | undefined;
  isExpanded: (key: string, depth: number) => boolean;
  onToggleExpanded: (key: string, currentlyOpen: boolean) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
  onHide: (path: string) => void;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  gitStatusByPath?: Map<string, GitFileStatusKind>;
  onShowGitDiff?: (path: string) => void;
}

function LensView({
  lens,
  activeRoot,
  taskQuery,
  refreshSignal,
  tree,
  rootKey,
  filteredFiles,
  pinnedFiles,
  selectedPath,
  isExpanded,
  onToggleExpanded,
  isPinned,
  onTogglePin,
  onHide,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  gitStatusByPath,
  onShowGitDiff,
}: LensViewProps) {
  if (lens === "tree") {
    if (!tree || filteredFiles.length === 0) {
      return (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No markdown files found.
        </p>
      );
    }
    return (
      <FileTree
        node={tree}
        rootKey={rootKey}
        selectedPath={selectedPath}
        onSelect={onSelect}
        onOpenInNewTab={onOpenInNewTab}
        onOpenInOtherPane={onOpenInOtherPane}
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
        onHide={onHide}
        gitStatusByPath={gitStatusByPath}
        onShowGitDiff={onShowGitDiff}
      />
    );
  }
  if (lens === "recent") {
    return (
      <RecentList
        files={filteredFiles}
        selectedPath={selectedPath}
        onSelect={onSelect}
        onOpenInNewTab={onOpenInNewTab}
        onOpenInOtherPane={onOpenInOtherPane}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
      />
    );
  }
  if (lens === "tasks") {
    return (
      <TasksBoard
        activeRoot={activeRoot}
        query={taskQuery}
        refreshSignal={refreshSignal}
        selectedPath={selectedPath}
        onOpen={onSelect}
        onOpenInNewTab={onOpenInNewTab}
        onOpenInOtherPane={onOpenInOtherPane}
      />
    );
  }
  if (lens === "tags") {
    return (
      <TagsList
        files={filteredFiles}
        selectedPath={selectedPath}
        onSelect={onSelect}
        onOpenInNewTab={onOpenInNewTab}
        onOpenInOtherPane={onOpenInOtherPane}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
      />
    );
  }
  // pinned lens
  return (
    <PinnedList
      files={pinnedFiles}
      selectedPath={selectedPath}
      onSelect={onSelect}
      onOpenInNewTab={onOpenInNewTab}
      onOpenInOtherPane={onOpenInOtherPane}
      onTogglePin={onTogglePin}
    />
  );
}
