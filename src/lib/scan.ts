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
  // Optional: cached results from older app versions predate this field.
  skipped?: number;
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

const BOM = "﻿";
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// Longest silence tolerated between two scan-progress events before the scan
// is treated as hung. The backend throttles progress to one event per 100ms
// (PROGRESS_INTERVAL_MS in src-tauri/core/src/scan.rs), so a live scan is
// hundreds of times more talkative than this window.
const SCAN_IDLE_TIMEOUT_MS = 60_000;

const SCAN_STALLED_MESSAGE =
  "This folder stopped responding while being scanned. It may be on a disconnected drive or still downloading from cloud storage. Check the folder is available, then try again.";

export function parseFrontmatter(source: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const trimmed = source.startsWith(BOM) ? source.slice(1) : source;
  const match = FRONTMATTER_PATTERN.exec(trimmed);
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

// prefix + body === source. The prefix is re-attached verbatim on save so
// frontmatter never round-trips through the editor's markdown serializer.
export function splitFrontmatter(source: string): { prefix: string; body: string } {
  const bom = source.startsWith(BOM) ? BOM : "";
  const rest = bom ? source.slice(1) : source;
  const match = FRONTMATTER_PATTERN.exec(rest);
  if (!match) return { prefix: bom, body: rest };
  return { prefix: bom + match[0], body: rest.slice(match[0].length) };
}

export async function scanDirectory(
  root: string,
  onProgress?: ProgressCallback
): Promise<ScanResult> {
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let markActivity: () => void = () => {};

  const unlisten: UnlistenFn = await listen<ScanProgress>("scan-progress", (event) => {
    const payload = event.payload;
    if (payload.root !== root) return;
    markActivity();
    if (onProgress) onProgress(payload);
  });

  // A legitimate workspace can scan for minutes (the walker caps at 50k
  // files), so the guard is an inactivity window rather than a total
  // deadline: only silence distinguishes a hung scan from a slow one.
  const stalled = new Promise<never>((_resolve, reject) => {
    markActivity = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => reject(new Error(SCAN_STALLED_MESSAGE)), SCAN_IDLE_TIMEOUT_MS);
    };
    markActivity();
  });

  try {
    return await Promise.race([
      invoke<ScanResult>("scan_markdown", { path: root }),
      stalled,
    ]);
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    unlisten();
  }
}
