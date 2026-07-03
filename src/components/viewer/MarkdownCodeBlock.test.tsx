import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { remarkMermaid } from "@/lib/remarkMermaid";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";
import { SANITIZE_SCHEMA } from "./MarkdownViewer";

vi.mock("./MermaidBlock", () => ({
  MermaidBlock: ({ code }: { code: string }) => (
    <div data-testid="mermaid-block">{code}</div>
  ),
}));
vi.mock("./SvgbobBlock", () => ({
  SvgbobBlock: ({ code }: { code: string }) => (
    <div data-testid="svgbob-block">{code}</div>
  ),
}));

describe("MarkdownCodeBlock", () => {
  it("routes a div flagged data-mermaid to the mermaid renderer", async () => {
    render(
      <MarkdownCodeBlock>
        <div data-mermaid="true">graph TD; A--&gt;B</div>
      </MarkdownCodeBlock>
    );
    expect(await screen.findByTestId("mermaid-block")).toHaveTextContent(
      "graph TD; A-->B"
    );
    expect(screen.queryByRole("button", { name: "Copy code" })).toBeNull();
  });

  it("routes a div flagged data-svgbob to the svgbob renderer", async () => {
    render(
      <MarkdownCodeBlock>
        <div data-svgbob="true">+---+</div>
      </MarkdownCodeBlock>
    );
    expect(await screen.findByTestId("svgbob-block")).toHaveTextContent("+---+");
  });

  it("receives the diagram flag through the full production pipeline", async () => {
    render(
      <ReactMarkdown
        remarkPlugins={[remarkMermaid]}
        rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
        components={{ pre: MarkdownCodeBlock }}
      >
        {"```mermaid\ngraph TD; A-->B\n```"}
      </ReactMarkdown>
    );
    expect(await screen.findByTestId("mermaid-block")).toHaveTextContent(
      "graph TD; A-->B"
    );
  });

  it("renders nothing for an empty diagram fence", () => {
    const { container } = render(
      <MarkdownCodeBlock>
        <div data-mermaid="true"> </div>
      </MarkdownCodeBlock>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders plain code with language label and copy button", () => {
    render(
      <MarkdownCodeBlock>
        <code className="language-rust">fn main() {}</code>
      </MarkdownCodeBlock>
    );
    expect(screen.getByText("rust")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
    expect(screen.queryByTestId("mermaid-block")).toBeNull();
  });
});
