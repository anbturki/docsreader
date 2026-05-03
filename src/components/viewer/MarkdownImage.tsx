import type { ImgHTMLAttributes } from "react";
import { resolveAssetSrc, type ResolveContext } from "./resolveAssetSrc";

type Props = ImgHTMLAttributes<HTMLImageElement> & { ctx: ResolveContext };

export function MarkdownImage({ src, ctx, ...rest }: Props) {
  const resolved = typeof src === "string" ? resolveAssetSrc(src, ctx) : src;
  return <img {...rest} src={resolved} loading="lazy" />;
}
