import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useTabs } from "./useTabs";

type WatchCallback = (event: { type: unknown }) => void;
const watchCallbacks: WatchCallback[] = [];

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  watch: vi.fn(async (_path: string, cb: WatchCallback) => {
    watchCallbacks.push(cb);
    return () => {};
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
  vi.mocked(readTextFile).mockResolvedValue(RAW);
  vi.mocked(writeTextFile).mockReset();
  vi.mocked(writeTextFile).mockResolvedValue();
});

describe("useTabs quick-edit", () => {
  it("beginEdit loads the raw file including frontmatter", async () => {
    const { result } = await openTab();
    await act(() => result.current.beginEdit(result.current.activeTab!.id));
    expect(result.current.activeTab?.draft).toBe(RAW);
  });

  it("saveEdit writes the draft to disk and re-renders the parsed body", async () => {
    const { result } = await openTab();
    const id = result.current.activeTab!.id;
    await act(() => result.current.beginEdit(id));
    act(() => result.current.updateDraft(id, EDITED));
    await act(() => result.current.saveEdit(id));
    expect(writeTextFile).toHaveBeenCalledWith("/ws/doc.md", EDITED);
    expect(result.current.activeTab?.draft).toBeUndefined();
    expect(result.current.activeTab?.content).toContain("# hello edited");
    expect(result.current.activeTab?.meta).toEqual({ title: "Note" });
  });

  it("cancelEdit discards the draft without writing", async () => {
    const { result } = await openTab();
    const id = result.current.activeTab!.id;
    await act(() => result.current.beginEdit(id));
    act(() => result.current.updateDraft(id, EDITED));
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
    act(() => result.current.updateDraft(id, EDITED));
    vi.mocked(writeTextFile).mockRejectedValue(new Error("disk full"));
    await act(() => result.current.saveEdit(id));
    expect(result.current.activeTab?.draft).toBe(EDITED);
    expect(result.current.activeTab?.draftError).toBe("disk full");
  });
});
