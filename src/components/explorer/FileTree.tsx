import type { MouseEvent } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TreeNode } from "@/lib/tree";
import { EntryContextMenu } from "./EntryContextMenu";

interface Props {
  node: TreeNode;
  rootKey: string;
  selectedPath?: string;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  isExpanded: (key: string, depth: number) => boolean;
  onToggleExpanded: (key: string, currentlyOpen: boolean) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
  onHide: (path: string) => void;
}

export function FileTree({
  node,
  rootKey,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  isExpanded,
  onToggleExpanded,
  isPinned,
  onTogglePin,
  onHide,
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
          depth={0}
          isExpanded={isExpanded}
          onToggleExpanded={onToggleExpanded}
          isPinned={isPinned}
          onTogglePin={onTogglePin}
          onHide={onHide}
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
  depth: number;
  isExpanded: (key: string, depth: number) => boolean;
  onToggleExpanded: (key: string, currentlyOpen: boolean) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
  onHide: (path: string) => void;
}

const INDENT_STEP = 14;

function TreeEntry({
  node,
  rootKey,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  depth,
  isExpanded,
  onToggleExpanded,
  isPinned,
  onTogglePin,
  onHide,
}: EntryProps) {
  const padLeft = 8 + depth * INDENT_STEP;

  if (!node.isDir) {
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
          pinned={isPinned(node.path)}
          onTogglePin={onTogglePin}
          onHide={onHide}
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
                depth={depth + 1}
                isExpanded={isExpanded}
                onToggleExpanded={onToggleExpanded}
                isPinned={isPinned}
                onTogglePin={onTogglePin}
                onHide={onHide}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
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
