import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import { FONT_SIZE_PX, type FontFamily, type FontSize } from "@/lib/storage";

interface Props {
  content: string;
  fontFamily?: FontFamily;
  fontSize?: FontSize;
}

const familyClass: Record<FontFamily, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
};

export function MarkdownViewer({ content, fontFamily = "sans", fontSize = "md" }: Props) {
  return (
    <div
      style={{ fontSize: `${FONT_SIZE_PX[fontSize]}px` }}
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none",
        "prose-headings:scroll-mt-16",
        "prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:border prose-pre:border-zinc-800",
        "prose-code:bg-muted prose-code:text-foreground prose-code:rounded-sm prose-code:px-1 prose-code:py-0.5",
        "prose-code:before:hidden prose-code:after:hidden",
        "prose-pre:[&_code]:bg-transparent prose-pre:[&_code]:text-inherit prose-pre:[&_code]:p-0",
        "prose-img:rounded-md",
        "prose-a:text-primary",
        familyClass[fontFamily]
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
