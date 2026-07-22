import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TaskBoardView } from "./TaskBoardView";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";

function task(id: string, status: TaskStatus, over: Partial<Task> = {}): Task {
  return {
    id,
    title: `Title ${id}`,
    status,
    assignee: [],
    labels: [],
    dependencies: [],
    priority: null,
    createdDate: null,
    updatedDate: null,
    relPath: `tasks/${id}.md`,
    path: `/ws/tasks/${id}.md`,
    ...over,
  };
}

const noop = () => {};

function column(status: TaskStatus): HTMLElement {
  const el = document.querySelector(`[data-status="${status}"]`);
  if (!el) throw new Error(`missing column ${status}`);
  return el as HTMLElement;
}

describe("Smoke C2: board groups real tasks correctly", () => {
  const tasks = [
    task("task-1", "To Do", { priority: "high", assignee: ["alice"] }),
    task("task-2", "In Progress"),
    task("task-3", "Done"),
    task("task-4", "To Do"),
  ];
  const progress = new Map<string, AcProgress>([["/ws/tasks/task-2.md", { done: 1, total: 3 }]]);

  function board({ query = "" }: { query?: string } = {}) {
    return (
      <TaskBoardView
        tasks={tasks}
        query={query}
        progress={progress}
        loading={false}
        error={undefined}
        selectedPath={undefined}
        onRefresh={noop}
        onOpen={noop}
        onOpenInNewTab={noop}
      />
    );
  }

  function renderBoard() {
    return render(board());
  }

  it("renders three columns in TASK_STATUSES order", () => {
    renderBoard();
    const statuses = [...document.querySelectorAll("[data-status]")].map((el) =>
      el.getAttribute("data-status")
    );
    expect(statuses).toEqual(["To Do", "In Progress", "Done"]);
  });

  it("places each task in the column matching its status", () => {
    renderBoard();
    expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy();
    expect(within(column("To Do")).getByText("Title task-4")).toBeTruthy();
    expect(within(column("In Progress")).getByText("Title task-2")).toBeTruthy();
    expect(within(column("Done")).getByText("Title task-3")).toBeTruthy();
  });

  it("shows card fields (priority/assignee/AC) matching the task", () => {
    renderBoard();
    const todo = within(column("To Do"));
    expect(todo.getByText("high")).toBeTruthy();
    expect(todo.getByText("alice")).toBeTruthy();
    expect(within(column("In Progress")).getByText("1/3")).toBeTruthy();
  });

  it("opens the task on card click", async () => {
    const onOpen = vi.fn();
    render(
      <TaskBoardView
        tasks={[task("task-9", "Done")]}
        progress={new Map()}
        loading={false}
        error={undefined}
        selectedPath={undefined}
        onRefresh={noop}
        onOpen={onOpen}
        onOpenInNewTab={noop}
      />
    );
    screen.getByText("Title task-9").click();
    expect(onOpen).toHaveBeenCalledWith("/ws/tasks/task-9.md");
  });

  it("shows skeletons while loading with no tasks yet", () => {
    render(
      <TaskBoardView
        tasks={[]}
        progress={new Map()}
        loading={true}
        error={undefined}
        selectedPath={undefined}
        onRefresh={noop}
        onOpen={noop}
        onOpenInNewTab={noop}
      />
    );
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(document.querySelector("[data-status]")).toBeNull();
  });

  it("calls onAdvance with the target status when a card is dragged across columns", () => {
    const onAdvance = vi.fn();
    render(
      <TaskBoardView
        tasks={[task("task-1", "To Do")]}
        progress={new Map()}
        loading={false}
        error={undefined}
        selectedPath={undefined}
        onRefresh={noop}
        onOpen={noop}
        onOpenInNewTab={noop}
        onAdvance={onAdvance}
      />
    );
    const card = screen.getByText("Title task-1").closest("button");
    if (!card) throw new Error("card not found");
    fireEvent.dragStart(card);
    fireEvent.drop(column("In Progress"));
    expect(onAdvance).toHaveBeenCalledWith("task-1", "In Progress");
  });

  it("narrows to matching cards as the shared query changes, then restores on clear", () => {
    const { rerender } = renderBoard();
    expect(screen.getByText("Title task-1")).toBeTruthy();

    rerender(board({ query: "Title task-2" }));
    expect(screen.getByText("Title task-2")).toBeTruthy();
    expect(screen.queryByText("Title task-1")).toBeNull();

    rerender(board({ query: "nothing matches this" }));
    expect(screen.getByText("No matching tasks")).toBeTruthy();

    rerender(board({ query: "" }));
    expect(screen.getByText("Title task-1")).toBeTruthy();
    expect(screen.getByText("Title task-4")).toBeTruthy();
  });

  it("carries no filter field of its own", () => {
    renderBoard();
    expect(screen.queryByPlaceholderText(/filter tasks/i)).toBeNull();
  });

  it("keeps the priority filter, which the shared query does not cover", () => {
    renderBoard();
    expect(screen.getByLabelText("Filter by priority")).toBeTruthy();
  });

  it("shows the empty state when there are no tasks", () => {
    render(
      <TaskBoardView
        tasks={[]}
        progress={new Map()}
        loading={false}
        error={undefined}
        selectedPath={undefined}
        onRefresh={noop}
        onOpen={noop}
        onOpenInNewTab={noop}
      />
    );
    expect(screen.getByText("No tasks")).toBeTruthy();
  });
});
