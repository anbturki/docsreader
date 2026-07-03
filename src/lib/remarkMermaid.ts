import { visit } from "unist-util-visit";
import type { Root, Code } from "mdast";
import { flagDiagramFence } from "./diagramFence";

export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      if (node.lang !== "mermaid") return;
      flagDiagramFence(node, "mermaid");
    });
  };
}
