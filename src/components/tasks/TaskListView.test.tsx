import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Task, TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import { TaskListView } from "./TaskListView";

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

const tasks = [
  task("task-3", "Done"),
  task("task-1", "To Do", { priority: "high", assignee: ["alice"] }),
  task("task-2", "In Progress"),
];
const progress = new Map<string, AcProgress>([["/ws/tasks/task-2.md", { done: 1, total: 3 }]]);

function renderList(onOpen: (path: string) => void = noop) {
  return render(
    <TaskListView
      tasks={tasks}
      searching={false}
      progress={progress}
      selectedPath={undefined}
      onOpen={onOpen}
      onOpenInNewTab={noop}
    />
  );
}

function rows(): HTMLElement[] {
  return screen.getAllByRole("listitem");
}

describe("task list view", () => {
  it("keeps the order the workspace returned, rather than sorting", () => {
    renderList();
    const titles = rows().map((row) => row.querySelector("span")?.textContent);
    expect(titles).toEqual(["Title task-3", "Title task-1", "Title task-2"]);
  });

  it("shows status, priority, assignee and acceptance-criteria progress on a row", () => {
    renderList();
    const first = within(rows()[1]);
    expect(first.getByText("To Do")).toBeTruthy();
    expect(first.getByText("high")).toBeTruthy();
    expect(first.getByText("alice")).toBeTruthy();
    expect(within(rows()[2]).getByText("1/3")).toBeTruthy();
  });

  it("opens the task on row click", () => {
    const onOpen = vi.fn();
    renderList(onOpen);
    screen.getByText("Title task-1").click();
    expect(onOpen).toHaveBeenCalledWith("/ws/tasks/task-1.md");
  });

  it("draws no board columns", () => {
    renderList();
    expect(document.querySelector("[data-status]")).toBeNull();
  });
});
