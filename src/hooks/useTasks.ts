import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";

import type { Task, TaskStatus } from "@/lib/tasks";

const REFRESH_DEBOUNCE_MS = 150;
const WATCH_DELAY_MS = 200;
const TASKS_PATH = /[/\\]tasks[/\\]/;

export interface UseTasks {
  tasks: Task[];
  // Bumps whenever task files change on disk, even when the task list itself is
  // unchanged (e.g. an acceptance-criteria checkbox toggled in the body). Lets
  // consumers refresh derived data like AC progress without churning `tasks`.
  revision: number;
  loading: boolean;
  error: string | undefined;
  refresh: () => Promise<void>;
  setStatus: (id: string, status: TaskStatus) => Promise<void>;
}

function sameTasks(a: Task[], b: Task[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}

// `refreshSignal` lets the sidebar header's refresh reload the board, which
// owns its own task list. Any change to it reloads; the value itself is unused.
export function useTasks(activeRoot: string | undefined, refreshSignal = 0): UseTasks {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // `background` reloads (from the file watcher) skip the loading flag and
  // avoid replacing an unchanged list, so a content-only edit doesn't re-render
  // the whole board - only the revision bump refreshes derived progress.
  const load = useCallback(async (root: string, background = false) => {
    if (!background) setLoading(true);
    try {
      const next = await invoke<Task[]>("list_tasks", { workspace: root });
      setTasks((prev) => (sameTasks(prev, next) ? prev : next));
      setError(undefined);
    } catch (e) {
      setTasks([]);
      setError(String(e));
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (activeRoot) await load(activeRoot);
  }, [activeRoot, load]);

  const setStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      if (!activeRoot) return;
      await invoke<Task>("set_task_status", { workspace: activeRoot, id, status });
      await load(activeRoot);
    },
    [activeRoot, load]
  );

  useEffect(() => {
    if (!activeRoot) {
      setTasks([]);
      return;
    }
    void load(activeRoot);
  }, [activeRoot, load, refreshSignal]);

  // Reload when task files change on disk - e.g. an agent writes a task via MCP
  // while the board is open. Watches the whole root (the tasks/ folder may not
  // exist yet) and filters events down to task paths.
  useEffect(() => {
    if (!activeRoot) return;
    let cancelled = false;
    let unwatch: UnwatchFn | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (cancelled) return;
        void load(activeRoot, true);
        setRevision((r) => r + 1);
      }, REFRESH_DEBOUNCE_MS);
    };

    void (async () => {
      try {
        const fn = await watch(
          activeRoot,
          (event) => {
            const paths = Array.isArray(event.paths) ? event.paths : [];
            if (paths.some((p) => TASKS_PATH.test(p))) schedule();
          },
          { recursive: true, delayMs: WATCH_DELAY_MS }
        );
        if (cancelled) {
          void fn();
          return;
        }
        unwatch = fn;
      } catch (err) {
        console.error("tasks watch failed", err);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (unwatch) void unwatch();
    };
  }, [activeRoot, load]);

  return { tasks, revision, loading, error, refresh, setStatus };
}
