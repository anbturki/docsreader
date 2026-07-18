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
import { LensTabs } from "./LensTabs";
import { PinnedList } from "./PinnedList";
import { RecentList } from "./RecentList";
import { ScanProgressView } from "./ScanProgressView";
import { SearchInput } from "./SearchInput";
import { TagsList } from "./TagsList";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { TasksBoard } from "@/components/tasks/TasksBoard";

interface Props {
  // workspaces
  roots: string[];
  activeRoot: string | undefined;
  activeScan: RootScan | undefined;
  workspaceNamesByRoot: Record<string, string>;
  onSelectRoot: (path: string) => void;
  onRemoveRoot: (path: string) => void;
  onPickDirectory: () => void;
  onOpenWelcome: (() => void) | undefined;

  // lens
  lens: SidebarLens;
  onLensChange: (lens: SidebarLens) => void;

  // search
  search: string;
  onSearchChange: (value: string) => void;

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
  workspaceNamesByRoot,
  onSelectRoot,
  onRemoveRoot,
  onPickDirectory,
  onOpenWelcome,
  lens,
  onLensChange,
  search,
  onSearchChange,
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
    <Sidebar collapsible="offcanvas">
      <SidebarHeader data-tauri-drag-region className="gap-0 p-0 pt-9">
        {roots.length > 0 && (
          <WorkspaceSwitcher
            roots={roots}
            activeRoot={activeRoot}
            workspaceNamesByRoot={workspaceNamesByRoot}
            onSelect={onSelectRoot}
            onRemove={onRemoveRoot}
            onAdd={onPickDirectory}
          />
        )}
        {roots.length > 0 && (
          <LensTabs active={lens} onChange={onLensChange} />
        )}

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
          matchCount={filteredFiles.length}
          hiddenCount={hiddenCount}
          onOpenSettings={onOpenSettings}
        />
      </SidebarFooter>

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
