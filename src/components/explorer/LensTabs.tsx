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
    // The lens count has outgrown one row at the default sidebar width, so the
    // row wraps. Without this the last tab rendered outside the sidebar and
    // over the document; clipping it instead would hide a primary entry point.
    <div
      role="tablist"
      className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b border-border px-2.5 text-[13px]"
    >
      {SIDEBAR_LENSES.map((value) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(value)}
            className={cn(
              "-mb-px shrink-0 border-b-2 py-1.5 transition-colors",
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
