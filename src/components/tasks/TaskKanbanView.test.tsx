import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Task, TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import { TaskKanbanView } from "./TaskKanbanView";

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

interface Options {
  tasks?: Task[];
  progress?: Map<string, AcProgress>;
  onAdvance?: (id: string, status: TaskStatus) => void;
  onOpen?: (path: string) => void;
}

function renderKanban({ tasks = [], progress = new Map(), onAdvance, onOpen }: Options = {}) {
  return render(
    <TaskKanbanView
      tasks={tasks}
      searching={false}
      progress={progress}
      selectedPath={undefined}
      onOpen={onOpen ?? noop}
      onOpenInNewTab={noop}
      onAdvance={onAdvance}
    />
  );
}

describe("TaskKanbanView", () => {
  const tasks = [
    task("task-1", "To Do", { priority: "high" }),
    task("task-2", "In Progress"),
    task("task-3", "Done"),
    task("task-4", "To Do"),
  ];

  it("lays the statuses out side by side, in order", () => {
    renderKanban({ tasks });

    const statuses = [...document.querySelectorAll("[data-status]")].map((el) =>
      el.getAttribute("data-status")
    );
    expect(statuses).toEqual(["To Do", "In Progress", "Done"]);
  });

  it("places each task in the column matching its status", () => {
    renderKanban({ tasks });

    expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy();
    expect(within(column("To Do")).getByText("Title task-4")).toBeTruthy();
    expect(within(column("In Progress")).getByText("Title task-2")).toBeTruthy();
    expect(within(column("Done")).getByText("Title task-3")).toBeTruthy();
  });

  it("shows an empty column rather than hiding the status", () => {
    renderKanban({ tasks: [task("task-1", "To Do")] });

    expect(within(column("Done")).queryByRole("listitem")).toBeNull();
    expect(column("Done")).toBeTruthy();
  });

  it("writes the new status when a card is dropped on another column", () => {
    const onAdvance = vi.fn();
    renderKanban({ tasks: [task("task-1", "To Do")], onAdvance });

    fireEvent.dragStart(screen.getByText("Title task-1"));
    fireEvent.drop(column("Done"));

    expect(onAdvance).toHaveBeenCalledWith("task-1", "Done");
  });

  it("opens the task behind a card", () => {
    const onOpen = vi.fn();
    renderKanban({ tasks: [task("task-7", "Done")], onOpen });

    screen.getByText("Title task-7").click();

    expect(onOpen).toHaveBeenCalledWith("/ws/tasks/task-7.md");
  });

  // A board wider than the window has to scroll inside its own box; letting it
  // size the page is what makes the whole window scroll sideways.
  it("keeps the sideways scroll inside the board", () => {
    const { container } = renderKanban({ tasks });

    const board = container.querySelector('[data-slot="tasks-kanban"]');
    expect(board?.className).toContain("overflow-x-auto");
    expect(board?.className).toContain("min-h-0");
    expect(board?.className).toContain("flex-1");
  });

  it("shows acceptance-criteria progress on the card that has it", () => {
    renderKanban({
      tasks,
      progress: new Map([["/ws/tasks/task-2.md", { done: 1, total: 3 }]]),
    });

    expect(within(column("In Progress")).getByText("1/3")).toBeTruthy();
  });
});
