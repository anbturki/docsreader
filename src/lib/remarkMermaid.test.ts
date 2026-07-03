import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { SANITIZE_SCHEMA } from "@/components/viewer/MarkdownViewer";
import { remarkMermaid } from "./remarkMermaid";
import { remarkSvgbob } from "./remarkSvgbob";

async function render(md: string) {
  const out = await unified()
    .use(remarkParse)
    .use(remarkMermaid)
    .use(remarkSvgbob)
    .use(remarkRehype)
    .use(rehypeSanitize, SANITIZE_SCHEMA)
    .use(rehypeStringify)
    .process(md);
  return String(out);
}

describe("diagram fences through the production sanitize schema", () => {
  it("mermaid renders as pre > div with the flag, no code child for shiki", async () => {
    const html = await render("```mermaid\nflowchart LR\nA-->B\n```\n");
    expect(html).toContain('data-mermaid="true"');
    expect(html).toContain("<pre><div");
    expect(html).not.toContain("<code");
  });

  it("svgbob renders as pre > div with the flag", async () => {
    const html = await render("```bob\n+---+\n```\n");
    expect(html).toContain('data-svgbob="true"');
    expect(html).not.toContain("<code");
  });

  it("ordinary fences keep their code element and carry no diagram flags", async () => {
    const html = await render("```rust\nfn main() {}\n```\n");
    expect(html).toContain("<code");
    expect(html).not.toContain("data-mermaid");
    expect(html).not.toContain("data-svgbob");
  });
});
