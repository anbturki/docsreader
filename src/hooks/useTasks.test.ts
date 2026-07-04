import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { useTasks } from "./useTasks";
import type { Task, TaskStatus } from "@/lib/tasks";

type WatchCallback = (event: { type: unknown; paths: string[] }) => void;
const watchCallbacks: WatchCallback[] = [];

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  watch: vi.fn(async (_path: string, cb: WatchCallback) => {
    watchCallbacks.push(cb);
    return () => {};
  }),
}));

import { invoke } from "@tauri-apps/api/core";

const ROOT = "/ws";

function task(id: string, status: TaskStatus): Task {
  return {
    id,
    title: id,
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

beforeEach(() => {
  watchCallbacks.length = 0;
  vi.mocked(invoke).mockReset();
});

describe("useTasks", () => {
  it("loads tasks for the active root", async () => {
    vi.mocked(invoke).mockResolvedValue([task("task-1", "To Do")]);
    const { result } = renderHook(() => useTasks(ROOT));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith("list_tasks", { workspace: ROOT });
  });

  it("refresh re-reads after a tasks/ file change", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    renderHook(() => useTasks(ROOT));
    await waitFor(() => expect(watchCallbacks.length).toBeGreaterThan(0));
    vi.mocked(invoke).mockClear();
    vi.mocked(invoke).mockResolvedValue([task("task-9", "Done")]);
    act(() =>
      watchCallbacks[watchCallbacks.length - 1]({
        type: { create: {} },
        paths: ["/ws/tasks/task-9 - New.md"],
      })
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("list_tasks", { workspace: ROOT })
    );
  });

  it("setStatus writes via the command then reloads", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    const { result } = renderHook(() => useTasks(ROOT));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(invoke).mockClear();
    vi.mocked(invoke).mockResolvedValue([]);
    await act(async () => {
      await result.current.setStatus("task-1", "Done");
    });
    expect(invoke).toHaveBeenCalledWith("set_task_status", {
      workspace: ROOT,
      id: "task-1",
      status: "Done",
    });
    expect(invoke).toHaveBeenCalledWith("list_tasks", { workspace: ROOT });
  });

  it("clears tasks when no workspace is active", async () => {
    const { result } = renderHook(() => useTasks(undefined));
    await waitFor(() => expect(result.current.tasks).toEqual([]));
    expect(invoke).not.toHaveBeenCalled();
  });
});
