import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import type { Tabs } from "@/hooks/useTabs";
import type { TabContentProps } from "@/components/document/tabKinds";
import { defaultViewSettings } from "@/lib/storage";
import { fileTarget, TASKS_TARGET } from "@/lib/tabKinds";
import type { Task, TaskStatus } from "@/lib/tasks";
import { TasksTabContent } from "./TasksTabContent";

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

const openInActive = vi.fn();
const openInNew = vi.fn();

function pane(): Tabs {
  const noop = () => {};
  return {
    tabs: [],
    activeTab: undefined,
    activeId: undefined,
    hydrated: true,
    openInActive,
    openInNew,
    activate: noop,
    close: noop,
    acceptPending: noop,
    dismissPending: noop,
    beginEdit: async () => {},
    cancelEdit: noop,
    saveEdit: async () => {},
    toggleTaskItem: async () => {},
    getScrollTop: () => 0,
    setScrollTop: noop,
  };
}

function props(): TabContentProps {
  return {
    tab: {
      id: "t1",
      ...TASKS_TARGET,
      title: "Tasks",
      content: "",
      meta: {},
      error: undefined,
      loading: false,
    },
    pane: pane(),
    active: true,
    files: [],
    rootPath: ROOT,
    viewSettings: defaultViewSettings,
    paneFocused: true,
    onActiveScrollElChange: () => {},
    onDiffViewModeChange: () => {},
    onAlwaysAutoReload: () => {},
  };
}

function column(status: TaskStatus): HTMLElement {
  const el = document.querySelector(`[data-status="${status}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`missing column ${status}`);
  return el;
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  openInActive.mockReset();
  openInNew.mockReset();
  storeGet.mockReset();
  storeSet.mockReset();
  storeSave.mockReset();
  storeGet.mockResolvedValue(undefined);
});

function listOnly(tasks: Task[]) {
  vi.mocked(invoke).mockImplementation(async (cmd) => {
    if (cmd === "list_tasks") return tasks;
    throw new Error(`unexpected ${cmd}`);
  });
}

describe("the tasks tab", () => {
  it("shows the workspace tasks in side-by-side columns", async () => {
    listOnly([task("task-1", "To Do"), task("task-2", "Done")]);

    render(<TasksTabContent {...props()} />);

    await waitFor(() => expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy());
    expect(within(column("Done")).getByText("Title task-2")).toBeTruthy();
    expect(document.querySelector('[data-slot="tasks-kanban"]')).toBeTruthy();
  });

  it("narrows to the tasks matching what was typed", async () => {
    listOnly([task("task-1", "To Do"), task("task-2", "To Do", { title: "Something else" })]);
    const user = userEvent.setup();

    render(<TasksTabContent {...props()} />);
    await waitFor(() => expect(screen.getByText("Title task-1")).toBeTruthy());

    await user.type(screen.getByLabelText("Search tasks"), "Something");

    await waitFor(() => expect(screen.queryByText("Title task-1")).toBeNull());
    expect(screen.getByText("Something else")).toBeTruthy();
  });

  it("writes the new status through the shared command when a card is dropped", async () => {
    let stored: TaskStatus = "To Do";
    vi.mocked(invoke).mockImplementation(async (cmd, args) => {
      if (cmd === "list_tasks") return [task("task-1", stored)];
      if (cmd === "set_task_status") {
        stored = (args as { status: TaskStatus }).status;
        return task("task-1", stored);
      }
      throw new Error(`unexpected ${cmd}`);
    });

    render(<TasksTabContent {...props()} />);
    await waitFor(() => expect(screen.getByText("Title task-1")).toBeTruthy());

    fireEvent.dragStart(screen.getByText("Title task-1"));
    fireEvent.drop(column("Done"));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_task_status", {
        workspace: ROOT,
        id: "task-1",
        status: "Done",
      })
    );
    await waitFor(() => expect(within(column("Done")).getByText("Title task-1")).toBeTruthy());
  });

  it("opens a task in the pane it lives in", async () => {
    listOnly([task("task-1", "To Do")]);

    render(<TasksTabContent {...props()} />);
    await waitFor(() => expect(screen.getByText("Title task-1")).toBeTruthy());

    screen.getByText("Title task-1").click();

    expect(openInActive).toHaveBeenCalledWith(fileTarget("/ws/tasks/task-1.md"));
  });

  it("says so when the workspace has no tasks", async () => {
    listOnly([]);

    render(<TasksTabContent {...props()} />);

    await waitFor(() => expect(screen.getByText("No tasks")).toBeTruthy());
  });
});
