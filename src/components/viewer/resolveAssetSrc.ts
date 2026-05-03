import { convertFileSrc } from "@tauri-apps/api/core";
import { dirname, isAbsolute, normalizeJoin } from "@/lib/path";

export interface ResolveContext {
  currentFilePath?: string;
  webRoot?: string;
}

export function resolveAssetSrc(src: string, ctx: ResolveContext): string {
  if (/^(https?|data|blob|asset):/i.test(src)) return src;
  if (src.startsWith("//")) return src;

  const absolute = toAbsolutePath(src, ctx);
  if (!absolute) return src;

  try {
    return convertFileSrc(absolute);
  } catch {
    return src;
  }
}

export function toAbsolutePath(
  src: string,
  { currentFilePath, webRoot }: ResolveContext
): string | undefined {
  if (src.startsWith("/") && webRoot) return normalizeJoin(webRoot, src.slice(1));
  if (isAbsolute(src)) return src;
  if (!currentFilePath) return undefined;
  return normalizeJoin(dirname(currentFilePath), src);
}
