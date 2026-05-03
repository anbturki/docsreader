import GithubSlugger from "github-slugger";

export interface OutlineHeading {
  id: string;
  level: number;
  text: string;
}

export function extractOutline(content: string): OutlineHeading[] {
  const stripped = stripCodeFences(content);
  const lines = stripped.split(/\r?\n/);
  const slugger = new GithubSlugger();
  const out: OutlineHeading[] = [];
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/`([^`]+)`/g, "$1").trim();
    if (!text) continue;
    out.push({ id: slugger.slug(text), level, text });
  }
  return out;
}

function stripCodeFences(content: string): string {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];
  let inFence = false;
  let fence = "";
  for (const line of lines) {
    const fenceMatch = /^(\s*)(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[2];
      if (!inFence) {
        inFence = true;
        fence = marker;
      } else if (line.trim().startsWith(fence)) {
        inFence = false;
        fence = "";
      }
      result.push("");
      continue;
    }
    result.push(inFence ? "" : line);
  }
  return result.join("\n");
}
