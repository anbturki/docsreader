import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { TasksBoard } from "./TasksBoard";
import type { Task, TaskStatus } from "@/lib/tasks";

const watchCallbacks: Array<(e: { type: unknown; paths: string[] }) => void> = [];

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
      <TasksBoard activeRoot={ROOT} query="" selectedPath={undefined} onOpen={() => {}} onOpenInNewTab={() => {}} />
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
      <TasksBoard activeRoot={ROOT} query="" selectedPath={undefined} onOpen={() => {}} onOpenInNewTab={() => {}} />
    );
    await waitFor(() => expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy());

    await dragToDone("task-1");

    await waitFor(() => expect(screen.getByText(/Could not move task-1 to Done/)).toBeTruthy());
    expect(within(column("To Do")).getByText("Title task-1")).toBeTruthy();
  });
});
