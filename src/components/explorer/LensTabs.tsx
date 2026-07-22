import { cn } from "@/lib/utils";
import { SIDEBAR_LENSES, type SidebarLens } from "@/lib/storage";

const LENS_LABELS: Record<SidebarLens, string> = {
  tree: "Tree",
  recent: "Recent",
  tags: "Tags",
  pinned: "Pinned",
  tasks: "Tasks",
  search: "Search",
};

interface Props {
  active: SidebarLens;
  onChange: (lens: SidebarLens) => void;
}

export function LensTabs({ active, onChange }: Props) {
  return (
    <div role="tablist" className="flex items-center gap-3 border-b border-border px-3 text-sm">
      {SIDEBAR_LENSES.map((value) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(value)}
            className={cn(
              "-mb-px border-b-2 py-1.5 transition-colors",
              isActive
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {LENS_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
