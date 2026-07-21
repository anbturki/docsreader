import { FileText } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { SearchEntry } from "@/lib/searchEntries";
import { basename } from "@/lib/path";
import { EntryContextMenu } from "./EntryContextMenu";
import { SearchSnippet } from "./SearchSnippet";
import { SIDEBAR_ROW, sidebarRowState, fileOpenHandlers } from "./sidebarRow";

interface Props {
  entries: SearchEntry[];
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
  entries,
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

  if (entries.length === 0) {
    return (
      <Empty className="my-auto">
        <EmptyHeader>
          <EmptyTitle>{searching ? "Searching…" : "No matches"}</EmptyTitle>
          {!searching && (
            <EmptyDescription>
              Nothing matched in file names, titles, tags, or document contents.
            </EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col py-2">
      <ul>
        {entries.map((entry) => (
          <SearchResultRow
            key={entry.path}
            entry={entry}
            selected={entry.path === selectedPath}
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

interface RowProps {
  entry: SearchEntry;
  selected: boolean;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  pinned: boolean;
  onTogglePin: (path: string) => void;
}

function SearchResultRow({
  entry,
  selected,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  pinned,
  onTogglePin,
}: RowProps) {
  const remaining = entry.matchedLines - entry.lines.length;

  return (
    <li>
      <EntryContextMenu
        path={entry.path}
        isFile
        onOpenInNewTab={onOpenInNewTab}
        onOpenInOtherPane={onOpenInOtherPane}
        pinned={pinned}
        onTogglePin={onTogglePin}
      >
        <button
          {...fileOpenHandlers(entry.path, onSelect, onOpenInNewTab)}
          className={cn(
            SIDEBAR_ROW,
            "flex-col items-stretch gap-1 px-3",
            sidebarRowState(selected)
          )}
          title={entry.relPath}
        >
          <span className="flex w-full items-center gap-1.5">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{entry.title || basename(entry.relPath)}</span>
          </span>
          {entry.lines.length > 0 && (
            <span className="flex flex-col gap-0.5 pl-5">
              {entry.lines.map((line) => (
                <SearchSnippet key={line.line} match={line} />
              ))}
              {remaining > 0 && (
                <span className="text-xs text-muted-foreground/70">
                  {remaining} more {remaining === 1 ? "line" : "lines"}
                </span>
              )}
            </span>
          )}
        </button>
      </EntryContextMenu>
    </li>
  );
}
