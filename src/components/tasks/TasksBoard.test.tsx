import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { TaskFilterProvider, useTaskFilter } from "@/components/explorer/TaskFilterContext";
import { TasksBoard } from "./TasksBoard";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { LensViewId } from "@/lib/storage";

const watchCallbacks: Array<(e: { type: unknown; paths: string[] }) => void> = [];

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
  watch: vi.fn(async (_p: string, cb: (e: { type: unknown; paths: string[] }) => void) => {
    watchCallbacks.push(cb);
    return () => {};
  }),
  readTextFile: vi.fn(async () => ""),
}));

import { invoke } from "@tauri-apps/api/core";

const ROOT = "/ws";

function task(id: string, status: TaskStatus): Task {
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
  };
}

function column(status: TaskStatus): HTMLElement {
  const el = document.querySelector(`[data-status="${status}"]`);
  if (!el) throw new Error(`missing column ${status}`);
  return el as HTMLElement;
}

async function dragToDone(id: string) {
  const card = screen.getByText(`Title ${id}`).closest("button");
  if (!card) throw new Error("card not found");
  fireEvent.dragStart(card);
  fireEvent.drop(column("Done"));
}

beforeEach(() => {
  watchCallbacks.length = 0;
  vi.mocked(invoke).mockReset();
  storeGet.mockReset();
  storeSet.mockReset();
  storeSave.mockReset();
  storeGet.mockResolvedValue(undefined);
});

describe("collapsed statuses persist per workspace", () => {
  function collapseToggle(status: TaskStatus): HTMLButtonElement {
    const el = column(status).querySelector("button[aria-expanded]");
    if (!(el instanceof HTMLButtonElement)) throw new Error(`missing toggle for ${status}`);
    return el;
  }

  function listOnly() {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "list_tasks") return [task("task-1", "To Do"), task("task-2", "Done")];
      throw new Error(`unexpected ${cmd}`);
    });
  }

  function board(root: string) {
    return (
      <TaskFilterProvider>
      <TasksBoard
        activeRoot={root}
        query=""
        refreshSignal={0}
        selectedPath={undefined}
        onOpen={() => {}}
        onOpenInNewTab={() => {}}
      />
      </TaskFilterProvider>
    );
  }

  it("stores the collapsed status against the active workspace", async () => {
    listOnly();
    render(board(ROOT));
    await waitFor(() => expect(within(column("Done")).getByText("Title task-2")).toBeTruthy());

    fireEvent.click(collapseToggle("Done"));

    expect(within(column("Done")).queryByText("Title task-2")).toBeNull();
    await waitFor(() =>
      expect(storeSet).toHaveBeenCalledWith("collapsedTaskStatusesByRoot", { [ROOT]: ["Done"] })
    );
    expect(storeSave).toHaveBeenCalled();
  });

  it("restores the stored collapse on a later mount, and only for that workspace", async () => {
    listOnly();
    storeGet.mockResolvedValue({ [ROOT]: ["Done"] });

    const { unmount } = render(board(ROOT));
    await waitFor(() => expect(collapseToggle("Done").getAttribute("aria-expanded")).toBe("false"));
    expect(within(column("Done")).queryByText("Title task-2")).toBeNull();
    unmount();

    render(board("/other"));
    await waitFor(() => expect(within(column("Done")).getByText("Title task-2")).toBeTruthy());
    expect(collapseToggle("Done").getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Smoke C4: drag writes status + MCP reflects", () => {
  it("writes the new status through the shared set_task_status command on drop", async () => {
    let stored: TaskStatus = "To Do";
    vi.mocked(invoke).mockImplementation(async (cmd, args) => {
      if (cmd === "list_tasks") return [task("task-1", stored)];
      if (cmd === "set_task_status") {
        stored = (args as { status: TaskStatus }).status;
        return task("task-1", stored);
      }
      throw new Error(`unexpected ${cmd}`);
    });

    render(
      <TaskFilterProvider>
        <TasksBoard activeRoot={ROOT} query="" refreshSignal={0} selectedPath={undefined} onOpen={() => {}} onOpenInNewTab={() => {}} />
      </TaskFilterProvider>
    );
    await waitFor(() => expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy());

    await dragToDone("task-1");

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_task_status", {
        workspace: ROOT,
        id: "task-1",
        status: "Done",
      })
    );
    await waitFor(() => expect(within(column("Done")).getByText("Title task-1")).toBeTruthy());
  });

  it("rolls the card back and surfaces an error when the write fails", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "list_tasks") return [task("task-1", "To Do")];
      if (cmd === "set_task_status") throw new Error("disk full");
      throw new Error(`unexpected ${cmd}`);
    });

    render(
      <TaskFilterProvider>
        <TasksBoard activeRoot={ROOT} query="" refreshSignal={0} selectedPath={undefined} onOpen={() => {}} onOpenInNewTab={() => {}} />
      </TaskFilterProvider>
    );
    await waitFor(() => expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy());

    await dragToDone("task-1");

    await waitFor(() => expect(screen.getByText(/Could not move task-1 to Done/)).toBeTruthy());
    expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy();
  });
});

describe("the lens owns what every view shares", () => {
  function lens(view: LensViewId, query = "") {
    return (
      <TaskFilterProvider view={view}>
        <TasksBoard
          activeRoot={ROOT}
          query={query}
          refreshSignal={0}
          selectedPath={undefined}
          onOpen={() => {}}
          onOpenInNewTab={() => {}}
        />
        <CountLabel />
      </TaskFilterProvider>
    );
  }

  function CountLabel() {
    const { count } = useTaskFilter();
    return <output>{count ? `${count.shown}/${count.total}` : "none"}</output>;
  }

  it("renders the tasks as rows when the list view is chosen", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "list_tasks") return [task("task-1", "To Do"), task("task-2", "Done")];
      throw new Error(`unexpected ${cmd}`);
    });

    render(lens("list"));

    await waitFor(() => expect(screen.getByText("Title task-1")).toBeTruthy());
    expect(document.querySelector('[data-slot="tasks-list"]')).not.toBeNull();
    expect(document.querySelector("[data-status]")).toBeNull();
  });

  it("publishes the count and narrows by the shared query in either view", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "list_tasks") return [task("task-1", "To Do"), task("task-2", "Done")];
      throw new Error(`unexpected ${cmd}`);
    });

    const { rerender } = render(lens("list"));
    await waitFor(() => expect(screen.getByText("2/2")).toBeTruthy());

    rerender(lens("list", "task-2"));
    await waitFor(() => expect(screen.getByText("1/2")).toBeTruthy());
    expect(screen.queryByText("Title task-1")).toBeNull();

    rerender(lens("board", "task-2"));
    await waitFor(() => expect(screen.getByText("1/2")).toBeTruthy());
    expect(within(column("Done")).getByText("Title task-2")).toBeTruthy();
  });

  it("shows the empty state once, whichever view is chosen", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "list_tasks") return [];
      throw new Error(`unexpected ${cmd}`);
    });

    render(lens("list"));

    await waitFor(() => expect(screen.getByText("No tasks")).toBeTruthy());
    expect(document.querySelector('[data-slot="tasks-list"]')).toBeNull();
  });

  it("says nothing matched while a query narrows everything away", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "list_tasks") return [task("task-1", "To Do")];
      throw new Error(`unexpected ${cmd}`);
    });

    render(lens("board", "nothing matches this"));

    await waitFor(() => expect(screen.getByText("No matching tasks")).toBeTruthy());
  });
});
