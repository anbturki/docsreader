import picomatch from "picomatch";

export interface HideMatcher {
  matchesPath: (relPath: string) => boolean;
  empty: boolean;
}

export function buildHideMatcher(patterns: string[]): HideMatcher {
  const cleaned = patterns.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length === 0) return { matchesPath: () => false, empty: true };

  const fullPathPatterns: string[] = [];
  const basenamePatterns: string[] = [];
  for (const p of cleaned) {
    if (p.includes("/")) fullPathPatterns.push(p);
    else basenamePatterns.push(p);
  }

  const fullMatcher = fullPathPatterns.length
    ? picomatch(fullPathPatterns, { dot: true })
    : null;
  const baseMatcher = basenamePatterns.length
    ? picomatch(basenamePatterns, { dot: true, basename: true })
    : null;

  return {
    matchesPath: (relPath) => {
      const segments = relPath.split("/").filter(Boolean);
      if (baseMatcher) {
        for (const seg of segments) if (baseMatcher(seg)) return true;
      }
      if (fullMatcher && fullMatcher(relPath)) return true;
      return false;
    },
    empty: false,
  };
}
