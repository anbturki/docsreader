import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { LensTabs } from "./LensTabs";

const { storeGet } = vi.hoisted(() => ({ storeGet: vi.fn() }));
vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get = storeGet;
  },
}));

beforeEach(() => {
  storeGet.mockReset();
});

describe("Smoke C1: tasks lens selectable + persists", () => {
  it("renders a Tasks tab alongside the others", () => {
    render(<LensTabs active="tree" onChange={() => {}} />);
    for (const label of ["Tree", "Recent", "Tags", "Pinned", "Tasks"]) {
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    }
  });

  it("selects the tasks lens on click", () => {
    const onChange = vi.fn();
    render(<LensTabs active="tree" onChange={onChange} />);
    screen.getByRole("tab", { name: "Tasks" }).click();
    expect(onChange).toHaveBeenCalledWith("tasks");
  });

  it("marks the active tab selected without touching the others", () => {
    render(<LensTabs active="tasks" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Tasks" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Tree" }).getAttribute("aria-selected")).toBe("false");
  });

  it("persists the tasks lens across reload (loadViewSettings)", async () => {
    const { loadViewSettings } = await import("@/lib/storage");
    storeGet.mockResolvedValue({ sidebarLens: "tasks" });
    const settings = await loadViewSettings();
    expect(settings.sidebarLens).toBe("tasks");
  });

  it("falls back to tree for an unknown persisted lens", async () => {
    const { loadViewSettings } = await import("@/lib/storage");
    storeGet.mockResolvedValue({ sidebarLens: "bogus" });
    const settings = await loadViewSettings();
    expect(settings.sidebarLens).toBe("tree");
  });
});
