import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Task, TaskStatus } from "@/lib/tasks";
import type { AcProgress } from "@/lib/taskDoc";
import { TaskFilterProvider } from "@/components/explorer/TaskFilterContext";
import { TaskListView } from "./TaskListView";
import { TasksLens } from "./TasksLens";

const { storeGet, storeSet, storeSave } = vi.hoisted(() => ({
  storeGet: vi.fn(),
  storeSet: vi.fn(),
  storeSave: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get = storeGet;
    set = storeSet;
    save = storeSave;
  },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  watch: vi.fn(async () => () => {}),
  readTextFile: vi.fn(async () => ""),
}));

import { invoke } from "@tauri-apps/api/core";

const ROOT = "/ws";

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
  task("task-1", "To Do", { priority: "high", assignee: ["alice"], labels: ["react"] }),
  task("task-2", "In Progress"),
  task("task-4", "To Do"),
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
      collapsedStatuses={new Set<TaskStatus>()}
      onToggleStatus={noop}
    />
  );
}

function group(status: TaskStatus): HTMLElement {
  const el = document.querySelector(`[data-task-group="${status}"]`);
  if (!el) throw new Error(`missing group ${status}`);
  return el as HTMLElement;
}

function rowsIn(status: TaskStatus): HTMLElement[] {
  return within(group(status)).getAllByRole("listitem");
}

function columnTemplate(el: Element): string | undefined {
  return [...el.classList].find((name) => name.startsWith("grid-cols-"));
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  storeGet.mockReset();
  storeSet.mockReset();
  storeSave.mockReset();
  storeGet.mockResolvedValue(undefined);
});

describe("task list view", () => {
  it("gathers tasks under a header per status, showing the status and its count", () => {
    renderList();
    const heading = within(group("To Do")).getByRole("button", { name: "To Do, 2 tasks" });
    expect(within(heading).getByText("To Do")).toBeTruthy();
    expect(within(heading).getByText("2")).toBeTruthy();
    expect(
      within(group("In Progress")).getByRole("button", { name: "In Progress, 1 task" })
    ).toBeTruthy();
    expect(rowsIn("To Do").map((row) => row.textContent)).toEqual([
      "Title task-1reactalicehigh",
      "Title task-4",
    ]);
    expect(rowsIn("Done").map((row) => row.textContent)).toEqual(["Title task-3"]);
  });

  it("names the columns with a light header that shares the rows' column template", () => {
    renderList();
    const header = group("To Do").querySelector('[data-slot="task-columns"]');
    const row = group("To Do").querySelector('[data-slot="task-row"]');
    if (!header || !row) throw new Error("missing header or row");

    expect([...header.children].map((cell) => cell.textContent)).toEqual([
      "Task",
      "Labels",
      "Assignee",
      "Priority",
      "Criteria",
    ]);
    expect(columnTemplate(header)).toBeDefined();
    expect(columnTemplate(row)).toBe(columnTemplate(header));
    expect(document.querySelector("table, tr, td, th")).toBeNull();
  });

  it("leaves the cells of a task without assignee or priority empty, keeping the row aligned", () => {
    renderList();
    const withAll = group("To Do").querySelectorAll('[data-slot="task-row"]')[0];
    const without = group("To Do").querySelectorAll('[data-slot="task-row"]')[1];

    expect([...without.children].length).toBe([...withAll.children].length);
    expect([...without.children].map((cell) => cell.textContent)).toEqual([
      "Title task-4",
      "",
      "",
      "",
      "",
    ]);
  });

  it("shows acceptance-criteria progress where the body has it", () => {
    renderList();
    expect(within(group("In Progress")).getByText("1/3")).toBeTruthy();
  });

  it("opens the task on row click", () => {
    const onOpen = vi.fn();
    renderList(onOpen);
    screen.getByText("Title task-1").click();
    expect(onOpen).toHaveBeenCalledWith("/ws/tasks/task-1.md");
  });

  it("marks the selected task, dims one being advanced, and opens the context menu", () => {
    render(
      <TaskListView
        tasks={tasks}
        searching={false}
        progress={progress}
        selectedPath="/ws/tasks/task-1.md"
        onOpen={noop}
        onOpenInNewTab={noop}
        advancingIds={new Set(["task-4"])}
      />
    );
    const [selected, advancing] = group("To Do").querySelectorAll('[data-slot="task-row"]');
    expect(selected.className).toContain("bg-sidebar-accent");
    expect(advancing.className).toContain("pointer-events-none");

    fireEvent.contextMenu(selected);
    expect(screen.getByText("Open in new tab")).toBeTruthy();
  });

  it("draws no board columns", () => {
    renderList();
    expect(document.querySelector("[data-status]")).toBeNull();
  });
});

describe("folding shares the remembered statuses", () => {
  function foldToggle(status: TaskStatus): HTMLButtonElement {
    const el = group(status).querySelector("button[aria-expanded]");
    if (!(el instanceof HTMLButtonElement)) throw new Error(`missing toggle for ${status}`);
    return el;
  }

  function lens(root: string) {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "list_tasks") return [task("task-1", "To Do"), task("task-2", "Done")];
      throw new Error(`unexpected ${cmd}`);
    });
    return (
      <TaskFilterProvider>
        <TasksLens
          view={TaskListView}
          activeRoot={root}
          query=""
          refreshSignal={0}
          selectedPath={undefined}
          onOpen={noop}
          onOpenInNewTab={noop}
        />
      </TaskFilterProvider>
    );
  }

  it("writes a folded status to the same per-workspace memory the sidebar reads", async () => {
    render(lens(ROOT));
    await waitFor(() => expect(within(group("Done")).getByText("Title task-2")).toBeTruthy());

    fireEvent.click(foldToggle("Done"));

    expect(within(group("Done")).queryByText("Title task-2")).toBeNull();
    await waitFor(() =>
      expect(storeSet).toHaveBeenCalledWith("collapsedTaskStatusesByRoot", { [ROOT]: ["Done"] })
    );
  });

  it("starts folded when that workspace already remembers the status", async () => {
    storeGet.mockResolvedValue({ [ROOT]: ["Done"] });

    render(lens(ROOT));

    await waitFor(() => expect(foldToggle("Done").getAttribute("aria-expanded")).toBe("false"));
    expect(within(group("Done")).queryByText("Title task-2")).toBeNull();
    expect(within(group("To Do")).getByText("Title task-1")).toBeTruthy();
  });
});
