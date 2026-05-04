import { visit } from "unist-util-visit";
import type { Root, Code } from "mdast";

const LANGS = new Set(["bob", "svgbob"]);

export function remarkSvgbob() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      if (!node.lang || !LANGS.has(node.lang)) return;
      node.lang = "text";
      const data = (node.data ??= {});
      const hProps = ((data as { hProperties?: Record<string, unknown> }).hProperties ??=
        {});
      (hProps as Record<string, unknown>)["data-svgbob"] = "true";
    });
  };
}
