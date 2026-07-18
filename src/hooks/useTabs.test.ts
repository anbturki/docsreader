import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useTabs } from "./useTabs";

type WatchCallback = (event: { type: unknown }) => void;
const watchCallbacks: WatchCallback[] = [];

interface WatchStart {
  path: string;
  cb: WatchCallback;
  unwatch: ReturnType<typeof vi.fn>;
}
const watchStarts: WatchStart[] = [];
// Path -> promise the mocked watch awaits before resolving, so a test can
// hold one attach open while the tab underneath it swaps path.
const watchGates = new Map<string, Promise<void>>();

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  watch: vi.fn(async (path: string, cb: WatchCallback) => {
    const unwatch = vi.fn();
    watchStarts.push({ path, cb, unwatch });
    const gate = watchGates.get(path);
    if (gate) await gate;
    watchCallbacks.push(cb);
    return unwatch;
  }),
}));

vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  loadTabsState: vi.fn(async () => ({
    paths: [],
    activePath: undefined,
    scrollByPath: {},
  })),
  saveTabsState: vi.fn(async () => {}),
}));

import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const RAW = "---\ntitle: Note\n---\n\n# hello\n";
const BODY = "\n# hello\n";
const BODY_EDITED = "\n# hello edited\n";
const EDITED = "---\ntitle: Note\n---\n\n# hello edited\n";
const CHANGED_ON_DISK = "---\ntitle: Note\n---\n\n# changed by agent\n";

async function openTab(isManagedPath: (path: string) => boolean = () => false) {
  const hook = renderHook(() =>
    useTabs({ autoReloadOnExternalChange: false, isManagedPath })
  );
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  act(() => hook.result.current.openInNew("/ws/doc.md"));
  await waitFor(() => expect(hook.result.current.activeTab?.loading).toBe(false));
  await waitFor(() => expect(watchCallbacks.length).toBeGreaterThan(0));
  return hook;
}

function fireExternalModify() {
  vi.mocked(readTextFile).mockResolvedValue(CHANGED_ON_DISK);
  act(() =>
    watchCallbacks[watchCallbacks.length - 1]({ type: { modify: { kind: "data" } } })
  );
}

beforeEach(() => {
  watchCallbacks.length = 0;
  watchStarts.length = 0;
  watchGates.clear();
  vi.mocked(readTextFile).mockResolvedValue(RAW);
  vi.mocked(writeTextFile).mockReset();
  vi.mocked(writeTextFile).mockResolvedValue();
});

