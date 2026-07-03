import { buildTree } from "./tree";
import type { MarkdownFile } from "./scan";

function file(relPath: string): MarkdownFile {
  return {
    path: `/ws/${relPath}`,
    name: relPath.split("/").pop() ?? relPath,
    relPath,
    tags: [],
    size: 1,
  };
}

describe("buildTree", () => {
  it("nests files under their folders with dirs sorted first", () => {
    const tree = buildTree("/ws", [
      file("zeta.md"),
      file("research/plan.md"),
      file("research/api-notes.md"),
    ]);

    expect(tree.name).toBe("ws");
    expect(tree.children.map((c) => c.name)).toEqual(["research", "zeta"]);
    const research = tree.children[0];
    expect(research.isDir).toBe(true);
    expect(research.children.map((c) => c.name)).toEqual(["api-notes", "plan"]);
  });

  it("compacts single-child folder chains into one segmented node", () => {
    const tree = buildTree("/ws", [file("a/b/c/deep.md")]);

    const merged = tree.children[0];
    expect(merged.name).toBe("a / b / c");
    expect(merged.segments).toEqual(["a", "b", "c"]);
    expect(merged.children.map((c) => c.name)).toEqual(["deep"]);
  });
});
