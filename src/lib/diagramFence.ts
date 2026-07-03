import type { Code } from "mdast";

export const DIAGRAM_FLAGS = {
  mermaid: { hast: "dataMermaid", attr: "data-mermaid" },
  svgbob: { hast: "dataSvgbob", attr: "data-svgbob" },
} as const;

export type DiagramKind = keyof typeof DIAGRAM_FLAGS;

// Rendered as pre > div[data-*] instead of pre > code: shiki only rewrites
// pre > code blocks, so the div carries the flag through the sanitize +
// highlight pipeline untouched for MarkdownCodeBlock to detect.
export function flagDiagramFence(node: Code, kind: DiagramKind): void {
  const data = (node.data ??= {}) as {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
  data.hName = "div";
  (data.hProperties ??= {})[DIAGRAM_FLAGS[kind].hast] = "true";
}
