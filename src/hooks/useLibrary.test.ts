import { renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

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
