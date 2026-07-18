import { renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { watch, type WatchEvent } from "@tauri-apps/plugin-fs";
import { scanDirectory } from "@/lib/scan";
import type { RegistryWorkspace } from "@/lib/workspaces";

let registry: RegistryWorkspace[] = [];
let storedRoots: string[] = [];
let dismissed: string[] = [];
const savedRoots = vi.fn(async () => {});
const dismissedAdded = vi.fn(async () => {});
const dismissedRemoved = vi.fn(async () => {});

vi.mock("@/lib/workspaces", () => ({
  listRegistryWorkspaces: vi.fn(async () => registry),
  registryDir: vi.fn(async () => "/home/u/.docsreader"),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  watch: vi.fn(async () => () => {}),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

vi.mock("@/lib/scan", () => ({
  scanDirectory: vi.fn(async (root: string) => ({
    root,
    files: [],
    truncated: false,
  })),
}));

vi.mock("@/lib/git", () => ({ fetchGitStatus: vi.fn(async () => undefined) }));

vi.mock("@/lib/storage", () => ({
  loadRoots: vi.fn(async () => storedRoots),
  saveRoots: vi.fn(async (r: string[]) => {
    storedRoots = r;
    await savedRoots();
  }),
  loadLastSelected: vi.fn(async () => undefined),
  saveLastSelected: vi.fn(async () => {}),
  loadScanCache: vi.fn(async () => undefined),
  saveScanCache: vi.fn(async () => {}),
  deleteScanCache: vi.fn(async () => {}),
  loadDismissedRegistry: vi.fn(async () => dismissed),
  addDismissedRegistry: vi.fn(async (p: string) => {
    dismissed = [...dismissed, p];
    await dismissedAdded();
  }),
  removeDismissedRegistry: vi.fn(async (p: string) => {
    dismissed = dismissed.filter((d) => d !== p);
    await dismissedRemoved();
  }),
}));

import { useLibrary } from "./useLibrary";

const NOTES: RegistryWorkspace = {
  slug: "notes",
  path: "/home/u/notes",
  scope: "user",
};
const DCS: RegistryWorkspace = {
  slug: "dcs",
  path: "/repo/dcs",
  scope: "project",
};

async function mount() {
  const hook = renderHook(() => useLibrary());
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

describe("useLibrary registry sync", () => {
  beforeEach(() => {
    registry = [];
    storedRoots = [];
    dismissed = [];
    vi.clearAllMocks();
  });

  it("adds agent-created workspaces to an empty app and selects the first", async () => {
    registry = [NOTES, DCS];
    const hook = await mount();
    await waitFor(() =>
      expect(hook.result.current.roots).toEqual([NOTES.path, DCS.path])
    );
    await waitFor(() =>
      expect(hook.result.current.activeRoot).toBe(NOTES.path)
    );
  });

  it("does not steal the active root when the app already has one", async () => {
    storedRoots = ["/manual/folder"];
    registry = [NOTES];
    const hook = await mount();
    await waitFor(() =>
      expect(hook.result.current.roots).toContain(NOTES.path)
    );
    expect(hook.result.current.activeRoot).toBe("/manual/folder");
  });

  it("keeps stored roots and appends only new registry workspaces", async () => {
    storedRoots = ["/manual/folder", NOTES.path];
    registry = [NOTES, DCS];
    const hook = await mount();
    await waitFor(() =>
      expect(hook.result.current.roots).toEqual([
        "/manual/folder",
        NOTES.path,
        DCS.path,
      ])
    );
  });

  it("does not re-add a dismissed registry workspace", async () => {
    dismissed = [DCS.path];
    registry = [NOTES, DCS];
    const hook = await mount();
    await waitFor(() =>
      expect(hook.result.current.roots).toEqual([NOTES.path])
    );
    expect(hook.result.current.roots).not.toContain(DCS.path);
  });

  it("removing a synced workspace records a dismissal so it stays gone", async () => {
    registry = [NOTES];
    const hook = await mount();
    await waitFor(() =>
      expect(hook.result.current.roots).toEqual([NOTES.path])
    );
    await hook.result.current.removeRoot(NOTES.path);
    await waitFor(() => expect(hook.result.current.roots).toEqual([]));
    expect(dismissed).toContain(NOTES.path);
  });

  it("removing a manually added folder does not record a dismissal", async () => {
    storedRoots = ["/manual/only"];
    registry = [];
    const hook = await mount();
    await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
    await hook.result.current.removeRoot("/manual/only");
    await waitFor(() => expect(hook.result.current.roots).toEqual([]));
    expect(dismissed).not.toContain("/manual/only");
  });
});

// Past DEBOUNCE_MS in useLibrary.ts, so a scheduled rescan fires.
const PAST_DEBOUNCE_MS = 700;
const REGISTRY_DIR = "/home/u/.docsreader";
const WATCH_OK = async () => () => {};

async function workspaceWatchCallback(root: string) {
  await waitFor(() =>
    expect(
      vi.mocked(watch).mock.calls.some(([watched]) => watched === root)
    ).toBe(true)
  );
  const call = vi.mocked(watch).mock.calls.find(([watched]) => watched === root);
  if (!call) throw new Error(`no watch attached for ${root}`);
  return call[1];
}

function fireWatchEvent(
  callback: (event: WatchEvent) => void,
  type: WatchEvent["type"],
  paths: string[]
) {
  callback({ type, paths, attrs: {} });
}

describe("useLibrary stale-while-revalidate rescans", () => {
  beforeEach(() => {
    registry = [];
    storedRoots = [];
    dismissed = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rescans the initial root after startup hydration", async () => {
    storedRoots = ["/manual/folder"];
    await mount();
    await waitFor(() =>
      expect(scanDirectory).toHaveBeenCalledWith(
        "/manual/folder",
        expect.any(Function)
      )
    );
  });

  it("rescans a root when it is selected", async () => {
    storedRoots = ["/first", "/second"];
    const hook = await mount();
    vi.mocked(scanDirectory).mockClear();
    await hook.result.current.selectRoot("/second");
    await waitFor(() =>
      expect(scanDirectory).toHaveBeenCalledWith("/second", expect.any(Function))
    );
  });

  it("schedules a rescan when a file is modified in place", async () => {
    storedRoots = ["/manual/folder"];
    await mount();
    const callback = await workspaceWatchCallback("/manual/folder");
    vi.mocked(scanDirectory).mockClear();
    vi.useFakeTimers();
    fireWatchEvent(callback, { modify: { kind: "data", mode: "content" } }, [
      "/manual/folder/doc.md",
    ]);
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
    expect(scanDirectory).toHaveBeenCalledWith(
      "/manual/folder",
      expect.any(Function)
    );
  });

  it("schedules a rescan for an overflow sentinel event", async () => {
    storedRoots = ["/manual/folder"];
    await mount();
    const callback = await workspaceWatchCallback("/manual/folder");
    vi.mocked(scanDirectory).mockClear();
    vi.useFakeTimers();
    fireWatchEvent(callback, "other", []);
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
    expect(scanDirectory).toHaveBeenCalledWith(
      "/manual/folder",
      expect.any(Function)
    );
  });
});

describe("useLibrary scan failure handling", () => {
  beforeEach(() => {
    registry = [];
    storedRoots = [];
    dismissed = [];
    vi.clearAllMocks();
  });

  it("leaves the root unstuck when the scan rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    storedRoots = ["/hung/folder"];
    vi.mocked(scanDirectory).mockRejectedValue(
      new Error("This folder stopped responding while being scanned.")
    );
    try {
      const hook = await mount();
      await waitFor(() => expect(scanDirectory).toHaveBeenCalled());
      await waitFor(() =>
        expect(hook.result.current.scans["/hung/folder"]?.scanning).toBe(false)
      );
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
      vi.mocked(scanDirectory).mockImplementation(async (root: string) => ({
        root,
        files: [],
        truncated: false,
      }));
    }
  });
});

describe("useLibrary watch resilience", () => {
  beforeEach(() => {
    registry = [];
    storedRoots = [];
    dismissed = [];
    vi.clearAllMocks();
  });

  it("retries a failing watch and warns after the final attempt", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(watch).mockRejectedValue(new Error("forbidden path"));
    try {
      await mount();
      await waitFor(() => expect(warn).toHaveBeenCalled(), { timeout: 4000 });
      const registryAttempts = vi
        .mocked(watch)
        .mock.calls.filter(([watched]) => watched === REGISTRY_DIR);
      expect(registryAttempts).toHaveLength(3);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("registry watch failed"),
        REGISTRY_DIR,
        expect.any(Error)
      );
    } finally {
      warn.mockRestore();
      vi.mocked(watch).mockImplementation(WATCH_OK);
    }
  });
});
