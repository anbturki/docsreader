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
import { WORKSPACE_DIR_NAME } from "@/lib/workspace";

// cursor-pointer replaces the cursor-default that DropdownMenuItem and
// DropdownMenuSubTrigger set for native-menu feel; cn() is tailwind-merge, so the
// base class drops out rather than competing.
const MENU_ROW = "cursor-pointer gap-2 p-1.5";

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

// Managed workspaces all live at <project>/notes, so the last segment names every
// one of them identically and the project above it is the distinguishing part.
function fallbackLabel(segments: string[]): string | undefined {
  const last = segments[segments.length - 1];
  if (last !== WORKSPACE_DIR_NAME) return last;
  return segments[segments.length - 2] ?? last;
}

function describeWorkspace(root: string, name: string | undefined): WorkspaceLabel {
  const segments = root.split("/").filter(Boolean);
  const label = name || fallbackLabel(segments) || root;
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

// DropdownMenuItem forces text-accent-foreground onto every descendant while
// focused, so the badge must stay legible under that colour rather than rely on
// a foreground of its own.
function WorkspaceBadge({ workspace }: { workspace: WorkspaceLabel }) {
  return (
    <div
      data-slot="workspace-badge"
      className="flex aspect-square size-5 shrink-0 items-center justify-center rounded-md border bg-background text-[10px] font-semibold text-foreground"
    >
      {workspace.initial}
    </div>
  );
}

function WorkspaceIdentity({ workspace }: { workspace: WorkspaceLabel }) {
  return (
    <>
      <WorkspaceBadge workspace={workspace} />
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
              title={active.title}
              className="h-7 gap-2 rounded-md border bg-muted/40 px-1.5 py-1 hover:bg-muted hover:text-foreground data-open:bg-muted data-open:text-foreground data-open:hover:bg-muted data-open:hover:text-foreground"
            >
              <span className="sr-only">Switch workspace</span>
              <WorkspaceBadge workspace={active} />
              <span className="truncate text-sm font-medium">{active.name}</span>
              <ChevronsUpDown className="ml-auto shrink-0 text-muted-foreground" />
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
                className={MENU_ROW}
                onSelect={() => onSelect(workspace.root)}
              >
                <WorkspaceIdentity workspace={workspace} />
                {workspace.root === activeRoot && (
                  <Check className="ml-auto shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className={MENU_ROW} onSelect={onAdd}>
              <FolderPlus className="text-muted-foreground" />
              Add workspace
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={MENU_ROW}>
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
                      className={MENU_ROW}
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
