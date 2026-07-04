import { memo, useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import "katex/dist/katex.min.css";
import { transformerRemoveLineBreak } from "@shikijs/transformers";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

import githubLight from "@shikijs/themes/github-light";
import githubDark from "@shikijs/themes/github-dark";
import vitesseLight from "@shikijs/themes/vitesse-light";
import vitesseDark from "@shikijs/themes/vitesse-dark";
import oneLight from "@shikijs/themes/one-light";
import minLight from "@shikijs/themes/min-light";
import lightPlus from "@shikijs/themes/light-plus";
import oneDarkPro from "@shikijs/themes/one-dark-pro";
import dracula from "@shikijs/themes/dracula";
import monokai from "@shikijs/themes/monokai";
import tokyoNight from "@shikijs/themes/tokyo-night";
import nord from "@shikijs/themes/nord";

import typescript from "@shikijs/langs/typescript";
import javascript from "@shikijs/langs/javascript";
import tsx from "@shikijs/langs/tsx";
import jsx from "@shikijs/langs/jsx";
import bash from "@shikijs/langs/bash";
import shell from "@shikijs/langs/shellscript";
import json from "@shikijs/langs/json";
import jsonc from "@shikijs/langs/jsonc";
import yaml from "@shikijs/langs/yaml";
import toml from "@shikijs/langs/toml";
import markdown from "@shikijs/langs/markdown";
import html from "@shikijs/langs/html";
import css from "@shikijs/langs/css";
import scss from "@shikijs/langs/scss";
import python from "@shikijs/langs/python";
import goLang from "@shikijs/langs/go";
import rust from "@shikijs/langs/rust";
import java from "@shikijs/langs/java";
import sql from "@shikijs/langs/sql";
import diff from "@shikijs/langs/diff";

import type { Pluggable } from "unified";
import { cn } from "@/lib/utils";
import {
  FONT_SIZE_PX,
  type DarkCodeTheme,
  type FontFamily,
  type FontSize,
  type LightCodeTheme,
} from "@/lib/storage";
import { useWebRoot } from "@/hooks/useWebRoot";
import { remarkMermaid } from "@/lib/remarkMermaid";
import { DIAGRAM_FLAGS } from "@/lib/diagramFence";
import { remarkSvgbob } from "@/lib/remarkSvgbob";
import { rehypeTaskList } from "@/lib/rehypeTaskList";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";
import { MarkdownImage } from "./MarkdownImage";
import { MarkdownLink } from "./MarkdownLink";

let highlighterPromise: Promise<HighlighterCore> | undefined;
function getSharedHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        githubLight,
        githubDark,
        vitesseLight,
        vitesseDark,
        oneLight,
        minLight,
        lightPlus,
        oneDarkPro,
        dracula,
        monokai,
        tokyoNight,
        nord,
      ],
      langs: [
        typescript,
        javascript,
        tsx,
        jsx,
        bash,
        shell,
        json,
        jsonc,
        yaml,
        toml,
        markdown,
        html,
        css,
        scss,
        python,
        goLang,
        rust,
        java,
        sql,
        diff,
      ],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    });
  }
  return highlighterPromise;
}

