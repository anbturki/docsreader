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
import { SIDEBAR_ROW, sidebarRowState, fileOpenHandlers } from "./sidebarRow";

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

export function FileTree({ node, ...rest }: Props) {
  return (
    <ul className="px-1 py-1">
      {node.children.map((child) => (
        <TreeEntry key={child.path + child.name} node={child} depth={0} {...rest} />
      ))}
    </ul>
  );
}

interface EntryProps extends Props {
  depth: number;
}

const INDENT_STEP = 12;
const BASE_INDENT_PX = 8;

function entryPadding(depth: number) {
  return { paddingLeft: BASE_INDENT_PX + depth * INDENT_STEP };
}

function TreeEntry(props: EntryProps) {
  return props.node.isDir ? <DirEntry {...props} /> : <FileEntry {...props} />;
}

function FileEntry({
  node,
  depth,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  isPinned,
  onTogglePin,
  onHide,
  gitStatusByPath,
  onShowGitDiff,
}: EntryProps) {
  const gitStatus = node.file
    ? gitStatusByPath?.get(node.file.relPath.replace(/\\/g, "/"))
    : undefined;
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
          {...fileOpenHandlers(node.path, onSelect, onOpenInNewTab)}
          style={entryPadding(depth)}
          className={cn(SIDEBAR_ROW, "pr-2", sidebarRowState(node.path === selectedPath))}
          title={node.name}
        >
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
          {gitStatus && <GitBadge kind={gitStatus} />}
        </button>
      </EntryContextMenu>
    </li>
  );
}

function DirEntry(props: EntryProps) {
  const { node, rootKey, depth, isExpanded, onToggleExpanded, onHide } = props;
  const dirKey = `${rootKey}::${node.path}`;
  const open = isExpanded(dirKey, depth);

  return (
    <li>
      <Collapsible open={open} onOpenChange={(next) => onToggleExpanded(dirKey, !next)}>
        <EntryContextMenu path={node.path} isFile={false} onHide={onHide}>
          <CollapsibleTrigger
            style={entryPadding(depth)}
            className={cn(
              "group",
              SIDEBAR_ROW,
              "pr-2 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
            )}
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
                {...props}
                node={child}
                depth={depth + 1}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
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
  modified: "text-[var(--status-warning-fg)]",
  added: "text-[var(--status-success-fg)]",
  deleted: "text-[var(--status-error-fg)]",
  renamed: "text-[var(--status-info-fg)]",
  untracked: "text-muted-foreground",
  unmerged: "text-[var(--status-error-fg)]",
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
