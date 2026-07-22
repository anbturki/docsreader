import { useEffect, useId, useRef, useState } from "react";

import {
  searchContent,
  SEARCH_FAILED_MESSAGE,
  type ContentHit,
  type ContentSearchResult,
  type SearchScope,
} from "@/lib/contentSearch";

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
  roots: readonly string[],
  query: string,
  enabled = true,
  scope: SearchScope = "all"
): ContentSearchState {
  const [state, setState] = useState<ContentSearchState>(IDLE);
  // Callers rebuild the array each render, so identity cannot drive the effect.
  const rootsKey = roots.join("\u0000");
  // Every request carries a sequence number. A slow earlier search that lands
  // after a newer one must not overwrite the newer results.
  const latestRequest = useRef(0);
  // Cancellation is scoped to this hook instance, so a second search box on
  // screen does not abandon this one's in-flight request.
  const surface = useId();

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || roots.length === 0 || !trimmed) {
      latestRequest.current += 1;
      setState(IDLE);
      return;
    }

    const request = ++latestRequest.current;
    const isStale = () => latestRequest.current !== request;
    const rootCount = roots.length;

    setState((prev) => ({ ...prev, searching: true, error: undefined }));

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await searchContent([...roots], trimmed, scope, surface);
          if (isStale()) return;
          // An abandoned request keeps whatever is on screen, but the progress
          // indicator has to stop: no further result is coming for it.
          if (result.aborted) {
            setState((prev) => ({ ...prev, searching: false }));
            return;
          }
          setState({
            hits: result.hits,
            searching: false,
            error: everyRootFailed(result, rootCount) ? SEARCH_FAILED_MESSAGE : undefined,
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
  }, [rootsKey, query, enabled, scope, surface]);

  return state;
}

// A folder that failed alongside folders that matched stays quiet: hiding real
// hits behind an error costs the reader more than the missing folder does.
function everyRootFailed(result: ContentSearchResult, rootCount: number): boolean {
  return result.failedRoots.length > 0 && result.failedRoots.length >= rootCount;
}
