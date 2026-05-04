import { cn } from "@/lib/utils";
import type { SidebarLens } from "@/lib/storage";

const LENSES: Array<{ value: SidebarLens; label: string }> = [
  { value: "tree", label: "Tree" },
  { value: "recent", label: "Recent" },
  { value: "tags", label: "Tags" },
  { value: "pinned", label: "Pinned" },
];

interface Props {
  active: SidebarLens;
  onChange: (lens: SidebarLens) => void;
}

export function LensTabs({ active, onChange }: Props) {
  return (
    <div role="tablist" className="flex items-center gap-3 px-3 pt-1 text-sm">
      {LENSES.map((l) => {
        const isActive = active === l.value;
        return (
          <button
            key={l.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(l.value)}
            className={cn(
              "border-b-2 py-1.5 transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
