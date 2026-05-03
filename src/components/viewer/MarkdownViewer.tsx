import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import { FONT_SIZE_PX, type FontFamily, type FontSize } from "@/lib/storage";
import { useWebRoot } from "@/hooks/useWebRoot";
import { MarkdownImage } from "./MarkdownImage";
import { MarkdownLink } from "./MarkdownLink";

interface Props {
  content: string;
  fontFamily?: FontFamily;
  fontSize?: FontSize;
  currentFilePath?: string;
  rootPath?: string;
  onNavigate?: (absolutePath: string) => void;
}

const familyClass: Record<FontFamily, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
};

const proseClass = cn(
  "prose prose-neutral dark:prose-invert max-w-none",
  "prose-headings:scroll-mt-16",
  "prose-code:bg-muted prose-code:text-foreground prose-code:rounded-sm prose-code:px-1 prose-code:py-0.5",
  "prose-code:before:hidden prose-code:after:hidden",
  "prose-pre:[&_code]:bg-transparent prose-pre:[&_code]:p-0",
  "prose-img:rounded-md",
  "prose-a:text-primary"
);

export function MarkdownViewer({
  content,
  fontFamily = "sans",
  fontSize = "md",
  currentFilePath,
  rootPath,
  onNavigate,
}: Props) {
  const webRoot = useWebRoot(rootPath);

  const components = useMemo(() => {
    const ctx = { currentFilePath, webRoot };
    return {
      img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <MarkdownImage {...props} ctx={ctx} />
      ),
      a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <MarkdownLink {...props} ctx={ctx} onNavigate={onNavigate} />
      ),
    };
  }, [currentFilePath, webRoot, onNavigate]);

  return (
    <div
      style={{ fontSize: `${FONT_SIZE_PX[fontSize]}px` }}
      className={cn(proseClass, familyClass[fontFamily])}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
