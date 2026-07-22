import { cn } from "@/lib/utils";
import { SEARCH_SCOPES, SEARCH_SCOPE_LABELS, type SearchScope } from "@/lib/contentSearch";

interface Props {
  active: SearchScope;
  onChange: (scope: SearchScope) => void;
}

export function SearchScopeTabs({ active, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Search in" className="flex items-center gap-1 px-2 pb-2">
      {SEARCH_SCOPES.map((scope) => {
        const isActive = scope === active;
        return (
          <button
            key={scope}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(scope)}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {SEARCH_SCOPE_LABELS[scope]}
          </button>
        );
      })}
    </div>
  );
}
