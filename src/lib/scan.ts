import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import yaml from "js-yaml";

export interface MarkdownFile {
  path: string;
  name: string;
  relPath: string;
  title?: string;
  tags: string[];
  modified?: number;
  size: number;
  links?: string[];
}

export interface WorkspaceMarker {
  slug: string;
  name?: string;
  homepage?: string;
}

export interface ScanResult {
  root: string;
  files: MarkdownFile[];
  truncated: boolean;
  marker?: WorkspaceMarker;
}

export interface ScanProgress {
  root: string;
  currentDir: string;
  filesFound: number;
  dirsVisited: number;
  lastFile?: string;
}

export type ProgressCallback = (progress: ScanProgress) => void;

export function parseFrontmatter(source: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const trimmed = source.replace(/^﻿/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(trimmed);
  if (!match) return { data: {}, content: trimmed };
  // Strip the matched frontmatter region regardless of whether the
  // YAML inside parsed cleanly. If the parse failed (malformed YAML),
  // we still don't want the `---` block bleeding into the rendered
  // body or into change-detection comparisons.
  const content = trimmed.slice(match[0].length);
  try {
    const data = (yaml.load(match[1]) ?? {}) as Record<string, unknown>;
    return { data, content };
  } catch {
    return { data: {}, content };
  }
}

export async function scanDirectory(
  root: string,
  onProgress?: ProgressCallback
): Promise<ScanResult> {
  let unlisten: UnlistenFn | undefined;
  if (onProgress) {
    unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      const payload = event.payload;
      if (payload.root === root) onProgress(payload);
    });
  }
  try {
    return await invoke<ScanResult>("scan_markdown", { path: root });
  } finally {
    if (unlisten) unlisten();
  }
}
