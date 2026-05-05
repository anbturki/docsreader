import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 1);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [roots.length]);

  useLayoutEffect(() => {
    const btn = activeButtonRef.current;
    if (!btn) return;
    btn.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeRoot]);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });
  };

  if (roots.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 px-2 pb-1 pt-2">
      <Button
        size="icon"
        variant="ghost"
        className="size-6 shrink-0 text-muted-foreground disabled:opacity-30"
        onClick={() => scrollBy("left")}
        disabled={!canLeft}
        aria-label="Scroll workspaces left"
        tabIndex={canLeft ? 0 : -1}
      >
        <ChevronLeft />
      </Button>
      <div
        ref={scrollerRef}
        className="no-scrollbar flex flex-1 items-center gap-3 overflow-x-auto scroll-smooth"
      >
        {roots.map((root) => {
          const label = root.split("/").filter(Boolean).pop() || root;
          const active = root === activeRoot;
          return (
            <ContextMenu key={root}>
              <ContextMenuTrigger asChild>
                <button
                  ref={active ? activeButtonRef : undefined}
                  onClick={() => onSelect(root)}
                  title={root}
                  className={cn(
                    "shrink-0 max-w-[10rem] truncate py-1 text-sm",
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
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="size-6 shrink-0 text-muted-foreground disabled:opacity-30"
        onClick={() => scrollBy("right")}
        disabled={!canRight}
        aria-label="Scroll workspaces right"
        tabIndex={canRight ? 0 : -1}
      >
        <ChevronRight />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-6 shrink-0 text-muted-foreground"
        onClick={onAdd}
        title="Add workspace"
        aria-label="Add workspace"
      >
        <Plus />
      </Button>
    </div>
  );
}
