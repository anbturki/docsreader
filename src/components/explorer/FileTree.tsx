import type { MouseEvent } from "react";
import { ChevronRight, FileText } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
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
}

export function FileTree({
  node,
  rootKey,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  isExpanded,
  onToggleExpanded,
}: Props) {
  return (
    <SidebarMenu>
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
        />
      ))}
    </SidebarMenu>
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
}

function TreeEntry({
  node,
  rootKey,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  depth,
  isExpanded,
  onToggleExpanded,
}: EntryProps) {
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
      <SidebarMenuItem>
        <EntryContextMenu
          path={node.path}
          isFile
          onOpenInNewTab={onOpenInNewTab}
        >
          <SidebarMenuButton
            isActive={node.path === selectedPath}
            onClick={handleClick}
            onAuxClick={handleAuxClick}
            tooltip={{ children: node.name, hidden: false }}
          >
            <FileText />
            <span className="truncate">{node.name}</span>
          </SidebarMenuButton>
        </EntryContextMenu>
      </SidebarMenuItem>
    );
  }

  const dirKey = `${rootKey}::${node.path}`;
  const open = isExpanded(dirKey, depth);

  return (
    <SidebarMenuItem>
      <Collapsible
        open={open}
        onOpenChange={(next) => onToggleExpanded(dirKey, !next)}
        className="group/collapsible w-full"
      >
        <EntryContextMenu path={node.path} isFile={false}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={{ children: node.name, hidden: false }}
              className="pr-8"
            >
              <ChevronRight className="shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              <span className="truncate">
                {node.segments && node.segments.length > 1 ? (
                  <CompactPath segments={node.segments} />
                ) : (
                  node.name
                )}
              </span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </EntryContextMenu>
        <SidebarMenuBadge>{countFiles(node)}</SidebarMenuBadge>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-2 px-1.5">
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
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
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

function countFiles(node: TreeNode): number {
  if (!node.isDir) return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}

function CompactPath({ segments }: { segments: string[] }) {
  return (
    <>
      {segments.map((s, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1 text-muted-foreground/60">›</span>}
          <span className={i < segments.length - 1 ? "text-muted-foreground" : ""}>
            {s}
          </span>
        </span>
      ))}
    </>
  );
}
