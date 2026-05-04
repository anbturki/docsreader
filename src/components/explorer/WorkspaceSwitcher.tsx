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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-1 pt-2">
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
                  "max-w-[12rem] truncate py-1 text-sm",
                  active
                    ? "font-semibold text-foreground"
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
        className="size-6 text-muted-foreground"
        onClick={onAdd}
        title="Add workspace"
        aria-label="Add workspace"
      >
        <Plus />
      </Button>
    </div>
  );
}