interface Props {
  content: string;
  fontFamily?: FontFamily;
  fontSize?: FontSize;
  codeThemeLight: LightCodeTheme;
  codeThemeDark: DarkCodeTheme;
  currentFilePath?: string;
  rootPath?: string;
  onNavigate?: (absolutePath: string) => void;
  onToggleTask?: (index: number) => void;
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

// GFM task-list checkbox. rehypeTaskList stamps each with dataTaskIndex; when a
// toggle handler is present we make it interactive, otherwise it renders as the
// default (disabled) checkbox.
function TaskCheckbox({
  node,
  onToggleTask,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> &
  ExtraProps & { onToggleTask?: (index: number) => void }) {
  const index = node?.properties?.dataTaskIndex;
  if (typeof index === "number" && onToggleTask) {
    return (
      <input
        type="checkbox"
        checked={rest.checked === true}
        onChange={() => onToggleTask(index)}
        className="cursor-pointer"
      />
    );
  }
  return <input {...rest} />;
}

function useShikiPlugin(
  light: LightCodeTheme,
  dark: DarkCodeTheme
): Pluggable | undefined {
  const [plugin, setPlugin] = useState<Pluggable | undefined>();
  useEffect(() => {
    let cancelled = false;
    getSharedHighlighter().then((highlighter) => {
      if (cancelled) return;
      setPlugin([
        rehypeShikiFromHighlighter,
        highlighter,
        {
          themes: { light, dark },
          defaultColor: false,
          defaultLanguage: "text",
          fallbackLanguage: "text",
          addLanguageClass: true,
          transformers: [transformerRemoveLineBreak()],
        },
      ] as Pluggable);
    });
    return () => {
      cancelled = true;
    };
  }, [light, dark]);
  return plugin;
}

type Components = NonNullable<React.ComponentProps<typeof ReactMarkdown>["components"]>;

interface MemoBodyProps {
  content: string;
  components: Components;
  rehypePlugins: Pluggable[];
}

const REMARK_PLUGINS: Pluggable[] = [remarkGfm, remarkMath, remarkMermaid, remarkSvgbob];

export const SANITIZE_SCHEMA: typeof defaultSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // GFM task-list checkboxes carry their state in `checked`, which the
    // default schema drops; allow it so the rendered checkbox reflects the
    // source (and stays toggleable).
    input: [...(defaultSchema.attributes?.input ?? []), "checked"],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      "className",
      "style",
      "dataLine",
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      "className",
      "style",
      "dataLanguage",
      "dataTheme",
    ],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      "className",
      "style",
      "dataLanguage",
      "dataTheme",
      "tabIndex",
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      "className",
      DIAGRAM_FLAGS.mermaid.hast,
      DIAGRAM_FLAGS.svgbob.hast,
    ],
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id"],
  },
};

const SANITIZE_PLUGIN: Pluggable = [rehypeSanitize, SANITIZE_SCHEMA];

const MemoMarkdownBody = memo(function MemoMarkdownBody({
  content,
  components,
  rehypePlugins,
}: MemoBodyProps) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
});

export function MarkdownViewer({
  content,
  fontFamily = "sans",
  fontSize = "md",
  codeThemeLight,
  codeThemeDark,
  currentFilePath,
  rootPath,
  onNavigate,
  onToggleTask,
}: Props) {
  const webRoot = useWebRoot(rootPath);
  const shikiPlugin = useShikiPlugin(codeThemeLight, codeThemeDark);

  const components = useMemo<Components>(() => {
    const ctx = { currentFilePath, webRoot };
    return {
      img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <MarkdownImage {...props} ctx={ctx} />
      ),
      a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <MarkdownLink {...props} ctx={ctx} onNavigate={onNavigate} />
      ),
      input: (props: React.InputHTMLAttributes<HTMLInputElement> & ExtraProps) => (
        <TaskCheckbox {...props} onToggleTask={onToggleTask} />
      ),
      pre: MarkdownCodeBlock,
    };
  }, [currentFilePath, webRoot, onNavigate, onToggleTask]);

  const rehypePlugins = useMemo<Pluggable[]>(
    () =>
      shikiPlugin
        ? [rehypeRaw, SANITIZE_PLUGIN, rehypeSlug, rehypeKatex, shikiPlugin, rehypeTaskList]
        : [rehypeRaw, SANITIZE_PLUGIN, rehypeSlug, rehypeKatex, rehypeTaskList],
    [shikiPlugin]
  );

  return (
    <div
      style={{ fontSize: `${FONT_SIZE_PX[fontSize]}px` }}
      className={cn(proseClass, familyClass[fontFamily])}
    >
      <MemoMarkdownBody
        content={content}
        components={components}
        rehypePlugins={rehypePlugins}
      />
    </div>
  );
}
