import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { MarkdownFile } from "@/lib/scan";
import type { TreeNode } from "@/lib/tree";
import type { SidebarLens } from "@/lib/storage";
import type { RootScan } from "@/hooks/useLibrary";
import type { GitFileStatusKind } from "@/lib/git";
import { FileTree } from "./FileTree";
import { LensRail } from "./LensRail";
import { PinnedList } from "./PinnedList";
import { RecentList } from "./RecentList";
import { ScanProgressView } from "./ScanProgressView";
import { SearchInput } from "./SearchInput";
import { SearchResults } from "./SearchResults";
import { TagsList } from "./TagsList";
import type { SearchEntry } from "@/lib/searchEntries";
import type { SearchScope } from "@/lib/contentSearch";
import { TasksBoard } from "@/components/tasks/TasksBoard";

interface Props {
  // workspaces
  roots: string[];
  activeRoot: string | undefined;
  activeScan: RootScan | undefined;
  onPickDirectory: () => void;
  onOpenWelcome: (() => void) | undefined;

  // lens
  lens: SidebarLens;
  onLensChange: (lens: SidebarLens) => void;

  // search
  search: string;
  onSearchChange: (value: string) => void;
  searchEntries: SearchEntry[];
  searchScope: SearchScope;
  onSearchScopeChange: (scope: SearchScope) => void;
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

export function ExplorerSidebar({
  roots,
  activeRoot,
  activeScan,
  onPickDirectory,
  onOpenWelcome,
  lens,
  onLensChange,
  search,
  onSearchChange,
  searchEntries,
  searchScope,
  onSearchScopeChange,
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
  return (
    <Sidebar
      collapsible="offcanvas"
      className="top-(--toolbar-height) h-auto *:data-[sidebar=sidebar]:flex-row"
    >
      {roots.length > 0 && <LensRail active={lens} onChange={onLensChange} />}

      <Sidebar collapsible="none" className="min-w-0 flex-1">
        <SidebarHeader className="gap-0 p-0">
          {roots.length > 0 && (
            <div className="px-2 pt-2 pb-2">
              <SearchInput value={search} onChange={onSearchChange} />
            </div>
          )}
        </SidebarHeader>

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
          ) : lens === "search" ? (
            <SearchResults
              query={search}
              entries={searchEntries}
              scope={searchScope}
              onScopeChange={onSearchScopeChange}
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

        <SidebarFooter className="gap-2 text-xs text-muted-foreground">
          <ExplorerFooter
            activeScan={activeScan}
            matchCount={lens === "search" ? searchEntries.length : filteredFiles.length}
            hiddenCount={hiddenCount}
            onOpenSettings={onOpenSettings}
          />
        </SidebarFooter>
      </Sidebar>

      <SidebarRail />
    </Sidebar>
  );
}

interface LensViewProps {
  lens: SidebarLens;
  activeRoot: string | undefined;
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

function ExplorerFooter({
  activeScan,
  matchCount,
  hiddenCount,
  onOpenSettings,
}: {
  activeScan: RootScan | undefined;
  matchCount: number;
  hiddenCount: number;
  onOpenSettings: () => void;
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
  const total = activeScan.result.files.length;
  const visible = total - hiddenCount;
  const skipped = activeScan.result.skipped ?? 0;
  return (
    <span className="flex items-center gap-2 px-2">
      <span>
        {visible} files
        {activeScan.result.truncated && " (50k cap)"}
        {matchCount !== visible && ` · ${matchCount} match`}
      </span>
      {skipped > 0 && (
        <span title="Files that could not be read or were too large to include">
          {skipped} skipped
        </span>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="ml-auto rounded-sm underline-offset-2 hover:underline focus:underline focus:outline-none"
          title="Manage hidden files in Settings"
        >
          {hiddenCount} hidden
        </button>
      )}
    </span>
  );
}
