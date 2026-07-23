import { describe, it, expect } from "vitest";

import { mergeSearchEntries } from "./searchEntries";
import type { ContentHit } from "@/lib/contentSearch";
import type { MarkdownFile } from "@/lib/scan";

function file(relPath: string, title?: string): MarkdownFile {
  return {
    path: `/lib/${relPath}`,
    name: relPath.split("/").pop() ?? relPath,
    relPath,
    title,
    tags: [],
    size: 0,
  };
}

function hit(relPath: string, score: number, lineCount = 1): ContentHit {
  return {
    root: "/lib",
    path: `/lib/${relPath}`,
    relPath,
    score,
    lines: Array.from({ length: lineCount }, (_, i) => ({
      line: i + 1,
      segments: [{ text: "needle", isMatch: true }],
      leadingEllipsis: false,
      trailingEllipsis: false,
    })),
    matchedLines: lineCount,
  };
}

describe("mergeSearchEntries", () => {
  it("shows name matches before any content hits arrive", () => {
    const entries = mergeSearchEntries([file("b.md"), file("a.md")], []);

    expect(entries.map((e) => e.relPath)).toEqual(["a.md", "b.md"]);
    expect(entries.every((e) => e.lines.length === 0)).toBe(true);
  });

  it("ranks content hits above unscored name matches", () => {
    const entries = mergeSearchEntries([file("a.md"), file("z.md")], [hit("z.md", 5)]);

    expect(entries.map((e) => e.relPath)).toEqual(["z.md", "a.md"]);
  });

  it("orders by score descending", () => {
    const entries = mergeSearchEntries([], [hit("low.md", 1), hit("high.md", 9)]);

    expect(entries.map((e) => e.relPath)).toEqual(["high.md", "low.md"]);
  });

  it("breaks score ties by path so ordering is stable", () => {
    const entries = mergeSearchEntries([], [hit("b.md", 3), hit("a.md", 3)]);

    expect(entries.map((e) => e.relPath)).toEqual(["a.md", "b.md"]);
  });

  it("does not list a file twice when it matches by both name and content", () => {
    const entries = mergeSearchEntries([file("a.md")], [hit("a.md", 4)]);

    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBe(4);
    expect(entries[0].lines).toHaveLength(1);
  });

  it("keeps the scanned title on a content hit", () => {
    const entries = mergeSearchEntries([file("a.md", "Alpha Guide")], [hit("a.md", 4)]);

    expect(entries[0].title).toBe("Alpha Guide");
  });

  it("includes a content hit for a file missing from the scan", () => {
    const entries = mergeSearchEntries([], [hit("fresh.md", 2)]);

    expect(entries).toHaveLength(1);
    expect(entries[0].relPath).toBe("fresh.md");
    expect(entries[0].title).toBeUndefined();
  });

  it("carries the uncapped matched-line count", () => {
    const hits = [hit("many.md", 3, 5)];
    hits[0].matchedLines = 12;

    expect(mergeSearchEntries([], hits)[0].matchedLines).toBe(12);
  });

  it("returns nothing for no matches", () => {
    expect(mergeSearchEntries([], [])).toEqual([]);
  });
});

describe("mergeSearchEntries scope", () => {
  it("ignores name matches when searching contents only", () => {
    const entries = mergeSearchEntries([file("gateway-notes.md")], [], "content");

    expect(entries).toEqual([]);
  });

  it("ignores name matches when searching tags only", () => {
    const entries = mergeSearchEntries([file("gateway-notes.md")], [], "tags");

    expect(entries).toEqual([]);
  });

  it("ignores name matches when searching names only, since the backend decides", () => {
    const entries = mergeSearchEntries([file("gateway-notes.md")], [], "names");

    expect(entries).toEqual([]);
  });

  it("still returns backend hits in a narrowed scope", () => {
    const entries = mergeSearchEntries([file("a.md")], [hit("b.md", 3)], "content");

    expect(entries.map((e) => e.relPath)).toEqual(["b.md"]);
  });

  it("keeps instant name matches when searching everything", () => {
    const entries = mergeSearchEntries([file("a.md")], [], "all");

    expect(entries.map((e) => e.relPath)).toEqual(["a.md"]);
  });
});
