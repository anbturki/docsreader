import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { SEARCH_SCOPES } from "@/lib/contentSearch";
import { LENS_VIEW_OPTIONS, type LensViewId, type SidebarLens } from "@/lib/storage";
import type { SidebarSearch } from "@/hooks/useSidebarSearch";
import { ExplorerHeader } from "./ExplorerHeader";
import { TaskFilterProvider, useTaskFilter } from "./TaskFilterContext";

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

const search: SidebarSearch = {
  open: false,
  query: "",
  scope: SEARCH_SCOPES[0],
  focusSignal: 0,
  setQuery: vi.fn(),
  setScope: vi.fn(),
  reveal: vi.fn(),
  dismiss: vi.fn(),
};

function ViewLabel() {
  const { view } = useTaskFilter();
  return <output>{view}</output>;
}

function renderHeader(lens: SidebarLens, onViewChange?: (view: LensViewId) => void) {
  return render(
    <SidebarProvider>
      <TaskFilterProvider onViewChange={onViewChange}>
        <ExplorerHeader lens={lens} search={search} scanning={false} onRefresh={vi.fn()} />
        <ViewLabel />
      </TaskFilterProvider>
    </SidebarProvider>
  );
}

describe("ExplorerHeader view switch", () => {
  it("offers one choice per view the lens declares", () => {
    renderHeader("tasks");
    for (const id of LENS_VIEW_OPTIONS.tasks) {
      expect(screen.getByRole("radio", { name: new RegExp(id, "i") })).toBeTruthy();
    }
  });

  it("draws no switch at all on a lens that declares fewer than two views", () => {
    renderHeader("tree");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(document.querySelector('[data-slot="toggle-group"]')).toBeNull();
  });

  it("stays on the control row beside the other controls", () => {
    renderHeader("tasks");
    const group = screen.getByRole("radio", { name: /board/i }).parentElement;
    const row = group?.parentElement;
    expect(row?.querySelector('button[aria-label="Refresh workspace"]')).not.toBeNull();
  });

  it("selects the view the reader picks", () => {
    const onViewChange = vi.fn();
    renderHeader("tasks", onViewChange);

    fireEvent.click(screen.getByRole("radio", { name: /list/i }));

    expect(onViewChange).toHaveBeenCalledWith("list");
  });

  it("marks the active view as pressed", () => {
    renderHeader("tasks");
    expect(screen.getByRole("radio", { name: /board/i }).getAttribute("data-state")).toBe("on");

    fireEvent.click(screen.getByRole("radio", { name: /list/i }));

    expect(screen.getByRole("radio", { name: /list/i }).getAttribute("data-state")).toBe("on");
    expect(screen.getByText("list")).toBeTruthy();
  });
});
