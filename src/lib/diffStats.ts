import { diffLines, type Change } from "diff";

export interface DiffStats {
  added: number;
  removed: number;
}

export function computeDiffStats(before: string, after: string): DiffStats {
  const changes = diffLines(before, after);
  let added = 0;
  let removed = 0;
  for (const change of changes) {
    const lineCount = change.count ?? 0;
    if (change.added) added += lineCount;
    else if (change.removed) removed += lineCount;
  }
  return { added, removed };
}

export function computeDiffChanges(before: string, after: string): Change[] {
  return diffLines(before, after);
}
