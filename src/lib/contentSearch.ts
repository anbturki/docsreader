import { invoke } from "@tauri-apps/api/core";

// Mirrors SearchScope in src-tauri/core/src/search.rs; keep the two in step.
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
  /** Folders that could not be read at all, so nothing was searched in them. */
  failedRoots: string[];
}

export const SEARCH_FAILED_MESSAGE =
  "This folder could not be searched. It may have been moved, or it may be on a drive that is no longer available.";

export const EMPTY_CONTENT_SEARCH: ContentSearchResult = {
  hits: [],
  aborted: false,
  truncated: false,
  failedRoots: [],
};

/**
 * `surface` scopes cancellation: the backend only supersedes an in-flight
 * search from the same surface, so two open search boxes do not abandon each
 * other's requests.
 */
export async function searchContent(
  roots: string[],
  query: string,
  scope: SearchScope,
  surface: string
): Promise<ContentSearchResult> {
  if (!query.trim() || roots.length === 0) return EMPTY_CONTENT_SEARCH;
  try {
    return await invoke<ContentSearchResult>("search_content", {
      paths: roots,
      query,
      scope,
      surface,
    });
  } catch {
    // The backend detail is not useful to a reader; surfacing the folder being
    // unreadable is.
    throw new Error(SEARCH_FAILED_MESSAGE);
  }
}
