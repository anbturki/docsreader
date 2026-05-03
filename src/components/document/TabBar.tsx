import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tab } from "@/hooks/useTabs";

interface Props {
  tabs: Tab[];
  activeId: string | undefined;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}

export function TabBar({ tabs, activeId, onActivate, onClose }: Props) {
  if (tabs.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center overflow-x-auto border-b bg-background/40">
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          active={tab.id === activeId}
          onActivate={() => onActivate(tab.id)}
          onClose={() => onClose(tab.id)}
        />
      ))}
    </div>
  );
}

function TabItem({
  tab,
  active,
  onActivate,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      className={cn(
        "group flex h-9 min-w-0 max-w-[220px] shrink-0 items-center gap-2 border-r px-3 text-sm",
        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <span className="truncate">{tab.title}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close tab"
        className={cn(
          "ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded",
          "opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100",
          active && "opacity-70"
        )}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
