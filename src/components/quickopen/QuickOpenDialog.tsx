import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { MarkdownFile } from "@/lib/scan";
import { useContentSearch } from "@/hooks/useContentSearch";
import { SearchSnippet } from "@/components/explorer/SearchSnippet";

export interface QuickOpenFile extends MarkdownFile {
  rootPath: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: QuickOpenFile[];
  roots: string[];
  onSelect: (path: string, openInNew: boolean) => void;
}

export default function QuickOpenDialog({
  open,
  onOpenChange,
  files,
  roots,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const ranked = useMemo(
    () => rankFiles(files, deferredQuery),
    [files, deferredQuery]
  );

  // Name ranking above stays synchronous so the list never lags a keystroke;
  // matches from inside documents land a moment later in their own group.
  const contentSearch = useContentSearch(roots, query, open);
  const contentHits = useMemo(() => {
    const alreadyListed = new Set(ranked.map((file) => file.path));
    return contentSearch.hits.filter(
      (hit) => hit.lines.length > 0 && !alreadyListed.has(hit.path)
    );
  }, [contentSearch.hits, ranked]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick open"
      description="Search files across all open libraries."
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search files and contents..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No matching files.</CommandEmpty>
          <CommandGroup heading="Files">
            {ranked.map((file) => (
              <CommandItem
                key={file.path}
                value={file.path}
                onSelect={() => {
                  onSelect(file.path, false);
                  onOpenChange(false);
                }}
              >
                <FileText className="text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{file.title || file.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{file.relPath}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          {contentHits.length > 0 && (
            <CommandGroup heading="In documents">
              {contentHits.map((hit) => (
                <CommandItem
                  key={hit.path}
                  value={`content:${hit.path}`}
                  onSelect={() => {
                    onSelect(hit.path, false);
                    onOpenChange(false);
                  }}
                >
                  <FileText className="text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">{hit.relPath}</span>
                    <SearchSnippet match={hit.lines[0]} />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function rankFiles(files: QuickOpenFile[], query: string): QuickOpenFile[] {
  const q = query.trim().toLowerCase();
  if (!q) return files.slice(0, 30);
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: { file: QuickOpenFile; score: number }[] = [];
  for (const file of files) {
    const score = scoreFile(file, tokens);
    if (score > 0) scored.push({ file, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 100).map((s) => s.file);
}

function scoreFile(file: QuickOpenFile, tokens: string[]): number {
  const name = file.name.toLowerCase();
  const title = (file.title ?? "").toLowerCase();
  const rel = file.relPath.toLowerCase();
  let total = 0;
  for (const t of tokens) {
    let best = 0;
    if (name === t) best = 100;
    else if (name.startsWith(t)) best = 60;
    else if (name.includes(t)) best = 30;
    if (title.includes(t)) best = Math.max(best, 25);
    if (rel.includes(t)) best = Math.max(best, 10);
    if (best === 0) return 0;
    total += best;
  }
  return total;
}
