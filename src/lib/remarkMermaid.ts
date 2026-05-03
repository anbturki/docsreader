import { visit } from "unist-util-visit";
import type { Root, Code } from "mdast";

export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      if (node.lang !== "mermaid") return;
      node.lang = "text";
      const data = (node.data ??= {});
      const hProps = ((data as { hProperties?: Record<string, unknown> }).hProperties ??=
        {});
      (hProps as Record<string, unknown>)["data-mermaid"] = "true";
    });
  };
}
