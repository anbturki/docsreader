import { invoke } from "@tauri-apps/api/core";

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
  root: string,
  query: string
): Promise<ContentSearchResult> {
  if (!query.trim()) return EMPTY_CONTENT_SEARCH;
  try {
    return await invoke<ContentSearchResult>("search_content", { path: root, query });
  } catch {
    // The backend detail is not useful to a reader; surfacing the folder being
    // unreadable is.
    throw new Error(SEARCH_FAILED_MESSAGE);
  }
}