describe("useTabs edit", () => {
  it("beginEdit loads the raw file including frontmatter", async () => {
    const { result } = await openTab();
    await act(() => result.current.beginEdit(result.current.activeTab!.id));
    expect(result.current.activeTab?.draft).toBe(RAW);
  });

  it("saveEdit re-attaches frontmatter to the edited body and re-renders", async () => {
    const { result } = await openTab();
    const id = result.current.activeTab!.id;
    await act(() => result.current.beginEdit(id));
    await act(() => result.current.saveEdit(id, BODY_EDITED));
    expect(writeTextFile).toHaveBeenCalledWith("/ws/doc.md", EDITED);
    expect(result.current.activeTab?.draft).toBeUndefined();
    expect(result.current.activeTab?.content).toContain("# hello edited");
    expect(result.current.activeTab?.meta).toEqual({ title: "Note" });
  });

  it("saveEdit skips the write when the reconstructed body is unchanged", async () => {
    const { result } = await openTab();
    const id = result.current.activeTab!.id;
    await act(() => result.current.beginEdit(id));
    await act(() => result.current.saveEdit(id, BODY));
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(result.current.activeTab?.draft).toBeUndefined();
  });

  it("saveEdit refuses to overwrite a file changed on disk during editing", async () => {
    const { result } = await openTab();
    const id = result.current.activeTab!.id;
    await act(() => result.current.beginEdit(id));
    vi.mocked(readTextFile).mockResolvedValue(CHANGED_ON_DISK);
    await act(() => result.current.saveEdit(id, BODY_EDITED));
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(result.current.activeTab?.draft).toBe(RAW);
    expect(result.current.activeTab?.draftError).toContain("changed on disk");
  });

  it("cancelEdit discards the draft without writing", async () => {
    const { result } = await openTab();
    const id = result.current.activeTab!.id;
    await act(() => result.current.beginEdit(id));
    act(() => result.current.cancelEdit(id));
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(result.current.activeTab?.draft).toBeUndefined();
    expect(result.current.activeTab?.content).toContain("# hello");
    expect(result.current.activeTab?.content).not.toContain("edited");
  });

  it("silently reloads external changes in managed workspaces", async () => {
    const { result } = await openTab(() => true);
    fireExternalModify();
    await waitFor(() =>
      expect(result.current.activeTab?.content).toContain("changed by agent")
    );
    expect(result.current.activeTab?.pendingContent).toBeUndefined();
  });

  it("raises the consent banner for external changes in unmanaged folders", async () => {
    const { result } = await openTab(() => false);
    fireExternalModify();
    await waitFor(() =>
      expect(result.current.activeTab?.pendingContent).toBe(CHANGED_ON_DISK)
    );
    expect(result.current.activeTab?.content).toContain("# hello");
    act(() => result.current.acceptPending(result.current.activeTab!.id));
    expect(result.current.activeTab?.content).toContain("changed by agent");
  });

  it("keeps the draft and surfaces the error when the write fails", async () => {
    const { result } = await openTab();
    const id = result.current.activeTab!.id;
    await act(() => result.current.beginEdit(id));
    vi.mocked(writeTextFile).mockRejectedValue(new Error("disk full"));
    await act(() => result.current.saveEdit(id, BODY_EDITED));
    expect(result.current.activeTab?.draft).toBe(RAW);
    expect(result.current.activeTab?.draftError).toBe("disk full");
  });
});

describe("useTabs watchers", () => {
  const PATH_A = "/ws/a.md";
  const PATH_B = "/ws/b.md";

  function findStart(path: string) {
    const start = watchStarts.find((w) => w.path === path);
    expect(start).toBeDefined();
    return start!;
  }

  // Opens PATH_A with its watch held open, swaps the tab to PATH_B while that
  // attach is still in flight, then lets the PATH_A watch resolve late.
  async function swapPathMidAttach() {
    let openGateA!: () => void;
    watchGates.set(
      PATH_A,
      new Promise<void>((resolve) => {
        openGateA = resolve;
      })
    );
    const hook = renderHook(() =>
      useTabs({ autoReloadOnExternalChange: false, isManagedPath: () => false })
    );
    await waitFor(() => expect(hook.result.current.hydrated).toBe(true));

    act(() => hook.result.current.openInNew(PATH_A));
    await waitFor(() => expect(watchStarts.some((w) => w.path === PATH_A)).toBe(true));

    act(() => hook.result.current.openInActive(PATH_B));
    await waitFor(() => expect(watchStarts.some((w) => w.path === PATH_B)).toBe(true));

    openGateA();
    return hook;
  }

  it("detaches a watcher superseded by a path swap during attach", async () => {
    await swapPathMidAttach();
    await waitFor(() => expect(findStart(PATH_A).unwatch).toHaveBeenCalled());
  });

  it("keeps the new path's watcher attached and working after the swap", async () => {
    const { result } = await swapPathMidAttach();
    await waitFor(() => expect(findStart(PATH_A).unwatch).toHaveBeenCalled());
    await waitFor(() => expect(result.current.activeTab?.loading).toBe(false));

    expect(findStart(PATH_B).unwatch).not.toHaveBeenCalled();
    vi.mocked(readTextFile).mockResolvedValue(CHANGED_ON_DISK);
    act(() => findStart(PATH_B).cb({ type: { modify: { kind: "data" } } }));
    await waitFor(() =>
      expect(result.current.activeTab?.pendingContent).toBe(CHANGED_ON_DISK)
    );
  });

  it("attaches exactly one watcher for a tab whose path never changes", async () => {
    const { result } = await openTab();
    expect(watchStarts.filter((w) => w.path === "/ws/doc.md")).toHaveLength(1);
    expect(watchStarts[0].unwatch).not.toHaveBeenCalled();

    fireExternalModify();
    await waitFor(() =>
      expect(result.current.activeTab?.pendingContent).toBe(CHANGED_ON_DISK)
    );
    expect(watchStarts[0].unwatch).not.toHaveBeenCalled();
  });
});

