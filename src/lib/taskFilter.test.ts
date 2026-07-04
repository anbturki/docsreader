import { describe, it, expect } from "vitest";

import { filterTasks, availableLabels, isFilterActive, EMPTY_TASK_FILTER } from "./taskFilter";
import type { Task, TaskStatus, TaskPriority } from "./tasks";

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: `Title ${id}`,
    status: "To Do" as TaskStatus,
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

const TASKS: Task[] = [
  task("task-1", { title: "Header UI", labels: ["ui", "v0.7"], priority: "high" as TaskPriority }),
  task("task-2", { title: "Board columns", labels: ["v0.7"], priority: "medium" as TaskPriority }),
  task("task-3", { title: "Drag advance", labels: ["ui"], priority: "high" as TaskPriority }),
  task("task-4", { title: "Docs", labels: [], priority: "low" as TaskPriority }),
];

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe("Smoke D1: filters narrow the board", () => {
  it("returns everything with the empty filter", () => {
    expect(ids(filterTasks(TASKS, EMPTY_TASK_FILTER))).toEqual([
      "task-1",
      "task-2",
      "task-3",
      "task-4",
    ]);
    expect(isFilterActive(EMPTY_TASK_FILTER)).toBe(false);
  });

  it("filters by label", () => {
    expect(ids(filterTasks(TASKS, { ...EMPTY_TASK_FILTER, label: "ui" }))).toEqual([
      "task-1",
      "task-3",
    ]);
  });

  it("filters by priority", () => {
    expect(ids(filterTasks(TASKS, { ...EMPTY_TASK_FILTER, priority: "high" }))).toEqual([
      "task-1",
      "task-3",
    ]);
  });

  it("filters by free-text over title and id", () => {
    expect(ids(filterTasks(TASKS, { ...EMPTY_TASK_FILTER, text: "board" }))).toEqual(["task-2"]);
    expect(ids(filterTasks(TASKS, { ...EMPTY_TASK_FILTER, text: "task-4" }))).toEqual(["task-4"]);
  });

  it("composes filters with AND", () => {
    expect(ids(filterTasks(TASKS, { text: "", label: "ui", priority: "high" }))).toEqual([
      "task-1",
      "task-3",
    ]);
    expect(ids(filterTasks(TASKS, { text: "drag", label: "ui", priority: "high" }))).toEqual([
      "task-3",
    ]);
  });

  it("returns nothing when filters exclude every task", () => {
    expect(filterTasks(TASKS, { ...EMPTY_TASK_FILTER, label: "nope" })).toEqual([]);
  });

  it("collects the sorted set of available labels", () => {
    expect(availableLabels(TASKS)).toEqual(["ui", "v0.7"]);
  });

  it("reports an active filter when any field is set", () => {
    expect(isFilterActive({ ...EMPTY_TASK_FILTER, text: "x" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_TASK_FILTER, label: "ui" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_TASK_FILTER, priority: "low" })).toBe(true);
  });
});
