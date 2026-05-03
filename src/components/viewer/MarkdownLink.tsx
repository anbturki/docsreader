import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toAbsolutePath, type ResolveContext } from "./resolveAssetSrc";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ctx: ResolveContext;
  onNavigate?: (absolutePath: string) => void;
};

const EXTERNAL_SCHEME = /^(https?|mailto|tel):/i;
const HAS_SCHEME = /^[a-z]+:/i;
const MARKDOWN_EXT = /\.mdx?$/i;

export function MarkdownLink({ href, children, ctx, onNavigate, ...rest }: Props) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!href || href.startsWith("#")) return;
    event.preventDefault();

    if (EXTERNAL_SCHEME.test(href)) {
      void openUrl(href);
      return;
    }

    if (HAS_SCHEME.test(href)) return;

    const cleanHref = href.split("#")[0];
    const target = toAbsolutePath(cleanHref, ctx);
    if (!target) return;

    if (MARKDOWN_EXT.test(target) && onNavigate) {
      onNavigate(target);
      return;
    }

    void openUrl(`file://${target}`);
  };

  return (
    <a {...rest} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