describe("useTabs load timeout", () => {
  const LOAD_TIMEOUT_MS = 15000;
  const STALE_RAW = "---\ntitle: Note\n---\n\n# stale from load A\n";

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderTabsWithFakeTimers() {
    vi.useFakeTimers();
    const hook = renderHook(() =>
      useTabs({ autoReloadOnExternalChange: false, isManagedPath: () => false })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hook.result.current.hydrated).toBe(true);
    return hook;
  }

  async function flushLoads() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it("turns a read that never settles into a retryable error", async () => {
    vi.mocked(readTextFile).mockReturnValue(new Promise<string>(() => {}));
    const { result } = await renderTabsWithFakeTimers();
    act(() => result.current.openInNew("/ws/doc.md"));
    expect(result.current.activeTab?.loading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    });
    expect(result.current.activeTab?.loading).toBe(false);
    expect(result.current.activeTab?.error).toBeTruthy();
    expect(result.current.activeTab?.content).toBe("");
  });

  it("openInActive retries a tab in error state", async () => {
    vi.mocked(readTextFile).mockReturnValueOnce(new Promise<string>(() => {}));
    const { result } = await renderTabsWithFakeTimers();
    act(() => result.current.openInNew("/ws/doc.md"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    });
    expect(result.current.activeTab?.error).toBeTruthy();
    act(() => result.current.openInActive("/ws/doc.md"));
    expect(result.current.activeTab?.loading).toBe(true);
    await flushLoads();
    expect(result.current.activeTab?.content).toContain("# hello");
    expect(result.current.activeTab?.error).toBeUndefined();
    expect(result.current.activeTab?.loading).toBe(false);
  });

  it("openInActive does not re-fire the load for a healthy tab", async () => {
    const { result } = await renderTabsWithFakeTimers();
    act(() => result.current.openInNew("/ws/doc.md"));
    await flushLoads();
    expect(result.current.activeTab?.loading).toBe(false);
    const reads = vi.mocked(readTextFile).mock.calls.length;
    act(() => result.current.openInActive("/ws/doc.md"));
    await flushLoads();
    expect(vi.mocked(readTextFile).mock.calls.length).toBe(reads);
    expect(result.current.activeTab?.loading).toBe(false);
  });

  it("drops the late completion of a load superseded by a retry", async () => {
    let resolveA!: (raw: string) => void;
    vi.mocked(readTextFile).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveA = resolve;
      })
    );
    const { result } = await renderTabsWithFakeTimers();
    act(() => result.current.openInNew("/ws/doc.md"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    });
    expect(result.current.activeTab?.error).toBeTruthy();
    vi.mocked(readTextFile).mockResolvedValue(CHANGED_ON_DISK);
    act(() => result.current.openInActive("/ws/doc.md"));
    await flushLoads();
    expect(result.current.activeTab?.content).toContain("changed by agent");
    resolveA(STALE_RAW);
    await flushLoads();
    expect(result.current.activeTab?.content).toContain("changed by agent");
    expect(result.current.activeTab?.content).not.toContain("stale");
    expect(result.current.activeTab?.error).toBeUndefined();
  });

  it("lets a late success of the same load replace the timeout error", async () => {
    let resolveA!: (raw: string) => void;
    vi.mocked(readTextFile).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveA = resolve;
      })
    );
    const { result } = await renderTabsWithFakeTimers();
    act(() => result.current.openInNew("/ws/doc.md"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    });
    expect(result.current.activeTab?.error).toBeTruthy();
    resolveA(RAW);
    await flushLoads();
    expect(result.current.activeTab?.content).toContain("# hello");
    expect(result.current.activeTab?.error).toBeUndefined();
  });
});
