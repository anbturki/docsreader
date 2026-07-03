import { visit } from "unist-util-visit";
import type { Root, Code } from "mdast";
import { flagDiagramFence } from "./diagramFence";

const LANGS = new Set(["bob", "svgbob"]);

export function remarkSvgbob() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      if (!node.lang || !LANGS.has(node.lang)) return;
      flagDiagramFence(node, "svgbob");
    });
  };
}
