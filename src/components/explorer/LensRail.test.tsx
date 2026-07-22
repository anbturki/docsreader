import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SIDEBAR_LENSES, type SidebarLens } from "@/lib/storage";

import { LensRail } from "./LensRail";

const { storeGet } = vi.hoisted(() => ({ storeGet: vi.fn() }));
vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get = storeGet;
  },
}));

beforeEach(() => {
  storeGet.mockReset();
});

// jsdom has no matchMedia; SidebarProvider's mobile check needs one.
window.matchMedia ??= (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

const LENS_LABELS = ["Tree", "Recent", "Tags", "Pinned", "Tasks", "Search"];

function renderRail(active: SidebarLens, onChange: (lens: SidebarLens) => void = () => {}) {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <LensRail active={active} onChange={onChange} />
      </SidebarProvider>
    </TooltipProvider>
  );
}

describe("Smoke C1: tasks lens selectable + persists", () => {
  it("renders a Tasks entry alongside the others", () => {
    renderRail("tree");
    for (const label of LENS_LABELS) {
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    }
  });

  it("selects the tasks lens on click", () => {
    const onChange = vi.fn();
    renderRail("tree", onChange);
    screen.getByRole("tab", { name: "Tasks" }).click();
    expect(onChange).toHaveBeenCalledWith("tasks");
  });

  it("marks the active lens selected without touching the others", () => {
    renderRail("tasks");
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

describe("lens rail", () => {
  it("renders the last lens in SIDEBAR_LENSES, so none is clipped", () => {
    renderRail("search");
    const last = SIDEBAR_LENSES[SIDEBAR_LENSES.length - 1];
    expect(last).toBe("search");
    expect(screen.getByRole("tab", { name: "Search" })).toBeTruthy();
  });

  it("renders one labelled entry per lens in SIDEBAR_LENSES", () => {
    renderRail("tree");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(SIDEBAR_LENSES.length);
    for (const tab of tabs) {
      expect(tab.textContent?.trim()).toBeTruthy();
      expect(LENS_LABELS).toContain(tab.textContent?.trim());
    }
  });

  it("never surfaces internal lens ids as visible copy", () => {
    const { container } = renderRail("tree");
    for (const lens of SIDEBAR_LENSES) {
      expect(container.textContent).not.toContain(lens);
    }
  });

  it("derives its width from content, floored by the icon-width token", () => {
    const { container } = renderRail("tree");
    const rail = container.querySelector('[data-slot="sidebar"]');
    expect(rail?.className).toContain("w-fit");
    expect(rail?.className).toContain("min-w-(--sidebar-width-icon)");
  });

  it("carries no title-bar spacer, since the toolbar sits above the sidebar", () => {
    const { container } = renderRail("tree");
    expect(container.querySelector('[data-slot="sidebar-header"]')).toBeNull();
  });

  it("shows each label as visible text under the icon", () => {
    renderRail("tree");
    for (const label of LENS_LABELS) {
      const span = screen.getByText(label);
      expect(span.className).not.toContain("sr-only");
      expect(span.closest('[data-slot="sidebar-menu-button"]')?.className).toContain("flex-col");
    }
  });

  it("selects the search lens on click", () => {
    const onChange = vi.fn();
    renderRail("tree", onChange);
    screen.getByRole("tab", { name: "Search" }).click();
    expect(onChange).toHaveBeenCalledWith("search");
  });
});
