import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppToolbar } from "./AppToolbar";

const { platform } = vi.hoisted(() => ({ platform: { isMac: false } }));
vi.mock("@/lib/platform", () => ({
  get isMac() {
    return platform.isMac;
  },
}));

const handlers = {
  onSelectRoot: vi.fn(),
  onRemoveRoot: vi.fn(),
  onPickDirectory: vi.fn(),
  onSidebarOpenChange: vi.fn(),
  onBreadcrumbSegmentClick: vi.fn(),
  onOpenQuickOpen: vi.fn(),
  onRefresh: vi.fn(),
  onCollapseAll: vi.fn(),
  onSplitChange: vi.fn(),
  onToggleOutline: vi.fn(),
  onToggleTheme: vi.fn(),
  onOpenSettings: vi.fn(),
  onPrefetchSettings: vi.fn(),
};

const ROOTS = ["/ws/voice", "/ws/plain-folder"];

function renderToolbar(overrides: { sidebarOpen?: boolean; roots?: string[] } = {}) {
  const { sidebarOpen = true, roots = ROOTS } = overrides;
  return render(
    <TooltipProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={handlers.onSidebarOpenChange}>
        <AppToolbar
          roots={roots}
          activeRoot={roots[0]}
          workspaceNamesByRoot={{ "/ws/voice": "Vinfra Voice" }}
          onSelectRoot={handlers.onSelectRoot}
          onRemoveRoot={handlers.onRemoveRoot}
          onPickDirectory={handlers.onPickDirectory}
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={handlers.onSidebarOpenChange}
          breadcrumbPath="notes/today.md"
          onBreadcrumbSegmentClick={handlers.onBreadcrumbSegmentClick}
          quickOpenShortcut="Mod+P"
          onOpenQuickOpen={handlers.onOpenQuickOpen}
          scanning={false}
          onRefresh={handlers.onRefresh}
          canCollapseAll
          onCollapseAll={handlers.onCollapseAll}
          split="off"
          onSplitChange={handlers.onSplitChange}
          canToggleOutline
          outlineOpen={false}
          onToggleOutline={handlers.onToggleOutline}
          isDark={false}
          onToggleTheme={handlers.onToggleTheme}
          onOpenSettings={handlers.onOpenSettings}
          onPrefetchSettings={handlers.onPrefetchSettings}
        />
      </SidebarProvider>
    </TooltipProvider>
  );
}

function toolbar() {
  return screen.getByRole("banner");
}

// SidebarProvider reads matchMedia, which jsdom does not implement.
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  platform.isMac = false;
  Object.values(handlers).forEach((h) => h.mockReset());
});

const CONTROL_LABELS = [
  "Toggle sidebar",
  "Refresh workspace",
  "Collapse all",
  "Toggle outline",
  "Toggle theme",
  "Settings",
];

describe("AppToolbar", () => {
  it.each([true, false])("renders every control with the sidebar open=%s", (open) => {
    renderToolbar({ sidebarOpen: open });
    for (const label of CONTROL_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(screen.getByRole("group", { name: "Split layout" })).toBeTruthy();
    expect(screen.getByText("Search")).toBeTruthy();
  });

  it("keeps the same full-width geometry in both sidebar states", () => {
    const { unmount } = renderToolbar({ sidebarOpen: true });
    const openClasses = toolbar().className;
    unmount();
    renderToolbar({ sidebarOpen: false });
    expect(toolbar().className).toBe(openClasses);
    expect(openClasses).toContain("inset-x-0");
    expect(openClasses).not.toContain("--sidebar-width");
  });

  it("derives its height from the shared toolbar variable", () => {
    renderToolbar();
    expect(toolbar().className).toContain("h-(--toolbar-height)");
  });

  it("hosts the workspace switcher and still selects a workspace", async () => {
    const user = userEvent.setup();
    renderToolbar();

    const trigger = screen.getByRole("button", { name: /switch workspace/i });
    expect(toolbar().contains(trigger)).toBe(true);

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: /plain-folder/ }));
    expect(handlers.onSelectRoot).toHaveBeenCalledWith("/ws/plain-folder");
  });

  it("omits the workspace switcher when there are no workspaces", () => {
    renderToolbar({ roots: [] });
    expect(screen.queryByRole("button", { name: /switch workspace/i })).toBeNull();
  });

  it("reserves room for the window controls on macOS", () => {
    platform.isMac = true;
    renderToolbar();
    expect(toolbar().className).toContain("pl-[100px]");
  });

  it("reserves no window-control room off macOS", () => {
    renderToolbar();
    expect(toolbar().className).not.toContain("pl-[100px]");
    expect(toolbar().className).toContain("pl-2");
  });

  it("toggles the sidebar without depending on its current state", async () => {
    const user = userEvent.setup();
    renderToolbar({ sidebarOpen: true });
    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(handlers.onSidebarOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens quick search", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByText("Search"));
    expect(handlers.onOpenQuickOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps drag regions on the inert spacers", () => {
    renderToolbar();
    expect(toolbar().hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(toolbar().querySelectorAll("[data-tauri-drag-region]")).toHaveLength(2);
  });
});
