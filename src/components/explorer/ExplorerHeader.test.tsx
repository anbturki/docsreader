import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { SEARCH_SCOPES } from "@/lib/contentSearch";
import type { SidebarLens } from "@/lib/storage";
import type { SidebarSearch } from "@/hooks/useSidebarSearch";
import { ExplorerHeader } from "./ExplorerHeader";
import { TaskFilterProvider, useTaskFilter, type TaskCount } from "./TaskFilterContext";

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

// Stands in for the board, which owns the tasks and so publishes their count.
function BoardStub({ count }: { count: TaskCount | undefined }) {
  const { setCount } = useTaskFilter();
  return (
    <button type="button" onClick={() => setCount(count)}>
      publish count
    </button>
  );
}

function renderHeader(lens: SidebarLens, count: TaskCount | undefined) {
  return render(
    <SidebarProvider>
      <TaskFilterProvider>
        <ExplorerHeader lens={lens} search={search} scanning={false} onRefresh={vi.fn()} />
        <BoardStub count={count} />
      </TaskFilterProvider>
    </SidebarProvider>
  );
}

function publish() {
  fireEvent.click(screen.getByRole("button", { name: "publish count" }));
}

describe("ExplorerHeader task count", () => {
  it("shows the published count beside the controls, on the same row", () => {
    renderHeader("tasks", { shown: 78, total: 78 });
    publish();

    const label = screen.getByText("78 tasks");
    const row = label.parentElement;
    expect(row).not.toBeNull();
    expect(row?.querySelector('button[aria-label="Refresh workspace"]')).not.toBeNull();
    expect(row?.querySelector('button[aria-label="Filter tasks"]')).not.toBeNull();
  });

  it("shows both counts only while a filter narrows the list", () => {
    const { rerender } = renderHeader("tasks", { shown: 5, total: 78 });
    publish();
    expect(screen.getByText("5 / 78 tasks")).toBeTruthy();

    rerender(
      <SidebarProvider>
        <TaskFilterProvider>
          <ExplorerHeader lens="tasks" search={search} scanning={false} onRefresh={vi.fn()} />
          <BoardStub count={{ shown: 78, total: 78 }} />
        </TaskFilterProvider>
      </SidebarProvider>
    );
    publish();
    expect(screen.getByText("78 tasks")).toBeTruthy();
  });

  it("singularises a lone task", () => {
    renderHeader("tasks", { shown: 1, total: 1 });
    publish();
    expect(screen.getByText("1 task")).toBeTruthy();
  });

  it("shows nothing on a lens that publishes no count", () => {
    renderHeader("tree", { shown: 78, total: 78 });
    publish();
    expect(screen.queryByText(/task/)).toBeNull();
  });
});
