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
  loadTabsState,
  saveTabsState,
  isTaskTabView,
  SPLIT_MODES,
  TASK_TAB_VIEWS,
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

describe("the tasks tab view", () => {
  beforeEach(() => {
    storeGet.mockReset();
    storeSet.mockReset();
    storeSave.mockReset();
  });

  it("round-trips the chosen view through the store", async () => {
    await saveViewSettings({ ...defaultViewSettings, taskTabView: "list" });

    const [key, written] = storeSet.mock.calls[0];
    expect(key).toBe("viewSettings");
    storeGet.mockResolvedValue(written);

    const settings = await loadViewSettings();

    expect(settings.taskTabView).toBe("list");
  });

  it("accepts every declared view", () => {
    for (const view of TASK_TAB_VIEWS) expect(isTaskTabView(view)).toBe(true);
  });

  it.each(["", "calendar", 2, null, undefined])("rejects %o", (value) => {
    expect(isTaskTabView(value)).toBe(false);
  });

  // What sat on disk before the views moved to the tab: a per-lens map, whose
  // "kanban" no longer names anything.
  it("falls back to the default when the stored settings predate the tab views", async () => {
    storeGet.mockResolvedValue({
      sidebarLens: "tasks",
      lensViews: { tasks: "kanban", tree: "list" },
    });

    const settings = await loadViewSettings();

    expect(settings.taskTabView).toBe(defaultViewSettings.taskTabView);
    expect(settings.sidebarLens).toBe("tasks");
  });

  it("falls back to the default when the stored view no longer exists", async () => {
    storeGet.mockResolvedValue({ taskTabView: "kanban" });

    const settings = await loadViewSettings();

    expect(settings.taskTabView).toBe(defaultViewSettings.taskTabView);
  });
});

describe("tabs state", () => {
  beforeEach(() => {
    storeGet.mockReset();
    storeSet.mockReset();
    storeSave.mockReset();
  });

  // The shape every existing install has on disk: a list of paths, with the
  // active tab named by path.
  it("keeps the tabs of a state written before tabs could be anything but files", async () => {
    storeGet.mockResolvedValue({
      paths: ["/ws/a.md", "/ws/b.md"],
      activePath: "/ws/b.md",
      scrollByPath: { "/ws/a.md": 120 },
    });

    const state = await loadTabsState();

    expect(state.targets).toEqual([
      { kind: "file", ref: "/ws/a.md" },
      { kind: "file", ref: "/ws/b.md" },
    ]);
    expect(state.activeKey).toBe("file:/ws/b.md");
    expect(state.scrollByPath).toEqual({ "/ws/a.md": 120 });
  });

  it("drops a legacy active path that names no open tab", async () => {
    storeGet.mockResolvedValue({ paths: ["/ws/a.md"], activePath: "/ws/gone.md" });

    const state = await loadTabsState();

    expect(state.targets).toEqual([{ kind: "file", ref: "/ws/a.md" }]);
    expect(state.activeKey).toBeUndefined();
  });

  it("round-trips a state holding a tab that is not a file", async () => {
    await saveTabsState({
      targets: [{ kind: "file", ref: "/ws/a.md" }, { kind: "tasks", ref: "" }],
      activeKey: "tasks:",
      scrollByPath: {},
    });
    const [, written] = storeSet.mock.calls[0];
    storeGet.mockResolvedValue(written);

    const state = await loadTabsState();

    expect(state.targets).toEqual([
      { kind: "file", ref: "/ws/a.md" },
      { kind: "tasks", ref: "" },
    ]);
    expect(state.activeKey).toBe("tasks:");
  });

  it("skips entries whose kind is unknown", async () => {
    storeGet.mockResolvedValue({
      targets: [{ kind: "calendar", ref: "" }, { kind: "file", ref: "/ws/a.md" }, 7],
    });

    const state = await loadTabsState();

    expect(state.targets).toEqual([{ kind: "file", ref: "/ws/a.md" }]);
  });
});
