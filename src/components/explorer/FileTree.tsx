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
  selectedPath?: string;
  onSelect: (path: string) => void;
  startCollapsed?: boolean;
}

export function FileTree({ node, selectedPath, onSelect, startCollapsed = false }: Props) {
  return (
    <SidebarMenu>
      {node.children.map((child) => (
        <TreeEntry
          key={child.path + child.name}
          node={child}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={0}
          startCollapsed={startCollapsed}
        />
      ))}
    </SidebarMenu>
  );
}

interface EntryProps {
  node: TreeNode;
  selectedPath?: string;
  onSelect: (path: string) => void;
  depth: number;
  startCollapsed: boolean;
}

function TreeEntry({ node, selectedPath, onSelect, depth, startCollapsed }: EntryProps) {
  if (!node.isDir) {
    return (
      <SidebarMenuItem>
        <EntryContextMenu path={node.path}>
          <SidebarMenuButton
            isActive={node.path === selectedPath}
            onClick={() => onSelect(node.path)}
            tooltip={{ children: node.name, hidden: false }}
          >
            <FileText />
            <span className="truncate">{node.name}</span>
          </SidebarMenuButton>
        </EntryContextMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Collapsible
        defaultOpen={!startCollapsed && depth < 1}
        className="group/collapsible w-full"
      >
        <EntryContextMenu path={node.path}>
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
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
                startCollapsed={startCollapsed}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
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
