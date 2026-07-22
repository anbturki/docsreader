import { useRef } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarHeader } from "@/components/ui/sidebar";
import type { SidebarLens } from "@/lib/storage";
import type { SidebarSearch } from "@/hooks/useSidebarSearch";
import { LENS_META } from "./lenses";
import { SidebarSearchPanel } from "./SidebarSearchPanel";

interface Props {
  lens: SidebarLens;
  search: SidebarSearch;
}

const TASK_PLACEHOLDER = "Search tasks...";
const DOCUMENT_PLACEHOLDER = "Search names, tags, and contents...";

export function ExplorerHeader({ lens, search }: Props) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const scopesEnabled = lens !== "tasks";

  const dismiss = () => {
    search.dismiss();
    toggleRef.current?.focus();
  };

  return (
    <SidebarHeader className="gap-1.5 p-0 pt-1">
      <div className="flex items-center gap-1 px-2">
        <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {LENS_META[lens].label}
        </span>
        <Button
          ref={toggleRef}
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto size-7 text-muted-foreground"
          aria-label={search.open ? "Hide search" : "Search"}
          aria-expanded={search.open}
          onClick={() => (search.open ? dismiss() : search.reveal())}
        >
          <Search />
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
