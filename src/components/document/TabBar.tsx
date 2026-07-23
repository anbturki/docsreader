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
  // The strip scrolls sideways only. Left alone, setting one axis makes the
  // browser compute the other to auto as well, and a stray pixel of height
  // paints a vertical scrollbar over the tab titles.
  return (
    <div className="flex shrink-0 items-center overflow-x-auto overflow-y-hidden border-b bg-background/40">
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
        "group -mb-px flex h-7 min-w-0 max-w-[200px] shrink-0 items-center gap-1.5 border-r border-b-2 px-2.5 text-xs",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-b-primary font-medium text-foreground"
          : "border-b-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="truncate">{tab.title}</span>
      {tab.pendingContent && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-[var(--status-warning-fg)]"
          aria-label="External change pending"
          title="This file changed on disk - click to review"
        />
      )}
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
