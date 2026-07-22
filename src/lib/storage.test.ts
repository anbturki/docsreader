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

const { loadViewSettings, defaultViewSettings } = await import("./storage");

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
