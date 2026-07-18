import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type ProgressListener = (event: { payload: ScanProgress }) => void;
const progressListeners: ProgressListener[] = [];
const unlisten = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_event: string, cb: ProgressListener) => {
    progressListeners.push(cb);
    return unlisten;
  }),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  parseFrontmatter,
  scanDirectory,
  splitFrontmatter,
  type ScanProgress,
  type ScanResult,
} from "./scan";

describe("splitFrontmatter", () => {
  const cases: Record<string, string> = {
    "with frontmatter": "---\ntitle: Note\n---\n\n# hello\n",
    "without frontmatter": "# hello\n\njust body\n",
    "crlf frontmatter": "---\r\ntitle: Note\r\n---\r\n\r\n# hello\r\n",
    "bom then frontmatter": "﻿---\ntitle: Note\n---\n\n# hello\n",
    "body that contains a --- rule": "# hello\n\n---\n\nmore\n",
    empty: "",
  };

  for (const [name, source] of Object.entries(cases)) {
    it(`reconstructs ${name} byte-for-byte`, () => {
      const { prefix, body } = splitFrontmatter(source);
      expect(prefix + body).toBe(source);
    });
  }

  it("keeps the frontmatter prefix out of the editable body", () => {
    const { prefix, body } = splitFrontmatter("---\ntitle: Note\n---\n\n# hello\n");
    expect(prefix).toBe("---\ntitle: Note\n---\n");
    expect(body).toBe("\n# hello\n");
  });

  it("re-attaching an edited body preserves frontmatter verbatim", () => {
    const source = "---\ntitle: Note\nowner: ali\n---\n\n# hello\n";
    const { prefix } = splitFrontmatter(source);
    const rebuilt = prefix + "\n# hello edited\n";
    expect(parseFrontmatter(rebuilt).data).toEqual({ title: "Note", owner: "ali" });
    expect(parseFrontmatter(rebuilt).content).toBe("\n# hello edited\n");
  });
});

const ROOT = "/ws";
// Mirrors SCAN_IDLE_TIMEOUT_MS in scan.ts.
const IDLE_TIMEOUT_MS = 60_000;
const PAST_IDLE_MS = IDLE_TIMEOUT_MS + 1_000;
const WITHIN_IDLE_MS = IDLE_TIMEOUT_MS - 10_000;

function emitProgress(root: string, filesFound: number) {
  const payload: ScanProgress = {
    root,
    currentDir: ".",
    filesFound,
    dirsVisited: 1,
  };
  for (const listener of progressListeners) listener({ payload });
}

function emptyResult(root: string): ScanResult {
  return { root, files: [], truncated: false };
}

// Lets the awaits inside scanDirectory (listen, invoke) run before the
// fake clock is moved.
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("scanDirectory stall guard", () => {
  beforeEach(() => {
    progressListeners.length = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects with a friendly message when no progress arrives", async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    const promise = scanDirectory(ROOT);
    const assertion = expect(promise).rejects.toThrow(/stopped responding/i);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(PAST_IDLE_MS);
    await assertion;
    await expect(promise.catch((err: Error) => err.message)).resolves.not.toBe("");
    expect(unlisten).toHaveBeenCalled();
  });

  it("does not reject while progress keeps arriving", async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    let settled = false;
    const promise = scanDirectory(ROOT);
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );
    await flushMicrotasks();

    for (let step = 1; step <= 4; step += 1) {
      await vi.advanceTimersByTimeAsync(WITHIN_IDLE_MS);
      emitProgress(ROOT, step);
    }
    await flushMicrotasks();

    expect(settled).toBe(false);
  });

  it("ignores progress belonging to another root", async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    const promise = scanDirectory(ROOT);
    const assertion = expect(promise).rejects.toThrow(/stopped responding/i);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(WITHIN_IDLE_MS);
    emitProgress("/other", 1);
    await vi.advanceTimersByTimeAsync(PAST_IDLE_MS);
    await assertion;
  });

  it("resolves a fast scan and cleans up its listener and timer", async () => {
    vi.mocked(invoke).mockResolvedValue(emptyResult(ROOT));
    const onProgress = vi.fn();
    const promise = scanDirectory(ROOT, onProgress);
    await flushMicrotasks();
    await expect(promise).resolves.toEqual(emptyResult(ROOT));
    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(PAST_IDLE_MS * 10);
  });

  it("forwards progress for its own root to the callback", async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    const onProgress = vi.fn();
    void scanDirectory(ROOT, onProgress).catch(() => {});
    await flushMicrotasks();
    emitProgress(ROOT, 7);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ root: ROOT, filesFound: 7 })
    );
  });
});
