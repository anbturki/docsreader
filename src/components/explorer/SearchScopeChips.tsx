import { Toggle } from "@/components/ui/toggle";
import { SEARCH_SCOPES, SEARCH_SCOPE_LABELS, type SearchScope } from "@/lib/contentSearch";

interface Props {
  active: SearchScope;
  onChange: (scope: SearchScope) => void;
  id?: string;
}

export function SearchScopeChips({ active, onChange, id }: Props) {
  return (
    <div id={id} role="group" aria-label="Search in" className="flex flex-wrap items-center gap-1">
      {SEARCH_SCOPES.map((scope) => (
        <Toggle
          key={scope}
          size="sm"
          variant="outline"
          pressed={scope === active}
          onPressedChange={() => onChange(scope)}
          className="h-6 rounded-full px-2 text-xs text-muted-foreground data-[state=on]:text-foreground"
        >
          {SEARCH_SCOPE_LABELS[scope]}
        </Toggle>
      ))}
    </div>
  );
}
