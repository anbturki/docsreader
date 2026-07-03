import type { MarkdownFile } from "@/lib/scan";
import { dirname } from "@/lib/path";

export interface BacklinkGroup {
  folder: string;
  sources: MarkdownFile[];
}

export function backlinksFor(files: MarkdownFile[], targetPath: string): MarkdownFile[] {
  const target = files.find((f) => f.path === targetPath);
  if (!target) return [];
  return files.filter(
    (f) => f.path !== targetPath && (f.links?.includes(target.relPath) ?? false)
  );
}

// Files arrive sorted by relPath from the scan, so insertion order keeps
// groups and their members sorted.
export function groupByFolder(sources: MarkdownFile[]): BacklinkGroup[] {
  const groups = new Map<string, MarkdownFile[]>();
  for (const file of sources) {
    const folder = /[/\\]/.test(file.relPath) ? dirname(file.relPath) : "/";
    const group = groups.get(folder);
    if (group) group.push(file);
    else groups.set(folder, [file]);
  }
  return [...groups.entries()].map(([folder, files]) => ({ folder, sources: files }));
}
