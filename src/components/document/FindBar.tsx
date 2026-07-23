import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FindInDocument } from "@/hooks/useFindInDocument";

interface Props {
  find: FindInDocument;
}

export function FindBar({ find }: Props) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.select();
  }, []);

  const hasQuery = find.query.trim().length > 0;

  return (
    <div
      role="search"
      className="flex items-center gap-1 rounded-md border bg-popover p-1 shadow-md"
    >
      <Input
        ref={input}
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) find.previous();
            else find.next();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            find.hide();
          }
        }}
        placeholder="Find in document"
        aria-label="Find in document"
        className="h-7 w-48 border-0 shadow-none focus-visible:ring-0"
      />
      <span
        aria-live="polite"
        className="min-w-16 shrink-0 text-center text-xs tabular-nums text-muted-foreground"
      >
        {matchLabel(hasQuery, find.matchCount, find.currentIndex)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Previous match"
        disabled={find.matchCount === 0}
        onClick={find.previous}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Next match"
        disabled={find.matchCount === 0}
        onClick={find.next}
      >
        <ChevronDown className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Close find"
        onClick={find.hide}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function matchLabel(hasQuery: boolean, matchCount: number, currentIndex: number): string {
  if (!hasQuery) return "";
  if (matchCount === 0) return "No results";
  return `${currentIndex + 1} of ${matchCount}`;
}
