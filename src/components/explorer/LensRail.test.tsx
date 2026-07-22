import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { CHROME_STYLE } from "@/components/layout/chrome";
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

const LENS_LABELS = ["Tree", "Recent", "Tags", "Pinned", "Tasks"];

function renderRail(
  active: SidebarLens,
  onChange: (lens: SidebarLens) => void = () => {},
  open = true
) {
  return render(
    <TooltipProvider>
      <SidebarProvider open={open}>
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

  it("loads a valid lens for a build that persisted the removed search lens", async () => {
    const { loadViewSettings } = await import("@/lib/storage");
    storeGet.mockResolvedValue({ sidebarLens: "search" });
    const settings = await loadViewSettings();
    expect(SIDEBAR_LENSES).toContain(settings.sidebarLens);
    expect(settings.sidebarLens).toBe("tree");
  });
});

describe("lens rail", () => {
  it("renders the last lens in SIDEBAR_LENSES, so none is clipped", () => {
    renderRail("tree");
    const last = SIDEBAR_LENSES[SIDEBAR_LENSES.length - 1];
    expect(last).toBe("tasks");
    expect(screen.getByRole("tab", { name: "Tasks" })).toBeTruthy();
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

  it("takes its width from the shared collapsed-width token", () => {
    const { container } = renderRail("tree");
    const rail = container.querySelector('[data-slot="sidebar"]');
    expect(rail?.className).toContain("--sidebar-width-icon");
    expect(rail?.className).not.toMatch(/w-\[\d+(px|rem)/);
  });

  it("takes the selected accent at full strength, with its own foreground", () => {
    const { container } = renderRail("tree");
    const rail = container.querySelector('[data-slot="sidebar"]');
    expect(rail?.className).toContain("bg-primary-fixed");
    expect(rail?.className).toContain("text-primary-fixed-foreground");
    // No tint, blend or fade: the fill is the swatch colour itself.
    expect(rail?.className).not.toMatch(/bg-primary-fixed\//);
    expect(rail?.className).not.toContain("color-mix");
  });

  it("is one shape: a card rounded on every corner, one width in both states", () => {
    const { container } = renderRail("tree");
    const rail = container.querySelector('[data-slot="sidebar"]');
    expect(rail?.className).toContain("rounded-md");
    expect(rail?.className).not.toMatch(/rounded-(l|r|t|b|tl|tr|bl|br)/);
    expect(rail?.className).not.toContain("border-r");
    expect(rail?.className).not.toContain("group-data-[collapsible=icon]:w-");
  });

  it("carries the item states on the items, never on the rail fill", () => {
    const { container } = renderRail("tree");
    const rail = container.querySelector('[data-slot="sidebar"]');
    const tab = screen.getByRole("tab", { name: "Tree" });
    for (const state of ["hover:", "active:", "data-active:"]) {
      expect(rail?.className).not.toContain(state);
      expect(tab.className).toContain(`${state}bg-`);
    }
    // The menu button's own press fill is an opaque neutral, which flashes
    // white over the accent for as long as the button is held.
    expect(tab.className).not.toMatch(/(^| )active:bg-sidebar-accent($| )/);
    expect(tab.className).not.toMatch(/(^| )hover:bg-sidebar-accent($| )/);
  });

  it("marks the selected item by colour alone: no box, no weight, no ring", () => {
    renderRail("tree");
    const tab = screen.getByRole("tab", { name: "Tree" });
    expect(tab.className).not.toMatch(/(^| )data-active:(ring|border|outline|text-(base|sm|lg))/);
    expect(tab.className).toContain("data-active:bg-transparent");
    expect(tab.className).toContain("data-active:text-primary-fixed-foreground");
    // The menu button's own selected state is a fill plus a weight change.
    expect(tab.className).not.toMatch(/(^| )data-active:font-medium($| )/);
    expect(tab.className).toContain("data-active:font-light");
  });

  it("keeps a keyboard focus ring, since colour alone is not focus", () => {
    renderRail("tree");
    const tab = screen.getByRole("tab", { name: "Tree" });
    expect(tab.className).toContain("focus-visible:ring-2");
    expect(tab.className).toContain("focus-visible:ring-primary-fixed-foreground");
  });

  it("paints no background in any state, only a brighter foreground", () => {
    renderRail("tree");
    for (const tab of screen.getAllByRole("tab")) {
      for (const state of ["hover:", "active:", "data-active:"]) {
        expect(tab.className).toContain(`${state}bg-transparent`);
        expect(tab.className).toContain(`${state}text-primary-fixed-foreground`);
        expect(tab.className).not.toMatch(new RegExp(`(^| )${state}bg-sidebar-accent($| )`));
      }
    }
  });

  it("gets a token wide enough for a label under each icon", () => {
    expect(parseFloat(CHROME_STYLE["--sidebar-width-icon"])).toBeGreaterThan(2.5);
    expect(CHROME_STYLE["--sidebar-width-icon"]).toMatch(/rem$/);
  });

  it("keeps its stacked buttons out of the square icon-mode shape", () => {
    renderRail("tree", () => {}, false);
    const tab = screen.getByRole("tab", { name: "Tree" });
    expect(tab.className).toMatch(/group-data-\[collapsible=icon\]:size-/);
    expect(tab.className).toContain("flex-col");
  });

  // The toggle keeps one home so collapsing cannot shift the lens items under it.
  it("hosts the toggle in both states, naming the action each time", () => {
    const { unmount } = renderRail("tree");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeTruthy();
    unmount();

    renderRail("tree", () => {}, false);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
  });

  it("keeps the lens items at the same offset in both states", () => {
    const { container, unmount } = renderRail("tree");
    const expandedTabs = container.querySelectorAll('[role="tab"]').length;
    const expandedSlots = container.querySelectorAll("button").length;
    unmount();

    const collapsed = renderRail("tree", () => {}, false);
    expect(collapsed.container.querySelectorAll('[role="tab"]').length).toBe(expandedTabs);
    expect(collapsed.container.querySelectorAll("button").length).toBe(expandedSlots);
  });

  it("sizes the expand control like a lens item rather than a floating icon", () => {
    renderRail("tree", () => {}, false);
    const toggle = screen.getByRole("button", { name: "Expand sidebar" });
    const tab = screen.getByRole("tab", { name: "Tree" });

    expect(toggle.className).toContain("w-full");
    expect(toggle.className).not.toContain("size-7");
    for (const shared of ["h-auto", "p-1"]) {
      expect(toggle.className).toContain(shared);
      expect(tab.className).toContain(shared);
    }
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

  it("no longer offers search as a place to navigate to", () => {
    renderRail("tree");
    expect(screen.queryByRole("tab", { name: "Search" })).toBeNull();
  });
});
