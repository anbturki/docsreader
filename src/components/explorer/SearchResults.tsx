import { useEffect, useState } from "react";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { SearchScope } from "@/lib/contentSearch";
import type { SearchEntry } from "@/lib/searchEntries";
import { SearchResultGroup } from "./SearchResultGroup";
import { SearchScopeTabs } from "./SearchScopeTabs";

interface Props {
  query: string;
  entries: SearchEntry[];
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  searching: boolean;
  error: string | undefined;
  truncated: boolean;
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  isPinned: (path: string) => boolean;
  onTogglePin: (path: string) => void;
}

export function SearchResults({
  query,
  entries,
  scope,
  onScopeChange,
  searching,
  error,
  truncated,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  isPinned,
  onTogglePin,
}: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  // Groups start open, matching how the results read as one list. A new query
  // is a new result set, so previous collapse choices no longer apply.
  useEffect(() => {
    setCollapsed(new Set());
  }, [query, scope]);

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchScopeTabs active={scope} onChange={onScopeChange} />
      <Body
        query={query}
        entries={entries}
        searching={searching}
        error={error}
        truncated={truncated}
        collapsed={collapsed}
        onToggle={toggle}
        selectedPath={selectedPath}
        onSelect={onSelect}
        onOpenInNewTab={onOpenInNewTab}
        onOpenInOtherPane={onOpenInOtherPane}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
      />
    </div>
  );
}

interface BodyProps extends Omit<Props, "scope" | "onScopeChange"> {
  collapsed: ReadonlySet<string>;
  onToggle: (path: string) => void;
}

function Body({
  query,
  entries,
  searching,
  error,
  truncated,
  collapsed,
  onToggle,
  selectedPath,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  isPinned,
  onTogglePin,
}: BodyProps) {
  if (error) {
    return (
      <Empty className="my-auto">
        <EmptyHeader>
          <EmptyTitle>Search unavailable</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!query.trim()) {
    return (
      <Empty className="my-auto">
        <EmptyHeader>
          <EmptyTitle>Search this workspace</EmptyTitle>
          <EmptyDescription>
            Type above to search file names, tags, and the text inside your documents.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (entries.length === 0) {
    return (
      <Empty className="my-auto">
        <EmptyHeader>
          <EmptyTitle>{searching ? "Searching…" : "No matches"}</EmptyTitle>
          {!searching && <EmptyDescription>Nothing matched {query}.</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col py-1">
      <ul>
        {entries.map((entry) => (
          <SearchResultGroup
            key={entry.path}
            entry={entry}
            expanded={!collapsed.has(entry.path)}
            selected={entry.path === selectedPath}
            onToggle={onToggle}
            onSelect={onSelect}
            onOpenInNewTab={onOpenInNewTab}
            onOpenInOtherPane={onOpenInOtherPane}
            pinned={isPinned(entry.path)}
            onTogglePin={onTogglePin}
          />
        ))}
      </ul>
      {searching && (
        <span className="animate-pulse px-3 py-2 text-xs text-muted-foreground">
          Searching contents…
        </span>
      )}
      {truncated && (
        <span className="px-3 py-2 text-xs text-muted-foreground">
          This folder is too large to search completely.
        </span>
      )}
    </div>
  );
}
