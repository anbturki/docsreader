import { ChevronDown, ChevronRight, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { basename } from "@/lib/path";
import type { SearchEntry } from "@/lib/searchEntries";
import { EntryContextMenu } from "./EntryContextMenu";
import { SearchSnippet } from "./SearchSnippet";
import { SIDEBAR_ROW, sidebarRowState, fileOpenHandlers } from "./sidebarRow";

interface Props {
  entry: SearchEntry;
  expanded: boolean;
  selected: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  pinned: boolean;
  onTogglePin: (path: string) => void;
}

export function SearchResultGroup({
  entry,
  expanded,
  selected,
  onToggle,
  onSelect,
  onOpenInNewTab,
  onOpenInOtherPane,
  pinned,
  onTogglePin,
}: Props) {
  const hasLines = entry.lines.length > 0;
  const Chevron = expanded ? ChevronDown : ChevronRight;

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
        <div className={cn(SIDEBAR_ROW, "px-2", sidebarRowState(selected))}>
          {hasLines ? (
            <button
              type="button"
              aria-label={expanded ? "Collapse matches" : "Expand matches"}
              aria-expanded={expanded}
              onClick={() => onToggle(entry.path)}
              className="shrink-0 rounded-sm p-0.5 hover:bg-sidebar-accent"
            >
              <Chevron className="size-3.5 text-muted-foreground" />
            </button>
          ) : (
            <span className="size-3.5 shrink-0" />
          )}
          <button
            {...fileOpenHandlers(entry.path, onSelect, onOpenInNewTab)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            title={entry.relPath}
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{entry.title || basename(entry.relPath)}</span>
          </button>
          {entry.matchedLines > 0 && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
              {entry.matchedLines}
            </span>
          )}
        </div>
      </EntryContextMenu>

      {expanded && hasLines && (
        <ul className="pl-7 pr-2">
          {entry.lines.map((line) => (
            <li key={line.line}>
              <button
                {...fileOpenHandlers(entry.path, onSelect, onOpenInNewTab)}
                className="w-full rounded-sm py-0.5 text-left hover:bg-sidebar-accent/50"
              >
                <SearchSnippet match={line} />
              </button>
            </li>
          ))}
          {entry.matchedLines > entry.lines.length && (
            <li className="py-0.5 pl-6 text-xs text-muted-foreground/70">
              {entry.matchedLines - entry.lines.length} more
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
