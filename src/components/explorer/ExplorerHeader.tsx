import { useRef } from "react";
import { RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarHeader } from "@/components/ui/sidebar";
import type { SidebarLens } from "@/lib/storage";
import type { SidebarSearch } from "@/hooks/useSidebarSearch";
import { SidebarSearchPanel } from "./SidebarSearchPanel";
import { TaskFilterPopover } from "./TaskFilterPopover";

interface Props {
  lens: SidebarLens;
  search: SidebarSearch;
  scanning: boolean;
  onRefresh: () => void;
}

const TASK_PLACEHOLDER = "Search tasks...";
const DOCUMENT_PLACEHOLDER = "Search names, tags, and contents...";

export function ExplorerHeader({ lens, search, scanning, onRefresh }: Props) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const scopesEnabled = lens !== "tasks";

  const dismiss = () => {
    search.dismiss();
    toggleRef.current?.focus();
  };

  return (
    <SidebarHeader className="gap-1.5 p-0 pt-1">
      {/* Controls only: the rail already names the active lens, and every item
          here is the same height, so the row does not move between lenses. */}
      <div className="flex items-center justify-end gap-1 px-2">
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
        {lens === "tasks" && <TaskFilterPopover />}
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
