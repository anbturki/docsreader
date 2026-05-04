import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface Props {
  roots: string[];
  activeRoot: string | undefined;
  onSelect: (path: string) => void;
  onRemove: (path: string) => void;
  onAdd: () => void;
}

export function WorkspaceSwitcher({ roots, activeRoot, onSelect, onRemove, onAdd }: Props) {
  if (roots.length === 0) return null;
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-2 pb-1 pt-2">
      {roots.map((root) => {
        const label = root.split("/").filter(Boolean).pop() || root;
        const active = root === activeRoot;
        return (
          <ContextMenu key={root}>
            <ContextMenuTrigger asChild>
              <button
                onClick={() => onSelect(root)}
                title={root}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-sm transition-colors",
                  "border-b-2 border-transparent",
                  active
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onRemove(root)}>
                <X />
                Remove workspace
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      <Button
        size="icon"
        variant="ghost"
        className="size-7 shrink-0 text-muted-foreground"
        onClick={onAdd}
        title="Add workspace"
        aria-label="Add workspace"
      >
        <Plus />
      </Button>
    </div>
  );
}
