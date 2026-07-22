import { useRef } from "react";
import { Maximize2, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarHeader } from "@/components/ui/sidebar";
import type { SidebarLens } from "@/lib/storage";
import { taskCountLabel } from "@/lib/taskFilter";
import type { SidebarSearch } from "@/hooks/useSidebarSearch";
import { SidebarSearchPanel } from "./SidebarSearchPanel";
import { TaskFilterPopover } from "./TaskFilterPopover";
import { useTaskFilter } from "./TaskFilterContext";

interface Props {
  lens: SidebarLens;
  search: SidebarSearch;
  scanning: boolean;
  onRefresh: () => void;
  onOpenTasksTab: () => void;
}

const TASK_PLACEHOLDER = "Search tasks...";
const DOCUMENT_PLACEHOLDER = "Search names, tags, and contents...";

export function ExplorerHeader({
  lens,
  search,
  scanning,
  onRefresh,
  onOpenTasksTab,
}: Props) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const scopesEnabled = lens !== "tasks";

  const dismiss = () => {
    search.dismiss();
    toggleRef.current?.focus();
  };

  return (
    <SidebarHeader className="gap-1.5 p-0 pt-1">
      {/* The rail already names the active lens, so the only text here is a
          count the lens publishes. Every item is the same height, so the row
          does not move between lenses. */}
      <div className="flex items-center justify-end gap-1 px-2">
        <TaskCountLabel active={lens === "tasks"} />
        <Button
          ref={toggleRef}
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground"
          aria-label={search.open ? "Hide search" : "Search"}
          aria-expanded={search.open}
          onClick={() => (search.open ? dismiss() : search.reveal())}
        >
          <Search />
        </Button>
        {lens === "tasks" && (
          <>
            <TaskFilterPopover />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground"
              aria-label="Open tasks in the main area"
              title="Open tasks in the main area"
              onClick={onOpenTasksTab}
            >
              <Maximize2 />
            </Button>
          </>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground"
          aria-label="Refresh workspace"
          disabled={scanning}
          onClick={onRefresh}
        >
          <RefreshCw className={scanning ? "animate-spin" : undefined} />
        </Button>
      </div>
      {search.open && (
        <SidebarSearchPanel
          query={search.query}
          onQueryChange={search.setQuery}
          scope={search.scope}
          onScopeChange={search.setScope}
          scopesEnabled={scopesEnabled}
          placeholder={scopesEnabled ? DOCUMENT_PLACEHOLDER : TASK_PLACEHOLDER}
          focusSignal={search.focusSignal}
          onDismiss={dismiss}
        />
      )}
    </SidebarHeader>
  );
}

// `mr-auto` rather than a wrapper: the row is right-aligned, so the count
// pushes itself to the left edge and the controls stay put when it is absent.
function TaskCountLabel({ active }: { active: boolean }) {
  const { count } = useTaskFilter();
  if (!active || !count) return null;
  return (
    <span className="mr-auto truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {taskCountLabel(count.shown, count.total)}
    </span>
  );
}
