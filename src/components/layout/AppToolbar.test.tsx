import tauriConfigSource from "../../../src-tauri/tauri.conf.json?raw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppToolbar } from "./AppToolbar";
import { CHROME_STYLE, MAC_WINDOW_CONTROLS } from "./chrome";
import {
  SPLIT_MODES,
  TASK_TAB_VIEWS,
  type SplitMode,
  type TaskTabView,
} from "@/lib/storage";

function trafficLightPosition(config: unknown): { x: number; y: number } {
  if (typeof config !== "object" || config === null) throw new Error("bad config");
  const app = (config as Record<string, unknown>).app;
  if (typeof app !== "object" || app === null) throw new Error("no app config");
  const windows = (app as Record<string, unknown>).windows;
  if (!Array.isArray(windows) || windows.length === 0) throw new Error("no windows");
  const position = (windows[0] as Record<string, unknown>).trafficLightPosition;
  if (
    typeof position !== "object" ||
    position === null ||
    typeof (position as Record<string, unknown>).x !== "number" ||
    typeof (position as Record<string, unknown>).y !== "number"
  ) {
    throw new Error("no trafficLightPosition");
  }
  return position as { x: number; y: number };
}

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
  onBreadcrumbSegmentClick: vi.fn(),
  onOpenQuickOpen: vi.fn(),
  onCollapseAll: vi.fn(),
  onSplitChange: vi.fn(),
  onTaskViewChange: vi.fn(),
  onToggleOutline: vi.fn(),
  onToggleTheme: vi.fn(),
  onOpenSettings: vi.fn(),
  onPrefetchSettings: vi.fn(),
};

const ROOTS = ["/ws/voice", "/ws/plain-folder"];

function renderToolbar(
  overrides: {
    sidebarOpen?: boolean;
    roots?: string[];
    split?: SplitMode;
    taskView?: TaskTabView;
  } = {}
) {
  const { sidebarOpen = true, roots = ROOTS, split = "off", taskView } = overrides;
  return render(
    <TooltipProvider>
      <SidebarProvider open={sidebarOpen}>
        <AppToolbar
          roots={roots}
          activeRoot={roots[0]}
          workspaceNamesByRoot={{ "/ws/voice": "Vinfra Voice" }}
          onSelectRoot={handlers.onSelectRoot}
          onRemoveRoot={handlers.onRemoveRoot}
          onPickDirectory={handlers.onPickDirectory}
          breadcrumbPath="notes/today.md"
          onBreadcrumbSegmentClick={handlers.onBreadcrumbSegmentClick}
          quickOpenShortcut="Mod+P"
          onOpenQuickOpen={handlers.onOpenQuickOpen}
          canCollapseAll
          onCollapseAll={handlers.onCollapseAll}
          split={split}
          onSplitChange={handlers.onSplitChange}
          taskView={taskView}
          onTaskViewChange={handlers.onTaskViewChange}
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

  it("leaves refreshing the workspace to the sidebar that owns it", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "Refresh workspace" })).toBeNull();
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

  it("caps the workspace switcher instead of reserving a fixed width", () => {
    renderToolbar();
    const slot = toolbar().querySelector("[data-slot='workspace-switcher-slot']");
    expect(slot?.className).toContain("max-w-");
    expect(slot?.className).not.toMatch(/(^|\s)w-\d/);
  });

  it("omits the workspace switcher when there are no workspaces", () => {
    renderToolbar({ roots: [] });
    expect(screen.queryByRole("button", { name: /switch workspace/i })).toBeNull();
  });

  it("reserves room for the window controls on macOS", () => {
    platform.isMac = true;
    renderToolbar();
    expect(toolbar().className).toContain("pl-(--window-controls-inset)");
  });

  it("reserves no window-control room off macOS", () => {
    renderToolbar();
    expect(toolbar().className).not.toContain("--window-controls-inset");
    expect(toolbar().className).toContain("pl-2");
  });

  it("keeps the window-control inset in step with the configured position", () => {
    const config: unknown = JSON.parse(tauriConfigSource);
    expect(trafficLightPosition(config)).toEqual(MAC_WINDOW_CONTROLS);
    expect(CHROME_STYLE["--window-controls-inset"]).toMatch(/^\d+px$/);
    expect(parseInt(CHROME_STYLE["--window-controls-inset"], 10)).toBeGreaterThan(
      MAC_WINDOW_CONTROLS.x
    );
  });

  it.each([true, false])(
    "leaves the sidebar toggle to the sidebar itself (open=%s)",
    (open) => {
      renderToolbar({ sidebarOpen: open });
      expect(screen.queryByRole("button", { name: /sidebar/i })).toBeNull();
    }
  );

  it("opens quick search", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByText("Search"));
    expect(handlers.onOpenQuickOpen).toHaveBeenCalledTimes(1);
  });

  it("offers one control per split mode", () => {
    renderToolbar();
    expect(screen.getAllByRole("radio")).toHaveLength(SPLIT_MODES.length);
  });

  it("reports the split mode the user picked", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByRole("radio", { name: "Side by side" }));
    expect(handlers.onSplitChange).toHaveBeenCalledWith("horizontal");
  });

  it("swallows a value outside the split modes instead of passing it through", async () => {
    const user = userEvent.setup();
    renderToolbar({ split: "horizontal" });
    await user.click(screen.getByRole("radio", { name: "Side by side" }));
    expect(handlers.onSplitChange).not.toHaveBeenCalled();
  });

  it("draws no tasks view switch while the active tab is not a tasks tab", () => {
    renderToolbar();
    expect(screen.queryByRole("group", { name: "Tasks view" })).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(SPLIT_MODES.length);
  });

  it("offers one control per view while a tasks tab is active", () => {
    renderToolbar({ taskView: "board" });
    const group = screen.getByRole("group", { name: "Tasks view" });
    expect(within(group).getAllByRole("radio")).toHaveLength(TASK_TAB_VIEWS.length);
  });

  it("marks the active view and reports the one the user picks", async () => {
    const user = userEvent.setup();
    renderToolbar({ taskView: "board" });

    expect(screen.getByRole("radio", { name: "Board" }).getAttribute("data-state")).toBe("on");

    await user.click(screen.getByRole("radio", { name: "List" }));
    expect(handlers.onTaskViewChange).toHaveBeenCalledWith("list");
  });

  it("names no view after the columns' old internal word", () => {
    renderToolbar({ taskView: "board" });
    const group = screen.getByRole("group", { name: "Tasks view" });
    expect(group.textContent ?? "").not.toMatch(/kanban/i);
    for (const radio of within(group).getAllByRole("radio")) {
      expect(radio.getAttribute("aria-label") ?? "").not.toMatch(/kanban/i);
      expect(radio.getAttribute("title") ?? "").not.toMatch(/kanban/i);
    }
  });

  it("keeps the bar the same height as the tasks switch comes and goes", () => {
    const { unmount } = renderToolbar();
    const withoutSwitch = toolbar().className;
    const splitItem = screen.getAllByRole("radio")[0].className;
    unmount();

    renderToolbar({ taskView: "list" });
    expect(toolbar().className).toBe(withoutSwitch);
    const group = screen.getByRole("group", { name: "Tasks view" });
    for (const radio of within(group).getAllByRole("radio")) {
      expect(radio.className).toContain("size-6");
    }
    expect(splitItem).toContain("size-6");
  });

  it("keeps drag regions on the inert spacers", () => {
    renderToolbar();
    expect(toolbar().hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(toolbar().querySelectorAll("[data-tauri-drag-region]")).toHaveLength(2);
  });
});
