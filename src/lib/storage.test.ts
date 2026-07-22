import { vi, describe, it, expect, beforeEach } from "vitest";

const { storeGet, storeSet, storeSave } = vi.hoisted(() => ({
  storeGet: vi.fn(),
  storeSet: vi.fn(),
  storeSave: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get = storeGet;
    set = storeSet;
    save = storeSave;
  },
}));

const {
  loadViewSettings,
  saveViewSettings,
  defaultViewSettings,
  loadPaneLayout,
  isSplitMode,
  lensViewFor,
  SPLIT_MODES,
} = await import("./storage");

describe("shortcut settings", () => {
  beforeEach(() => {
    storeGet.mockReset();
  });

  it("keeps a stored binding", async () => {
    storeGet.mockResolvedValue({ findInDocumentShortcut: "Mod+G" });

    const settings = await loadViewSettings();

    expect(settings.findInDocumentShortcut).toBe("Mod+G");
  });

  it("falls back when a binding was cleared, so the action stays reachable", async () => {
    storeGet.mockResolvedValue({
      quickOpenShortcut: "",
      findInDocumentShortcut: "   ",
      workspaceSearchShortcut: "",
    });

    const settings = await loadViewSettings();

    expect(settings.quickOpenShortcut).toBe(defaultViewSettings.quickOpenShortcut);
    expect(settings.findInDocumentShortcut).toBe(
      defaultViewSettings.findInDocumentShortcut
    );
    expect(settings.workspaceSearchShortcut).toBe(
      defaultViewSettings.workspaceSearchShortcut
    );
  });

  it("falls back when a binding is not a string", async () => {
    storeGet.mockResolvedValue({ workspaceSearchShortcut: 42 });

    const settings = await loadViewSettings();

    expect(settings.workspaceSearchShortcut).toBe(
      defaultViewSettings.workspaceSearchShortcut
    );
  });

  it("trims a stored binding", async () => {
    storeGet.mockResolvedValue({ workspaceSearchShortcut: "  Mod+K  " });

    const settings = await loadViewSettings();

    expect(settings.workspaceSearchShortcut).toBe("Mod+K");
  });

  it("uses defaults when nothing is stored", async () => {
    storeGet.mockResolvedValue(undefined);

    const settings = await loadViewSettings();

    expect(settings.findInDocumentShortcut).toBe(
      defaultViewSettings.findInDocumentShortcut
    );
  });

  it("keeps find and workspace search on different default bindings", () => {
    expect(defaultViewSettings.findInDocumentShortcut).not.toBe(
      defaultViewSettings.workspaceSearchShortcut
    );
  });
});

describe("split mode", () => {
  beforeEach(() => {
    storeGet.mockReset();
  });

  it("accepts every declared mode", () => {
    for (const mode of SPLIT_MODES) expect(isSplitMode(mode)).toBe(true);
  });

  it.each(["", "diagonal", 2, null, undefined])("rejects %o", (value) => {
    expect(isSplitMode(value)).toBe(false);
  });

  it("falls back to a single pane when the stored mode is not one of ours", async () => {
    storeGet.mockResolvedValue({ split: "diagonal", splitSize: 40, activePane: 1 });

    const layout = await loadPaneLayout();

    expect(layout.split).toBe("off");
    expect(layout.activePane).toBe(0);
  });

  it("keeps a stored mode it recognises", async () => {
    storeGet.mockResolvedValue({ split: "vertical", splitSize: 40, activePane: 1 });

    const layout = await loadPaneLayout();

    expect(layout.split).toBe("vertical");
  });
});

describe("lens views", () => {
  beforeEach(() => {
    storeGet.mockReset();
    storeSet.mockReset();
    storeSave.mockReset();
  });

  it("round-trips the chosen view through the store", async () => {
    await saveViewSettings({ ...defaultViewSettings, lensViews: { tasks: "list" } });

    const [key, written] = storeSet.mock.calls[0];
    expect(key).toBe("viewSettings");
    storeGet.mockResolvedValue(written);

    const settings = await loadViewSettings();

    expect(settings.lensViews).toEqual({ tasks: "list" });
    expect(lensViewFor(settings.lensViews, "tasks")).toBe("list");
  });

  it("drops a view the lens does not declare", async () => {
    storeGet.mockResolvedValue({ lensViews: { tasks: "calendar", tree: "list" } });

    const settings = await loadViewSettings();

    expect(settings.lensViews).toEqual({});
    expect(lensViewFor(settings.lensViews, "tasks")).toBe("board");
  });

  it("offers no view to a lens that declares none", () => {
    expect(lensViewFor({}, "tree")).toBeUndefined();
  });
});
