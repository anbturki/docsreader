import type { MouseEvent } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TreeNode } from "@/lib/tree";
import type { GitFileStatusKind } from "@/lib/git";
import { EntryContextMenu } from "./EntryContextMenu";

interface Props {
  node: TreeNode;
  rootKey: string;
  selectedPath?: string;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  isExpanded: (key: string, depth: number) => boolean;
  onToggleExpanded: (key: string, currentlyOpen: boolean) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
  onHide: (path: string) => void;
  gitStatusByPath?: Map<string, GitFileStatusKind>;
  onShowGitDiff?: (path: string) => void;
}

export function FileTree({
  node,
  rootKey,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  isExpanded,
  onToggleExpanded,
  isPinned,
  onTogglePin,
  onHide,
  gitStatusByPath,
  onShowGitDiff,
}: Props) {
  return (
    <ul className="px-1 py-1">
      {node.children.map((child) => (
        <TreeEntry
          key={child.path + child.name}
          node={child}
          rootKey={rootKey}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onOpenInNewTab={onOpenInNewTab}
          onOpenInOtherPane={onOpenInOtherPane}
          depth={0}
          isExpanded={isExpanded}
          onToggleExpanded={onToggleExpanded}
          isPinned={isPinned}
          onTogglePin={onTogglePin}
          onHide={onHide}
          gitStatusByPath={gitStatusByPath}
          onShowGitDiff={onShowGitDiff}
        />
      ))}
    </ul>
  );
}

interface EntryProps {
  node: TreeNode;
  rootKey: string;
  selectedPath?: string;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  depth: number;
  isExpanded: (key: string, depth: number) => boolean;
  onToggleExpanded: (key: string, currentlyOpen: boolean) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
  onHide: (path: string) => void;
  gitStatusByPath?: Map<string, GitFileStatusKind>;
  onShowGitDiff?: (path: string) => void;
}

const INDENT_STEP = 14;

function TreeEntry({
  node,
  rootKey,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  depth,
  isExpanded,
  onToggleExpanded,
  isPinned,
  onTogglePin,
  onHide,
  gitStatusByPath,
  onShowGitDiff,
}: EntryProps) {
  const gitStatus = !node.isDir && node.file
    ? gitStatusByPath?.get(node.file.relPath.replace(/\\/g, "/"))
    : undefined;
  const padLeft = 8 + depth * INDENT_STEP;

  if (!node.isDir) {
    if (node.missing) {
      return (
        <li>
          <div
            style={{ paddingLeft: padLeft }}
            className="flex w-full items-center gap-2 py-1.5 pr-2 text-left text-sm text-muted-foreground/70"
            title={`Path declared in .docs.yaml but not found in the workspace: ${node.path.replace(/^missing::/, "")}`}
          >
            <FileText className="size-3.5 shrink-0 opacity-60" />
            <span className="truncate italic">{node.name}</span>
            {node.badge && <Badge label={node.badge} />}
            <span className="ml-auto text-[10px] uppercase tracking-wide opacity-70">
              missing
            </span>
          </div>
        </li>
      );
    }
    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onOpenInNewTab(node.path);
        return;
      }
      onSelect(node.path);
    };
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        onOpenInNewTab(node.path);
      }
    };
    return (
      <li>
        <EntryContextMenu
          path={node.path}
          isFile
          onOpenInNewTab={onOpenInNewTab}
          onOpenInOtherPane={onOpenInOtherPane}
          pinned={isPinned(node.path)}
          onTogglePin={onTogglePin}
          onHide={onHide}
          onShowGitDiff={onShowGitDiff}
        >
          <button
            onClick={handleClick}
            onAuxClick={handleAuxClick}
            style={{ paddingLeft: padLeft }}
            className={cn(
              "flex w-full items-center gap-2 py-1.5 pr-2 text-left text-sm transition-colors",
              node.path === selectedPath
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/50"
            )}
            title={node.name}
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{node.name}</span>
            {gitStatus && <GitBadge kind={gitStatus} />}
            {node.badge && <Badge label={node.badge} />}
          </button>
        </EntryContextMenu>
      </li>
    );
  }

  const dirKey = `${rootKey}::${node.path}`;
  const open = isExpanded(dirKey, depth);

  return (
    <li>
      <Collapsible open={open} onOpenChange={(next) => onToggleExpanded(dirKey, !next)}>
        <EntryContextMenu path={node.path} isFile={false} onHide={onHide}>
          <CollapsibleTrigger
            style={{ paddingLeft: padLeft }}
            className="group flex w-full items-center gap-2 py-1.5 pr-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 transition-transform",
                open && "rotate-90"
              )}
            />
            <span className="truncate">{node.name}</span>
          </CollapsibleTrigger>
        </EntryContextMenu>
        <CollapsibleContent>
          <ul>
            {node.children.map((child) => (
              <TreeEntry
                key={child.path + child.name}
                node={child}
                rootKey={rootKey}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onOpenInNewTab={onOpenInNewTab}
                onOpenInOtherPane={onOpenInOtherPane}
                depth={depth + 1}
                isExpanded={isExpanded}
                onToggleExpanded={onToggleExpanded}
                isPinned={isPinned}
                onTogglePin={onTogglePin}
                onHide={onHide}
                gitStatusByPath={gitStatusByPath}
                onShowGitDiff={onShowGitDiff}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="ml-auto rounded-sm bg-sidebar-accent/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

const GIT_BADGE_LABELS: Record<GitFileStatusKind, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "?",
  unmerged: "U",
};

const GIT_BADGE_TOOLTIPS: Record<GitFileStatusKind, string> = {
  modified: "Modified since HEAD",
  added: "Added (staged)",
  deleted: "Deleted",
  renamed: "Renamed",
  untracked: "Untracked",
  unmerged: "Unmerged conflict",
};

const GIT_BADGE_CLASSES: Record<GitFileStatusKind, string> = {
  modified: "text-amber-600 dark:text-amber-400",
  added: "text-emerald-600 dark:text-emerald-400",
  deleted: "text-rose-600 dark:text-rose-400",
  renamed: "text-blue-600 dark:text-blue-400",
  untracked: "text-muted-foreground",
  unmerged: "text-rose-700 dark:text-rose-300",
};

function GitBadge({ kind }: { kind: GitFileStatusKind }) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold tabular-nums",
        GIT_BADGE_CLASSES[kind]
      )}
      title={GIT_BADGE_TOOLTIPS[kind]}
      aria-label={GIT_BADGE_TOOLTIPS[kind]}
    >
      {GIT_BADGE_LABELS[kind]}
    </span>
  );
}

export function collectDirKeys(node: TreeNode, rootKey: string): string[] {
  const out: string[] = [];
  function walk(n: TreeNode) {
    if (!n.isDir) return;
    out.push(`${rootKey}::${n.path}`);
    for (const c of n.children) walk(c);
  }
  for (const c of node.children) walk(c);
  return out;
}
