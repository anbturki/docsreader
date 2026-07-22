import type { ContentHit, LineMatch, SearchScope } from "@/lib/contentSearch";
import type { MarkdownFile } from "@/lib/scan";

export interface SearchEntry {
  path: string;
  relPath: string;
  title?: string;
  score: number;
  lines: LineMatch[];
  /** Matching lines in the file, which may exceed `lines.length`. */
  matchedLines: number;
}

/**
 * Merges the instant filename/title/tag matches with the ranked content hits
 * that arrive a moment later. Name matches render immediately at score 0 and
 * are re-ranked in place once the scored hits land, so the list fills in rather
 * than flashing empty.
 *
 * The instant matches are only used when searching everything. They come from a
 * client-side filter over names, paths, titles and tags, which is a superset of
 * any single narrower scope, so seeding them into a narrowed search would list
 * files the scope is meant to exclude.
 */
export function mergeSearchEntries(
  files: MarkdownFile[],
  hits: ContentHit[],
  scope: SearchScope = "all"
): SearchEntry[] {
  const seeded = scope === "all" ? files : [];
  const titles = new Map(files.map((file) => [file.path, file.title]));
  const entries = new Map<string, SearchEntry>();

  for (const file of seeded) {
    entries.set(file.path, {
      path: file.path,
      relPath: file.relPath,
      title: file.title,
      score: 0,
      lines: [],
      matchedLines: 0,
    });
  }

  for (const hit of hits) {
    entries.set(hit.path, {
      path: hit.path,
      relPath: hit.relPath,
      title: titles.get(hit.path),
      score: hit.score,
      lines: hit.lines,
      matchedLines: hit.matchedLines,
    });
  }

  return [...entries.values()].sort(compareEntries);
}

function compareEntries(a: SearchEntry, b: SearchEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  return a.relPath.localeCompare(b.relPath);
}
