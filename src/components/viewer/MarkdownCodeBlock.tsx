import {
  Children,
  isValidElement,
  lazy,
  Suspense,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIAGRAM_FLAGS } from "@/lib/diagramFence";

const FEEDBACK_MS = 1400;
const HIDDEN_LANGUAGES = new Set(["text", "plaintext", "plain", "txt"]);

const MermaidBlock = lazy(() =>
  import("./MermaidBlock").then((m) => ({ default: m.MermaidBlock }))
);
const SvgbobBlock = lazy(() =>
  import("./SvgbobBlock").then((m) => ({ default: m.SvgbobBlock }))
);

const DIAGRAM_FALLBACK = (
  <div className="my-5 text-xs text-muted-foreground">Loading diagram…</div>
);

export function MarkdownCodeBlock({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const language = extractLanguage(children);
  const isMermaid = hasFlag(children, DIAGRAM_FLAGS.mermaid.attr);
  const isSvgbob = hasFlag(children, DIAGRAM_FLAGS.svgbob.attr);

  if (isMermaid || isSvgbob) {
    const code = isMermaid ? extractText(children).trim() : extractText(children);
    if (!code.trim()) return null;
    return (
      <Suspense fallback={DIAGRAM_FALLBACK}>
        {isMermaid ? <MermaidBlock code={code} /> : <SvgbobBlock code={code} />}
      </Suspense>
    );
  }

  const onCopy = async () => {
    const text = ref.current?.innerText ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), FEEDBACK_MS);
    } catch (err) {
      console.error("copy failed", err);
    }
  };

  return (
    <div className="group relative my-5">
      <pre ref={ref} className={cn("!my-0", className)} {...props}>
        {children}
      </pre>
      <div
        className={cn(
          "absolute right-2 top-2 flex items-center gap-1",
          "opacity-0 transition-opacity",
          "group-hover:opacity-100 focus-within:opacity-100"
        )}
      >
        {language && (
          <span
            className={cn(
              "rounded-md bg-background/80 px-2 py-0.5 text-xs font-mono",
              "text-muted-foreground backdrop-blur"
            )}
          >
            {language}
          </span>
        )}
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Copied" : "Copy code"}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md",
            "bg-background/80 text-muted-foreground backdrop-blur",
            "transition-colors hover:bg-background hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

function hasFlag(children: ReactNode, attr: string): boolean {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const el = child as ReactElement<Record<string, unknown>>;
    if (el.type !== "code" && el.type !== "div") continue;
    if (el.props[attr] === "true") return true;
  }
  return false;
}

function extractLanguage(children: ReactNode): string | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const el = child as ReactElement<{ className?: string }>;
    if (el.type !== "code") continue;
    const cls = el.props.className ?? "";
    const match = cls.match(/language-([\w-]+)/);
    if (!match) continue;
    const lang = match[1];
    if (HIDDEN_LANGUAGES.has(lang)) return undefined;
    return lang;
  }
  return undefined;
}

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode; className?: string }>;
    const inner = extractText(el.props.children);
    return isShikiLineSpan(el) ? inner + "\n" : inner;
  }
  return "";
}

function isShikiLineSpan(el: ReactElement<{ className?: string }>): boolean {
  return (
    el.type === "span" &&
    typeof el.props.className === "string" &&
    el.props.className.split(/\s+/).includes("line")
  );
}
