import { useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, ListCollapse, RefreshCw } from "lucide-react";
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
import type { ProjectMeta } from "@/lib/docsYaml";
import type { ManifestIssue } from "@/lib/manifestIssues";
import type { GitFileStatusKind } from "@/lib/git";
import { FileTree } from "./FileTree";
import { LensTabs } from "./LensTabs";
import { PinnedList } from "./PinnedList";
import { RecentList } from "./RecentList";
import { ScanProgressView } from "./ScanProgressView";
import { SearchInput } from "./SearchInput";
import { TagsList } from "./TagsList";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export interface ResolvedCrossLink {
  label: string;
  description?: string;
  targetRoot: string;
  targetName: string;
}

interface Props {
  // workspaces
  roots: string[];
  activeRoot: string | undefined;
  activeScan: RootScan | undefined;
  projectMetaByRoot: Record<string, ProjectMeta>;
  onPickDirectory: () => void;
  onSelectRoot: (path: string) => void;
  onRemoveRoot: (path: string) => void;
  onRescan: () => void;
  onOpenWelcome: (() => void) | undefined;
  crossLinks: ResolvedCrossLink[];
  manifestIssues: ManifestIssue[];

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
  onCollapseAll: () => void;

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

  // git
  gitStatusByPath?: Map<string, GitFileStatusKind>;
  onShowGitDiff?: (path: string) => void;
}

export function ExplorerSidebar({
  roots,
  activeRoot,
  activeScan,
  projectMetaByRoot,
  onPickDirectory,
  onSelectRoot,
  onRemoveRoot,
  onRescan,
  onOpenWelcome,
  crossLinks,
  manifestIssues,
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
  onCollapseAll,
  isPinned,
  onTogglePin,
  onHide,
  hiddenCount,
  onOpenSettings,
  selectedPath,
  onSelectFile,
  onOpenInNewTab,
  gitStatusByPath,
  onShowGitDiff,
}: Props) {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-0 p-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-sm font-semibold tracking-tight">DocsReader</span>
          <div className="flex items-center gap-0.5">
            {activeRoot && lens === "tree" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onCollapseAll}
                title="Collapse all"
                className="size-7 text-muted-foreground"
              >
                <ListCollapse />
              </Button>
            )}
            {activeRoot && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onRescan}
                disabled={!!activeScan?.scanning}
                title="Refresh"
                className="size-7 text-muted-foreground"
              >
                <RefreshCw className={activeScan?.scanning ? "animate-spin" : ""} />
              </Button>
            )}
          </div>
        </div>

        {roots.length > 0 && (
          <WorkspaceSwitcher
            roots={roots}
            activeRoot={activeRoot}
            projectMetaByRoot={projectMetaByRoot}
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
        ) : activeScan?.scanning ? (
          <ScanProgressView
            progress={activeScan.progress}
            startedAt={activeScan.startedAt}
          />
        ) : (
          <LensView
            lens={lens}
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
            gitStatusByPath={gitStatusByPath}
            onShowGitDiff={onShowGitDiff}
          />
        )}
      </SidebarContent>

      <SidebarFooter className="gap-2 text-xs text-muted-foreground">
        {manifestIssues.length > 0 && (
          <ManifestIssuesSection issues={manifestIssues} />
        )}
        {crossLinks.length > 0 && (
          <CrossLinksSection links={crossLinks} onSelect={onSelectRoot} />
        )}
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
  gitStatusByPath?: Map<string, GitFileStatusKind>;
  onShowGitDiff?: (path: string) => void;
}

function LensView({
  lens,
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
        isPinned={isPinned}
        onTogglePin={onTogglePin}
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
      onTogglePin={onTogglePin}
    />
  );
}

function CrossLinksSection({
  links,
  onSelect,
}: {
  links: ResolvedCrossLink[];
  onSelect: (root: string) => void;
}) {
  return (
    <div className="border-t pt-2">
      <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide opacity-70">
        See also
      </div>
      <ul className="flex flex-col gap-0.5">
        {links.map((link) => (
          <li key={link.targetRoot}>
            <button
              type="button"
              onClick={() => onSelect(link.targetRoot)}
              className="group flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/60"
              title={link.description ?? link.targetName}
            >
              <ArrowRight className="mt-0.5 size-3 shrink-0 opacity-60 group-hover:opacity-100" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground/90">
                  {link.targetName}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {link.label}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ManifestIssuesSection({ issues }: { issues: ManifestIssue[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/60"
      >
        <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
        <span className="flex-1 truncate text-[11px] font-medium">
          {issues.length} manifest issue{issues.length === 1 ? "" : "s"}
        </span>
        <ChevronDown
          className={`size-3 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="mt-1 flex flex-col gap-1 px-2">
          {issues.map((issue, idx) => (
            <li
              key={`${issue.kind}-${idx}`}
              className="text-[11px] leading-relaxed text-muted-foreground"
              title={issue.message}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
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
  return (
    <span className="flex items-center gap-2 px-2">
      <span>
        {visible} files
        {activeScan.result.truncated && " (50k cap)"}
        {matchCount !== visible && ` · ${matchCount} match`}
      </span>
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
