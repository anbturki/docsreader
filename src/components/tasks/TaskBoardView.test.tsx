import { useState } from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TaskFilterProvider } from "@/components/explorer/TaskFilterContext";
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
  if (!(el instanceof HTMLElement)) throw new Error(`missing column ${status}`);
  return el;
}

function toggle(status: TaskStatus): HTMLButtonElement {
  const el = column(status).querySelector("button[aria-expanded]");
  if (!(el instanceof HTMLButtonElement)) throw new Error(`missing toggle for ${status}`);
  return el;
}

interface BoardProps {
  tasks: Task[];
  progress: Map<string, AcProgress>;
  searching?: boolean;
  onAdvance?: (id: string, status: TaskStatus) => void;
}

function CollapsibleBoard({ tasks, progress, searching = false, onAdvance }: BoardProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<TaskStatus>>(new Set());
  return (
    <TaskBoardView
      tasks={tasks}
      searching={searching}
      progress={progress}
      selectedPath={undefined}
      onOpen={noop}
      onOpenInNewTab={noop}
      onAdvance={onAdvance}
      collapsedStatuses={collapsed}
      onToggleStatus={(status) =>
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (!next.delete(status)) next.add(status);
          return next;
        })
      }
    />
  );
}

describe("Smoke C2: board groups real tasks correctly", () => {
  const tasks = [
    task("task-1", "To Do", { priority: "high", assignee: ["alice"] }),
    task("task-2", "In Progress"),
    task("task-3", "Done"),
    task("task-4", "To Do"),
  ];
  const progress = new Map<string, AcProgress>([["/ws/tasks/task-2.md", { done: 1, total: 3 }]]);

  function board(over: Partial<BoardProps> = {}) {
    return (
      <TaskFilterProvider>
        <CollapsibleBoard tasks={tasks} progress={progress} {...over} />
      </TaskFilterProvider>
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
      <TaskFilterProvider>
      <TaskBoardView
        tasks={[task("task-9", "Done")]}
        searching={false}
        progress={new Map()}
        selectedPath={undefined}
        onOpen={onOpen}
        onOpenInNewTab={noop}
      />
      </TaskFilterProvider>
    );
    screen.getByText("Title task-9").click();
    expect(onOpen).toHaveBeenCalledWith("/ws/tasks/task-9.md");
  });

  it("calls onAdvance with the target status when a card is dragged across columns", () => {
    const onAdvance = vi.fn();
    render(
      <TaskFilterProvider>
      <TaskBoardView
        tasks={[task("task-1", "To Do")]}
        searching={false}
        progress={new Map()}
        selectedPath={undefined}
        onOpen={noop}
        onOpenInNewTab={noop}
        onAdvance={onAdvance}
      />
      </TaskFilterProvider>
    );
    const card = screen.getByText("Title task-1").closest("button");
    if (!card) throw new Error("card not found");
    fireEvent.dragStart(card);
    fireEvent.drop(column("In Progress"));
    expect(onAdvance).toHaveBeenCalledWith("task-1", "In Progress");
  });

  it("carries no filter field of its own", () => {
    renderBoard();
    expect(screen.queryByPlaceholderText(/filter tasks/i)).toBeNull();
  });

  // The priority and label filters moved into the sidebar header, so the board
  // must not grow a second set of its own.
  it("hosts no filter controls, which now live in the sidebar header", () => {
    renderBoard();
    expect(screen.queryByLabelText("Filter by priority")).toBeNull();
    expect(screen.queryByLabelText("Filter by label")).toBeNull();
  });

  it("collapses a status to its header, keeping the count and hiding the cards", () => {
    renderBoard();
    expect(within(column("Done")).getByText("Title task-3")).toBeTruthy();

    fireEvent.click(toggle("Done"));

    expect(within(column("Done")).queryByText("Title task-3")).toBeNull();
    const header = screen.getByRole("button", { name: "Done, 1 task" });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy();
  });

  it("announces the collapsed and expanded state on the toggle", () => {
    renderBoard();
    expect(toggle("Done").getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle("Done"));
    expect(toggle("Done").getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle("Done"));
    expect(toggle("Done").getAttribute("aria-expanded")).toBe("true");
  });

  it("reveals a collapsed status that holds matches, and leaves it collapsed otherwise", () => {
    const { rerender } = renderBoard();
    fireEvent.click(toggle("Done"));
    expect(within(column("Done")).queryByText("Title task-3")).toBeNull();

    rerender(board({ searching: true }));
    expect(within(column("Done")).getByText("Title task-3")).toBeTruthy();
    expect(toggle("Done").getAttribute("aria-expanded")).toBe("true");

    rerender(board({ tasks: tasks.filter((t) => t.status !== "Done"), searching: true }));
    expect(toggle("Done").getAttribute("aria-expanded")).toBe("false");

    rerender(board({ searching: false }));
    expect(within(column("Done")).queryByText("Title task-3")).toBeNull();
  });

  it("accepts a drop onto a collapsed status and keeps it collapsed", () => {
    const onAdvance = vi.fn();
    render(board({ onAdvance }));
    fireEvent.click(toggle("Done"));

    const card = screen.getByText("Title task-1").closest("button");
    if (!card) throw new Error("card not found");
    fireEvent.dragStart(card);
    fireEvent.drop(column("Done"));

    expect(onAdvance).toHaveBeenCalledWith("task-1", "Done");
    expect(column("Done").getAttribute("data-collapsed")).toBe("true");
  });

});
