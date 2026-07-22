import { useEffect, useId, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SearchScope } from "@/lib/contentSearch";
import { SearchInput } from "./SearchInput";
import { SearchScopeChips } from "./SearchScopeChips";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  scopesEnabled: boolean;
  placeholder: string;
  focusSignal: number;
  onDismiss: () => void;
}

export function SidebarSearchPanel({
  query,
  onQueryChange,
  scope,
  onScopeChange,
  scopesEnabled,
  placeholder,
  focusSignal,
  onDismiss,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chipsId = useId();
  const [chipsOpen, setChipsOpen] = useState(scope !== "all");

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusSignal]);

  return (
    <div role="search" aria-label="Search workspace" className="flex flex-col gap-1.5 px-2 pb-2">
      <div className="flex items-center gap-1">
        <SearchInput
          ref={inputRef}
          className="min-w-0 flex-1"
          value={query}
          onChange={onQueryChange}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onDismiss();
            }
          }}
        />
        {scopesEnabled && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Filter results"
            aria-expanded={chipsOpen}
            aria-controls={chipsId}
            onClick={() => setChipsOpen((open) => !open)}
          >
            <SlidersHorizontal />
          </Button>
        )}
      </div>
      {scopesEnabled && chipsOpen && (
        <SearchScopeChips id={chipsId} active={scope} onChange={onScopeChange} />
      )}
    </div>
  );
}
