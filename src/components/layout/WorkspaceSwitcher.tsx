import { Check, ChevronsUpDown, FolderPlus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface Props {
  roots: string[];
  activeRoot: string | undefined;
  workspaceNamesByRoot: Record<string, string>;
  onSelect: (path: string) => void;
  onRemove: (path: string) => void;
  onAdd: () => void;
}

interface WorkspaceLabel {
  root: string;
  name: string;
  location: string;
  initial: string;
  title: string;
}

function describeWorkspace(root: string, name: string | undefined): WorkspaceLabel {
  const segments = root.split("/").filter(Boolean);
  const label = name || segments[segments.length - 1] || root;
  const firstCodePoint = label.codePointAt(0);
  return {
    root,
    name: label,
    location: segments.slice(-2).join("/") || root,
    initial: firstCodePoint
      ? String.fromCodePoint(firstCodePoint).toUpperCase()
      : "?",
    title: name ? `${name}\n${root}` : root,
  };
}

function WorkspaceIdentity({ workspace }: { workspace: WorkspaceLabel }) {
  return (
    <>
      <div className="flex aspect-square size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
        {workspace.initial}
      </div>
      <div className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-sm font-medium">{workspace.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {workspace.location}
        </span>
      </div>
    </>
  );
}

export function WorkspaceSwitcher({
  roots,
  activeRoot,
  workspaceNamesByRoot,
  onSelect,
  onRemove,
  onAdd,
}: Props) {
  if (roots.length === 0) return null;

  const workspaces = roots.map((root) =>
    describeWorkspace(root, workspaceNamesByRoot[root])
  );
  const active =
    workspaces.find((workspace) => workspace.root === activeRoot) ?? workspaces[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              title={active.title}
              className="h-auto gap-2 py-1.5 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            >
              <span className="sr-only">Switch workspace</span>
              <WorkspaceIdentity workspace={active} />
              <ChevronsUpDown className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            sideOffset={4}
            className="min-w-64"
          >
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.root}
                title={workspace.title}
                className="gap-2 p-1.5"
                onSelect={() => onSelect(workspace.root)}
              >
                <WorkspaceIdentity workspace={workspace} />
                {workspace.root === activeRoot && (
                  <Check className="ml-auto shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-1.5" onSelect={onAdd}>
              <FolderPlus className="text-muted-foreground" />
              Add workspace
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 p-1.5">
                <Trash2 className="text-muted-foreground" />
                Remove workspace
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="min-w-56">
                  {workspaces.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.root}
                      title={workspace.title}
                      variant="destructive"
                      className="gap-2 p-1.5"
                      onSelect={() => onRemove(workspace.root)}
                    >
                      <WorkspaceIdentity workspace={workspace} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
