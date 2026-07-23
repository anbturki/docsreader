import { useCallback, useEffect, useMemo, useState } from "react";

import type { SearchScope } from "@/lib/contentSearch";
import { matchShortcut, parseShortcut } from "@/lib/shortcuts";

export interface SidebarSearch {
  open: boolean;
  query: string;
  scope: SearchScope;
  /** Bumped on every reveal so an already-open input takes focus again. */
  focusSignal: number;
  setQuery: (query: string) => void;
  setScope: (scope: SearchScope) => void;
  reveal: (query?: string) => void;
  dismiss: () => void;
}

interface Options {
  shortcut: string;
  onReveal?: () => void;
}

export function useSidebarSearch({ shortcut, onReveal }: Options): SidebarSearch {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [focusSignal, setFocusSignal] = useState(0);

  const reveal = useCallback(
    (next?: string) => {
      setOpen(true);
      if (next !== undefined) setQuery(next);
      setFocusSignal((n) => n + 1);
      onReveal?.();
    },
    [onReveal]
  );

  // Clearing the query on dismiss is what returns the panel to the plain lens
  // view; leaving it set would keep the results up with no way to see them.
  const dismiss = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const parsed = useMemo(() => parseShortcut(shortcut), [shortcut]);
  useEffect(() => {
    if (!parsed) return;
    const onKey = (e: KeyboardEvent) => {
      if (!matchShortcut(e, parsed)) return;
      e.preventDefault();
      reveal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parsed, reveal]);

  return { open, query, scope, focusSignal, setQuery, setScope, reveal, dismiss };
}
