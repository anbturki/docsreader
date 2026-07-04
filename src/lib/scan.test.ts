import { describe, it, expect } from "vitest";
import { parseFrontmatter, splitFrontmatter } from "./scan";

describe("splitFrontmatter", () => {
  const cases: Record<string, string> = {
    "with frontmatter": "---\ntitle: Note\n---\n\n# hello\n",
    "without frontmatter": "# hello\n\njust body\n",
    "crlf frontmatter": "---\r\ntitle: Note\r\n---\r\n\r\n# hello\r\n",
    "bom then frontmatter": "﻿---\ntitle: Note\n---\n\n# hello\n",
    "body that contains a --- rule": "# hello\n\n---\n\nmore\n",
    empty: "",
  };

  for (const [name, source] of Object.entries(cases)) {
    it(`reconstructs ${name} byte-for-byte`, () => {
      const { prefix, body } = splitFrontmatter(source);
      expect(prefix + body).toBe(source);
    });
  }

  it("keeps the frontmatter prefix out of the editable body", () => {
    const { prefix, body } = splitFrontmatter("---\ntitle: Note\n---\n\n# hello\n");
    expect(prefix).toBe("---\ntitle: Note\n---\n");
    expect(body).toBe("\n# hello\n");
  });

  it("re-attaching an edited body preserves frontmatter verbatim", () => {
    const source = "---\ntitle: Note\nowner: ali\n---\n\n# hello\n";
    const { prefix } = splitFrontmatter(source);
    const rebuilt = prefix + "\n# hello edited\n";
    expect(parseFrontmatter(rebuilt).data).toEqual({ title: "Note", owner: "ali" });
    expect(parseFrontmatter(rebuilt).content).toBe("\n# hello edited\n");
  });
});
