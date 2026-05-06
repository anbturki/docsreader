import { diffLines, diffWordsWithSpace, type Change } from "diff";

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

export interface WordSegment {
  text: string;
  changed: boolean;
}

// Word-level diff between two single lines. Returned arrays describe
// the removed and added lines as a sequence of segments where
// `changed` segments are the parts that actually differ.
export function diffSingleLine(
  before: string,
  after: string
): { removed: WordSegment[]; added: WordSegment[] } {
  const wordChanges = diffWordsWithSpace(before, after);
  const removed: WordSegment[] = [];
  const added: WordSegment[] = [];
  for (const change of wordChanges) {
    if (change.added) {
      added.push({ text: change.value, changed: true });
    } else if (change.removed) {
      removed.push({ text: change.value, changed: true });
    } else {
      removed.push({ text: change.value, changed: false });
      added.push({ text: change.value, changed: false });
    }
  }
  return { removed, added };
}
