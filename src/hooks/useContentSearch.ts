import { useEffect, useRef, useState } from "react";

import { searchContent, type ContentHit, type SearchScope } from "@/lib/contentSearch";

// Long enough that a typed word issues one search rather than one per letter,
// short enough that results feel attached to the keystroke.
const SEARCH_DEBOUNCE_MS = 200;

export interface ContentSearchState {
  hits: ContentHit[];
  searching: boolean;
  error: string | undefined;
  truncated: boolean;
}

const IDLE: ContentSearchState = {
  hits: [],
  searching: false,
  error: undefined,
  truncated: false,
};

export function useContentSearch(
  root: string | undefined,
  query: string,
  enabled = true,
  scope: SearchScope = "all"
): ContentSearchState {
  const [state, setState] = useState<ContentSearchState>(IDLE);
  // Every request carries a sequence number. A slow earlier search that lands
  // after a newer one must not overwrite the newer results.
  const latestRequest = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || !root || !trimmed) {
      latestRequest.current += 1;
      setState(IDLE);
      return;
    }

    const request = ++latestRequest.current;
    const isStale = () => latestRequest.current !== request;

    setState((prev) => ({ ...prev, searching: true, error: undefined }));

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await searchContent(root, trimmed, scope);
          if (isStale() || result.aborted) return;
          setState({
            hits: result.hits,
            searching: false,
            error: undefined,
            truncated: result.truncated,
          });
        } catch (e) {
          if (isStale()) return;
          setState({
            hits: [],
            searching: false,
            error: e instanceof Error ? e.message : String(e),
            truncated: false,
          });
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [root, query, enabled, scope]);

  return state;
}
