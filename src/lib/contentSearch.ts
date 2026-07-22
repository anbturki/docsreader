import { invoke } from "@tauri-apps/api/core";

/// Mirrors SearchScope in src-tauri/core/src/search.rs; keep the two in step.
export const SEARCH_SCOPES = ["all", "names", "content", "tags"] as const;

export type SearchScope = (typeof SEARCH_SCOPES)[number];

export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  all: "All",
  names: "Files",
  content: "Contents",
  tags: "Tags",
};

export interface SnippetSegment {
  text: string;
  isMatch: boolean;
}

export interface LineMatch {
  line: number;
  segments: SnippetSegment[];
  leadingEllipsis: boolean;
  trailingEllipsis: boolean;
}

export interface ContentHit {
  /** The opened folder this hit came from. */
  root: string;
  path: string;
  relPath: string;
  score: number;
  lines: LineMatch[];
  matchedLines: number;
}

export interface ContentSearchResult {
  hits: ContentHit[];
  aborted: boolean;
  truncated: boolean;
}

const SEARCH_FAILED_MESSAGE =
  "This folder could not be searched. It may have been moved, or it may be on a drive that is no longer available.";

export const EMPTY_CONTENT_SEARCH: ContentSearchResult = {
  hits: [],
  aborted: false,
  truncated: false,
};

export async function searchContent(
  roots: string[],
  query: string,
  scope: SearchScope = "all"
): Promise<ContentSearchResult> {
  if (!query.trim() || roots.length === 0) return EMPTY_CONTENT_SEARCH;
  try {
    return await invoke<ContentSearchResult>("search_content", {
      paths: roots,
      query,
      scope,
    });
  } catch {
    // The backend detail is not useful to a reader; surfacing the folder being
    // unreadable is.
    throw new Error(SEARCH_FAILED_MESSAGE);
  }
}
